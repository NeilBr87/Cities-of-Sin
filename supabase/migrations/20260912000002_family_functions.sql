-- ============================================================================
-- M2 — Family and crew operations.
-- ============================================================================

-- ---------------------------------------------------------------- helpers --

create or replace function public.require_mafia()
returns public.characters
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c public.characters%rowtype;
begin
  c := public.require_character();
  if c.path <> 'mafia' then
    raise exception 'That is not your line of work.' using errcode = 'P0001';
  end if;
  return c;
end;
$$;

-- "Genovese Crew" — a crew carries its captain's surname.
create or replace function public.crew_name_for(c public.characters)
returns text
language sql
immutable
as $$ select c.last_name || ' Crew' $$;

-- One shape for a family everywhere it is rendered.
create or replace function public.family_json(p_family_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'id', f.id,
    'name', f.name,
    'motto', f.motto,
    'logo', f.logo,
    'city_id', f.city_id,
    'city', ci.name,
    'treasury', f.treasury,
    'founded_at', f.founded_at,
    'boss', case when b.id is null then null else jsonb_build_object(
              'id', b.id, 'name', public.display_name(b), 'respect', b.respect
            ) end,
    'member_count', (
      select count(*) from public.characters m
      where m.family_id = f.id and m.died_at is null
    ),
    'cities', (
      select coalesce(jsonb_agg(jsonb_build_object('id', c2.id, 'name', c2.name) order by c2.sort_order), '[]'::jsonb)
      from public.family_cities fc join public.cities c2 on c2.id = fc.city_id
      where fc.family_id = f.id
    ),
    'crews', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', cr.id,
               'name', cr.name,
               'district_id', cr.district_id,
               'district', d.name,
               'captain', jsonb_build_object('id', cap.id, 'name', public.display_name(cap)),
               'size', (select count(*) from public.characters mm
                        where mm.crew_id = cr.id and mm.died_at is null)
             ) order by d.sort_order), '[]'::jsonb)
      from public.crews cr
      join public.districts d on d.id = cr.district_id
      join public.characters cap on cap.id = cr.captain_id
      where cr.family_id = f.id
    ),
    'members', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', m.id,
               'name', public.display_name(m),
               'rank_id', m.rank_id,
               'respect', m.respect,
               'crew_id', m.crew_id,
               'district_id', m.district_id,
               'joined_at', m.joined_family_at
             ) order by
               case m.rank_id when 'boss' then 1 when 'captain' then 2
                              when 'soldier' then 3 else 4 end,
               m.respect desc), '[]'::jsonb)
      from public.characters m
      where m.family_id = f.id and m.died_at is null
    )
  )
  into result
  from public.families f
  join public.cities ci on ci.id = f.city_id
  left join public.characters b on b.id = f.boss_id
  where f.id = p_family_id and f.disbanded_at is null;

  return result;
end;
$$;

-- ------------------------------------------------------------------ reads --

create or replace function public.list_families(p_city_id text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  result jsonb;
begin
  select coalesce(jsonb_agg(j order by founded), '[]'::jsonb) into result
  from (
    select f.founded_at as founded, jsonb_build_object(
      'id', f.id, 'name', f.name, 'motto', f.motto, 'logo', f.logo,
      'city_id', f.city_id, 'city', ci.name, 'founded_at', f.founded_at,
      'boss', case when b.id is null then null else public.display_name(b) end,
      'member_count', (select count(*) from public.characters m
                       where m.family_id = f.id and m.died_at is null),
      'crew_count', (select count(*) from public.crews cr where cr.family_id = f.id)
    ) as j
    from public.families f
    join public.cities ci on ci.id = f.city_id
    left join public.characters b on b.id = f.boss_id
    where f.disbanded_at is null
      and (p_city_id is null or f.city_id = p_city_id)
  ) rows;

  return jsonb_build_object(
    'families', result,
    'seats_per_city', public.cfg('max_families_per_city'),
    'founding_cost', public.cfg('family_founding_cost')
  );
end;
$$;

create or replace function public.get_family(p_family_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid := p_family_id;
begin
  if v_id is null then
    select family_id into v_id
    from public.characters
    where profile_id = auth.uid() and died_at is null;
  end if;

  if v_id is null then
    return null;
  end if;

  return public.family_json(v_id);
end;
$$;

-- ------------------------------------------------------------- founding --

create or replace function public.found_family(
  p_name  text,
  p_motto text default '',
  p_logo  text default '🎩'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c        public.characters%rowtype;
  v_cost   bigint;
  v_seats  int;
  v_taken  int;
  v_new_id uuid;
begin
  c := public.require_mafia();

  if c.family_id is not null then
    raise exception 'You are already with a family.' using errcode = 'P0001';
  end if;
  if c.jail_until is not null and c.jail_until > now() then
    raise exception 'You cannot start a family from a cell.' using errcode = 'P0001';
  end if;
  if char_length(btrim(p_name)) < 3 then
    raise exception 'That name is too short.' using errcode = 'P0001';
  end if;

  v_cost := public.cfg('family_founding_cost')::bigint;
  if c.clean < v_cost then
    raise exception 'Starting a family costs $% in clean money.',
      to_char(v_cost, 'FM999,999,999') using errcode = 'P0001';
  end if;

  -- Serialise every attempt to found in this city, so two players cannot both
  -- pass the seat check and take a sixth seat between them.
  perform pg_advisory_xact_lock(hashtext('found_family:' || c.city_id));

  v_seats := public.cfg('max_families_per_city')::int;
  select count(*) into v_taken
  from public.families
  where city_id = c.city_id and disbanded_at is null;

  if v_taken >= v_seats then
    raise exception 'All % seats in this city are taken. There is no sixth.', v_seats
      using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.families
    where lower(name) = lower(btrim(p_name)) and disbanded_at is null
  ) then
    raise exception 'A family already carries that name.' using errcode = 'P0001';
  end if;

  insert into public.families (name, motto, logo, city_id, boss_id)
  values (btrim(p_name), left(coalesce(p_motto, ''), 120),
          coalesce(nullif(btrim(p_logo), ''), '🎩'), c.city_id, c.id)
  returning id into v_new_id;

  insert into public.family_cities (family_id, city_id) values (v_new_id, c.city_id);

  update public.characters set
    clean = clean - v_cost,
    family_id = v_new_id,
    rank_id = 'boss',
    joined_family_at = now()
  where id = c.id;

  insert into public.events (scope, kind, body, payload)
  values ('city:' || c.city_id, 'family_founded',
          public.display_name(c) || ' founded the ' || btrim(p_name) || ' family.',
          jsonb_build_object('family_id', v_new_id));

  return public.family_json(v_new_id);
end;
$$;

create or replace function public.update_family(
  p_name  text,
  p_motto text,
  p_logo  text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c public.characters%rowtype;
begin
  c := public.require_mafia();
  if c.rank_id <> 'boss' then
    raise exception 'Only the boss changes the family name.' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.families
    where lower(name) = lower(btrim(p_name))
      and id <> c.family_id and disbanded_at is null
  ) then
    raise exception 'A family already carries that name.' using errcode = 'P0001';
  end if;

  update public.families set
    name  = btrim(p_name),
    motto = left(coalesce(p_motto, ''), 120),
    logo  = coalesce(nullif(btrim(p_logo), ''), logo)
  where id = c.family_id;

  return public.family_json(c.family_id);
end;
$$;

create or replace function public.disband_family()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c public.characters%rowtype;
  v_family uuid;
  v_name   text;
begin
  c := public.require_mafia();
  if c.rank_id <> 'boss' then
    raise exception 'Only the boss can disband the family.' using errcode = 'P0001';
  end if;

  v_family := c.family_id;
  select name into v_name from public.families where id = v_family;

  -- Everyone walks out as an unattached hoodlum.
  update public.characters set
    family_id = null, crew_id = null, rank_id = 'hoodlum', joined_family_at = null
  where family_id = v_family and died_at is null;

  delete from public.crews where family_id = v_family;
  delete from public.boss_votes where family_id = v_family;

  update public.families set disbanded_at = now(), boss_id = null where id = v_family;

  insert into public.events (scope, kind, body)
  values ('city:' || c.city_id, 'family_disbanded', 'The ' || v_name || ' family is finished.');

  return public.get_me();
end;
$$;

-- ----------------------------------------------------------- membership --

create or replace function public.join_family(p_family_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c public.characters%rowtype;
  f public.families%rowtype;
begin
  c := public.require_mafia();

  if c.family_id is not null then
    raise exception 'You are already with a family.' using errcode = 'P0001';
  end if;

  select * into f from public.families where id = p_family_id and disbanded_at is null;
  if not found then
    raise exception 'No such family.' using errcode = 'P0001';
  end if;

  -- You can only walk in where they actually operate.
  if not exists (
    select 1 from public.family_cities
    where family_id = f.id and city_id = c.city_id
  ) then
    raise exception 'They do not operate in this city.' using errcode = 'P0001';
  end if;

  update public.characters set
    family_id = f.id, rank_id = 'associate', joined_family_at = now()
  where id = c.id;

  return public.get_me();
end;
$$;

create or replace function public.leave_family()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c public.characters%rowtype;
begin
  c := public.require_mafia();

  if c.family_id is null then
    raise exception 'You are not with a family.' using errcode = 'P0001';
  end if;
  if c.rank_id = 'boss' then
    raise exception 'A boss does not walk away. Disband the family or be voted out.'
      using errcode = 'P0001';
  end if;

  -- A captain leaving takes their crew off the board with them.
  if c.rank_id = 'captain' then
    update public.characters set crew_id = null
    where crew_id in (select id from public.crews where captain_id = c.id);
    delete from public.crews where captain_id = c.id;
  end if;

  delete from public.boss_votes where voter_id = c.id;

  update public.characters set
    family_id = null, crew_id = null, rank_id = 'hoodlum', joined_family_at = null
  where id = c.id;

  return public.get_me();
end;
$$;

-- The boss makes an associate. This is the only route to soldier.
create or replace function public.make_member(p_character_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c      public.characters%rowtype;
  t      public.characters%rowtype;
  v_min  int;
begin
  c := public.require_mafia();
  if c.rank_id <> 'boss' then
    raise exception 'Only the boss makes people.' using errcode = 'P0001';
  end if;

  select * into t from public.characters
  where id = p_character_id and family_id = c.family_id and died_at is null;
  if not found then
    raise exception 'They are not in your family.' using errcode = 'P0001';
  end if;
  if t.rank_id <> 'associate' then
    raise exception 'Only an associate can be made.' using errcode = 'P0001';
  end if;

  v_min := public.cfg('made_min_respect')::int;
  if t.respect < v_min then
    raise exception 'They have not earned it yet. Needs % respect.', v_min
      using errcode = 'P0001';
  end if;

  update public.characters set rank_id = 'soldier' where id = t.id;

  insert into public.events (scope, kind, body)
  values ('character:' || t.id, 'made', 'You got made. Ten percent goes up every week now.');

  return public.family_json(c.family_id);
end;
$$;

create or replace function public.promote_to_captain(
  p_character_id uuid,
  p_district_id  text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c       public.characters%rowtype;
  t       public.characters%rowtype;
  d       public.districts%rowtype;
  v_min   int;
  v_crew  uuid;
begin
  c := public.require_mafia();
  if c.rank_id <> 'boss' then
    raise exception 'Only the boss hands out crews.' using errcode = 'P0001';
  end if;

  select * into t from public.characters
  where id = p_character_id and family_id = c.family_id and died_at is null;
  if not found then
    raise exception 'They are not in your family.' using errcode = 'P0001';
  end if;
  if t.rank_id <> 'soldier' then
    raise exception 'Only a made soldier can be given a crew.' using errcode = 'P0001';
  end if;

  v_min := public.cfg('captain_min_respect')::int;
  if t.respect < v_min then
    raise exception 'Not ready for a crew. Needs % respect.', v_min using errcode = 'P0001';
  end if;

  select * into d from public.districts where id = p_district_id;
  if not found then
    raise exception 'No such district.' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.family_cities
    where family_id = c.family_id and city_id = d.city_id
  ) then
    raise exception 'Your family does not operate in that city yet.' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.crews
    where family_id = c.family_id and district_id = d.id
  ) then
    raise exception 'You already hold a crew in %. One per district.', d.name
      using errcode = 'P0001';
  end if;

  insert into public.crews (family_id, captain_id, district_id, name)
  values (c.family_id, t.id, d.id, public.crew_name_for(t))
  returning id into v_crew;

  update public.characters set rank_id = 'captain', crew_id = v_crew where id = t.id;

  insert into public.events (scope, kind, body)
  values ('character:' || t.id, 'promoted',
          'You have a crew of your own in ' || d.name || '.');

  return public.family_json(c.family_id);
end;
$$;

create or replace function public.demote_captain(p_character_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c public.characters%rowtype;
  t public.characters%rowtype;
begin
  c := public.require_mafia();
  if c.rank_id <> 'boss' then
    raise exception 'Only the boss demotes captains.' using errcode = 'P0001';
  end if;

  select * into t from public.characters
  where id = p_character_id and family_id = c.family_id and died_at is null;
  if not found then
    raise exception 'They are not in your family.' using errcode = 'P0001';
  end if;
  if t.rank_id <> 'captain' then
    raise exception 'They do not have a crew to lose.' using errcode = 'P0001';
  end if;

  -- The crew dissolves; its soldiers become crewless and kick to the boss.
  update public.characters set crew_id = null
  where crew_id in (select id from public.crews where captain_id = t.id);
  delete from public.crews where captain_id = t.id;

  update public.characters set rank_id = 'soldier', crew_id = null where id = t.id;

  insert into public.events (scope, kind, body)
  values ('character:' || t.id, 'demoted', 'Your crew has been taken off you.');

  return public.family_json(c.family_id);
end;
$$;

create or replace function public.kick_from_family(p_character_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c public.characters%rowtype;
  t public.characters%rowtype;
begin
  c := public.require_mafia();
  if c.rank_id <> 'boss' then
    raise exception 'Only the boss throws people out.' using errcode = 'P0001';
  end if;
  if p_character_id = c.id then
    raise exception 'You cannot throw yourself out.' using errcode = 'P0001';
  end if;

  select * into t from public.characters
  where id = p_character_id and family_id = c.family_id and died_at is null;
  if not found then
    raise exception 'They are not in your family.' using errcode = 'P0001';
  end if;

  if t.rank_id = 'captain' then
    update public.characters set crew_id = null
    where crew_id in (select id from public.crews where captain_id = t.id);
    delete from public.crews where captain_id = t.id;
  end if;

  delete from public.boss_votes where voter_id = t.id;

  update public.characters set
    family_id = null, crew_id = null, rank_id = 'hoodlum', joined_family_at = null
  where id = t.id;

  insert into public.events (scope, kind, body)
  values ('character:' || t.id, 'kicked', 'You are out. Do not come back.');

  return public.family_json(c.family_id);
end;
$$;

-- -------------------------------------------------------------- crews --

create or replace function public.join_crew(p_crew_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c  public.characters%rowtype;
  cr public.crews%rowtype;
begin
  c := public.require_mafia();

  if c.family_id is null then
    raise exception 'You are not with a family.' using errcode = 'P0001';
  end if;
  if c.rank_id in ('boss', 'captain') then
    raise exception 'You already have people of your own.' using errcode = 'P0001';
  end if;

  select * into cr from public.crews where id = p_crew_id;
  if not found or cr.family_id <> c.family_id then
    raise exception 'That is not one of your family''s crews.' using errcode = 'P0001';
  end if;

  update public.characters set crew_id = cr.id where id = c.id;
  return public.get_me();
end;
$$;

create or replace function public.leave_crew()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c public.characters%rowtype;
begin
  c := public.require_mafia();
  if c.crew_id is null then
    raise exception 'You are not in a crew.' using errcode = 'P0001';
  end if;
  if c.rank_id = 'captain' then
    raise exception 'It is your crew. Ask the boss to take it off you.' using errcode = 'P0001';
  end if;

  update public.characters set crew_id = null where id = c.id;
  return public.get_me();
end;
$$;

create or replace function public.kick_from_crew(p_character_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c public.characters%rowtype;
  t public.characters%rowtype;
begin
  c := public.require_mafia();
  if c.rank_id <> 'captain' then
    raise exception 'Only a captain runs a crew.' using errcode = 'P0001';
  end if;

  select * into t from public.characters where id = p_character_id and died_at is null;
  if not found or t.crew_id is null or t.crew_id <> c.crew_id then
    raise exception 'They are not in your crew.' using errcode = 'P0001';
  end if;
  if t.id = c.id then
    raise exception 'You cannot kick yourself out of your own crew.' using errcode = 'P0001';
  end if;

  update public.characters set crew_id = null where id = t.id;
  return public.family_json(c.family_id);
end;
$$;

-- ----------------------------------------------------- voting out a boss --

create or replace function public.vote_out_boss()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c           public.characters%rowtype;
  v_eligible  int;
  v_votes     int;
  v_threshold numeric;
  v_boss      uuid;
  v_successor uuid;
begin
  c := public.require_mafia();

  if c.family_id is null then
    raise exception 'You are not with a family.' using errcode = 'P0001';
  end if;
  if c.rank_id = 'boss' then
    raise exception 'You cannot vote against yourself.' using errcode = 'P0001';
  end if;
  if c.rank_id = 'associate' then
    raise exception 'Associates do not get a vote. Get made first.' using errcode = 'P0001';
  end if;

  select boss_id into v_boss from public.families where id = c.family_id;

  insert into public.boss_votes (family_id, voter_id)
  values (c.family_id, c.id)
  on conflict (family_id, voter_id) do nothing;

  -- Made members only: the people who actually kick up decide who collects.
  select count(*) into v_eligible
  from public.characters
  where family_id = c.family_id and died_at is null
    and rank_id in ('soldier', 'captain');

  select count(*) into v_votes
  from public.boss_votes bv
  join public.characters m on m.id = bv.voter_id
  where bv.family_id = c.family_id
    and m.died_at is null
    and m.family_id = c.family_id
    and m.rank_id in ('soldier', 'captain');

  v_threshold := public.cfg('boss_vote_threshold');

  if v_eligible = 0 or (v_votes::numeric / v_eligible) <= v_threshold then
    return jsonb_build_object(
      'demoted', false, 'votes', v_votes, 'eligible', v_eligible,
      'needed', floor(v_eligible * v_threshold) + 1
    );
  end if;

  -- Majority reached. The most respected captain takes over, or failing that
  -- the most respected soldier.
  select id into v_successor
  from public.characters
  where family_id = c.family_id and died_at is null
    and rank_id in ('captain', 'soldier')
    and id <> v_boss
  order by case rank_id when 'captain' then 1 else 2 end, respect desc
  limit 1;

  if v_boss is not null then
    -- The deposed boss drops to soldier and keeps nothing but the rank.
    update public.characters set rank_id = 'soldier', crew_id = null where id = v_boss;
  end if;

  if v_successor is not null then
    -- A captain taking the top seat gives up their crew.
    update public.characters set crew_id = null
    where crew_id in (select id from public.crews where captain_id = v_successor);
    delete from public.crews where captain_id = v_successor;

    update public.characters set rank_id = 'boss', crew_id = null where id = v_successor;
    update public.families set boss_id = v_successor where id = c.family_id;
  end if;

  delete from public.boss_votes where family_id = c.family_id;

  insert into public.events (scope, kind, body)
  select 'city:' || c.city_id, 'boss_deposed',
         'The ' || f.name || ' family has a new boss.'
  from public.families f where f.id = c.family_id;

  return jsonb_build_object('demoted', true, 'votes', v_votes, 'eligible', v_eligible);
end;
$$;

-- ---------------------------------------------------------- the treasury --

create or replace function public.family_deposit(p_amount bigint)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c public.characters%rowtype;
begin
  c := public.require_mafia();
  if c.family_id is null then
    raise exception 'You are not with a family.' using errcode = 'P0001';
  end if;
  if p_amount <= 0 then
    raise exception 'Put in how much?' using errcode = 'P0001';
  end if;
  if c.clean < p_amount then
    raise exception 'Not enough clean money.' using errcode = 'P0001';
  end if;

  update public.characters set clean = clean - p_amount where id = c.id;
  update public.families set treasury = treasury + p_amount where id = c.family_id;

  return public.get_me();
end;
$$;

create or replace function public.family_withdraw(p_amount bigint)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c public.characters%rowtype;
begin
  c := public.require_mafia();
  if c.rank_id <> 'boss' then
    raise exception 'Only the boss touches the treasury.' using errcode = 'P0001';
  end if;
  if p_amount <= 0 then
    raise exception 'Take out how much?' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.families where id = c.family_id and treasury >= p_amount
  ) then
    raise exception 'The treasury does not hold that much.' using errcode = 'P0001';
  end if;

  update public.families set treasury = treasury - p_amount where id = c.family_id;
  update public.characters set clean = clean + p_amount where id = c.id;

  return public.get_me();
end;
$$;

create or replace function public.expand_to_city(p_city_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c      public.characters%rowtype;
  v_cost bigint;
begin
  c := public.require_mafia();
  if c.rank_id <> 'boss' then
    raise exception 'Only the boss opens a new city.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.cities where id = p_city_id) then
    raise exception 'No such city.' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.family_cities where family_id = c.family_id and city_id = p_city_id
  ) then
    raise exception 'You already operate there.' using errcode = 'P0001';
  end if;

  v_cost := public.cfg('family_expansion_cost')::bigint;
  if not exists (
    select 1 from public.families where id = c.family_id and treasury >= v_cost
  ) then
    raise exception 'Opening a city costs $% from the treasury.',
      to_char(v_cost, 'FM999,999,999') using errcode = 'P0001';
  end if;

  update public.families set treasury = treasury - v_cost where id = c.family_id;
  insert into public.family_cities (family_id, city_id) values (c.family_id, p_city_id);

  insert into public.events (scope, kind, body)
  select 'city:' || p_city_id, 'family_expanded',
         'The ' || f.name || ' family has opened up here.'
  from public.families f where f.id = c.family_id;

  return public.family_json(c.family_id);
end;
$$;

-- ------------------------------------------------------- the weekly kick --

-- Soldiers kick to their captain, or to the boss if they have no crew.
-- Captains kick to the boss. Associates kick nothing — they are owed nothing.
-- Taken from dirty money first, then clean, and credited in the same split so
-- that kicking up can never launder anybody's money for them.
create or replace function public.run_weekly_kickup()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r          record;
  v_week     date := date_trunc('week', now())::date;
  v_pct      numeric := public.cfg('kick_up_pct');
  v_owed     bigint;
  v_dirty    bigint;
  v_clean    bigint;
  v_to       uuid;
  v_paid     int := 0;
  v_total    bigint := 0;
  v_inserted bigint;
begin
  for r in
    select m.id, m.rank_id, m.family_id, m.crew_id, m.dirty, m.clean,
           f.boss_id,
           (select cr.captain_id from public.crews cr where cr.id = m.crew_id) as captain_id
    from public.characters m
    join public.families f on f.id = m.family_id and f.disbanded_at is null
    where m.died_at is null
      and m.rank_id in ('soldier', 'captain')
  loop
    v_to := case when r.rank_id = 'soldier' and r.captain_id is not null
                 then r.captain_id else r.boss_id end;

    -- Nobody to pay, or you would be paying yourself.
    if v_to is null or v_to = r.id then
      continue;
    end if;

    v_owed := floor((r.dirty + r.clean) * v_pct);
    if v_owed <= 0 then
      continue;
    end if;

    v_dirty := least(r.dirty, v_owed);
    v_clean := v_owed - v_dirty;

    insert into public.kickups (week_start, family_id, from_id, to_id, amount, from_dirty, from_clean)
    values (v_week, r.family_id, r.id, v_to, v_owed, v_dirty, v_clean)
    on conflict (week_start, from_id) do nothing
    returning id into v_inserted;

    -- Already collected from this player this week.
    if v_inserted is null then
      continue;
    end if;

    update public.characters
      set dirty = dirty - v_dirty, clean = clean - v_clean
      where id = r.id;

    update public.characters
      set dirty = dirty + v_dirty, clean = clean + v_clean
      where id = v_to;

    insert into public.events (scope, kind, body, payload)
    values ('character:' || r.id, 'kickup',
            'You kicked up $' || to_char(v_owed, 'FM999,999,999') || ' this week.',
            jsonb_build_object('amount', v_owed));

    v_paid  := v_paid + 1;
    v_total := v_total + v_owed;
  end loop;

  return jsonb_build_object('week_start', v_week, 'payments', v_paid, 'total', v_total);
end;
$$;

-- Schedule it for 03:00 UTC every Monday, if pg_cron is available. On a fresh
-- Supabase project the extension has to be enabled once under
-- Database -> Extensions; until then the function is still callable by hand.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('weekly-kickup')
      where exists (select 1 from cron.job where jobname = 'weekly-kickup');
    perform cron.schedule('weekly-kickup', '0 3 * * 1', 'select public.run_weekly_kickup()');
  else
    raise notice 'pg_cron not installed — enable it and then run: select cron.schedule(''weekly-kickup'', ''0 3 * * 1'', ''select public.run_weekly_kickup()'');';
  end if;
end $$;

-- ------------------------------------------------------------- grants --

revoke execute on function
  public.require_mafia(),
  public.crew_name_for(public.characters),
  public.family_json(uuid),
  public.run_weekly_kickup()
from public;

revoke execute on function
  public.list_families(text),
  public.get_family(uuid),
  public.found_family(text, text, text),
  public.update_family(text, text, text),
  public.disband_family(),
  public.join_family(uuid),
  public.leave_family(),
  public.make_member(uuid),
  public.promote_to_captain(uuid, text),
  public.demote_captain(uuid),
  public.kick_from_family(uuid),
  public.join_crew(uuid),
  public.leave_crew(),
  public.kick_from_crew(uuid),
  public.vote_out_boss(),
  public.family_deposit(bigint),
  public.family_withdraw(bigint),
  public.expand_to_city(text)
from public;

grant execute on function
  public.list_families(text),
  public.get_family(uuid),
  public.found_family(text, text, text),
  public.update_family(text, text, text),
  public.disband_family(),
  public.join_family(uuid),
  public.leave_family(),
  public.make_member(uuid),
  public.promote_to_captain(uuid, text),
  public.demote_captain(uuid),
  public.kick_from_family(uuid),
  public.join_crew(uuid),
  public.leave_crew(),
  public.kick_from_crew(uuid),
  public.vote_out_boss(),
  public.family_deposit(bigint),
  public.family_withdraw(bigint),
  public.expand_to_city(text)
to authenticated;
