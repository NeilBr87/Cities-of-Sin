-- ============================================================================
-- M3 — Racket operations and district control.
-- ============================================================================

-- --------------------------------------------------------------- helpers --

-- Price is derived from income, so a rebalance of one moves the other.
create or replace function public.racket_price(p_base_income int, p_wealth numeric)
returns bigint
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select round(p_base_income * p_wealth * public.cfg('racket_price_multiple'))::bigint
$$;

-- The odds, in one place, so the number on the button is the number rolled.
create or replace function public.racket_takeover_chance(
  p_defence   int,
  p_unowned   boolean,
  p_backup    int,
  p_defenders int,
  p_respect   int
)
returns numeric
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.clamp(
    public.cfg('racket_takeover_base')
      - (p_defence * 0.035)
      + case when p_unowned then public.cfg('racket_unowned_bonus') else 0 end
      + (least(p_backup, 5) * 0.045)
      - case when p_unowned then 0 else least(p_defenders, 5) * 0.035 end
      + (least(p_respect, 3000) / 3000.0 * 0.10),
    0.05, 0.90
  )
$$;

-- How many of a family's living members are standing in a district right now.
-- This is what "bring a crew" means mechanically: bodies on the ground.
create or replace function public.family_presence(p_family_id uuid, p_district_id text, p_exclude uuid default null)
returns int
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(count(*), 0)::int
  from public.characters
  where family_id = p_family_id
    and district_id = p_district_id
    and died_at is null
    and (jail_until is null or jail_until <= now())
    and (p_exclude is null or id <> p_exclude)
$$;

-- Whoever holds the most rackets holds the district. A tie is contested, and
-- contested means nobody controls it.
create or replace function public.district_control(p_district_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_rows      jsonb;
  v_top_family uuid;
  v_top_held   int;
  v_ties       int;
  v_contested  boolean;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
           'family_id', s.owner_family_id,
           'name', f.name,
           'logo', f.logo,
           'held', s.held
         ) order by s.held desc), '[]'::jsonb)
  into v_rows
  from (
    select owner_family_id, count(*)::int as held
    from public.rackets
    where district_id = p_district_id and owner_family_id is not null
    group by owner_family_id
  ) s
  join public.families f on f.id = s.owner_family_id;

  select owner_family_id, count(*)::int
  into v_top_family, v_top_held
  from public.rackets
  where district_id = p_district_id and owner_family_id is not null
  group by owner_family_id
  order by 2 desc
  limit 1;

  -- Nobody holds anything here yet.
  if v_top_family is null then
    return jsonb_build_object(
      'family_id', null, 'contested', false, 'held', 0,
      'total', (select count(*) from public.rackets where district_id = p_district_id),
      'standings', v_rows
    );
  end if;

  -- Anybody else level with the leader makes it a stalemate.
  select count(*)::int into v_ties
  from (
    select owner_family_id
    from public.rackets
    where district_id = p_district_id and owner_family_id is not null
      and owner_family_id <> v_top_family
    group by owner_family_id
    having count(*) = v_top_held
  ) ties;

  v_contested := v_ties > 0;

  return jsonb_build_object(
    'family_id', case when v_contested then null else v_top_family end,
    'contested', v_contested,
    'held', v_top_held,
    'total', (select count(*) from public.rackets where district_id = p_district_id),
    'standings', v_rows
  );
end;
$$;

-- ------------------------------------------------------------------ reads --

create or replace function public.list_rackets(p_district_id text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c          public.characters%rowtype;
  d          public.districts%rowtype;
  v_district text;
  v_backup   int := 0;
  v_rows     jsonb;
  v_min_rank int;
begin
  c := public.require_character();
  v_district := coalesce(p_district_id, c.district_id);

  select * into d from public.districts where id = v_district;
  if not found then
    raise exception 'No such district.' using errcode = 'P0001';
  end if;

  v_min_rank := public.cfg('racket_min_rank_level')::int;

  if c.family_id is not null then
    v_backup := public.family_presence(c.family_id, v_district, c.id);
  end if;

  select coalesce(jsonb_agg(item order by ord), '[]'::jsonb)
  into v_rows
  from (
    select
      rt.sort_order as ord,
      jsonb_build_object(
        'id', r.id,
        'type_id', rt.id,
        'name', rt.name,
        'blurb', rt.blurb,
        'defence', rt.defence,
        'income', round(rt.base_income * d.wealth),
        'price', public.racket_price(rt.base_income, d.wealth),
        'owner_family_id', r.owner_family_id,
        'owner', case when of.id is null then null else jsonb_build_object(
            'id', of.id, 'name', of.name, 'logo', of.logo
          ) end,
        'owner_crew', case when oc.id is null then null else oc.name end,
        'mine', r.owner_family_id is not null and r.owner_family_id = c.family_id,
        'defenders', case
            when r.owner_family_id is null then 0
            else public.family_presence(r.owner_family_id, v_district, null)
          end,
        'grace_seconds', greatest(0, coalesce(
            ceil(extract(epoch from (r.grace_until - now())))::int, 0)),
        'chance', public.racket_takeover_chance(
            rt.defence,
            r.owner_family_id is null,
            v_backup,
            case when r.owner_family_id is null then 0
                 else public.family_presence(r.owner_family_id, v_district, null) end,
            c.respect
          )
      ) as item
    from public.rackets r
    join public.racket_types rt on rt.id = r.type_id
    left join public.families of on of.id = r.owner_family_id
    left join public.crews oc on oc.id = r.owner_crew_id
    where r.district_id = v_district
  ) rows;

  return jsonb_build_object(
    'district', jsonb_build_object(
      'id', d.id, 'name', d.name, 'wealth', d.wealth, 'policing', d.policing
    ),
    'rackets', v_rows,
    'control', public.district_control(v_district),
    'backup', v_backup,
    'can_act', c.family_id is not null
                 and public.rank_level(c.rank_id) >= v_min_rank
                 and (c.jail_until is null or c.jail_until <= now()),
    'is_boss_or_captain', c.rank_id in ('boss', 'captain'),
    'nerve_cost', public.cfg('racket_takeover_nerve'),
    'treasury', (select treasury from public.families where id = c.family_id)
  );
end;
$$;

-- Rank ordering lives in one place so SQL and the UI cannot disagree.
create or replace function public.rank_level(p_rank_id text)
returns int
language sql
immutable
as $$
  select case p_rank_id
    when 'hoodlum' then 1 when 'associate' then 2 when 'soldier' then 3
    when 'captain' then 4 when 'boss' then 5
    when 'staffer' then 1 when 'councilman' then 2 when 'mayor' then 3 when 'president' then 4
    when 'rookie' then 1 when 'cop' then 2 when 'lieutenant' then 3 when 'chief' then 4
    else 0 end
$$;

-- Control of every district in a city, for the map.
create or replace function public.city_map(p_city_id text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c      public.characters%rowtype;
  v_city text;
  v_rows jsonb;
begin
  c := public.require_character();
  v_city := coalesce(p_city_id, c.city_id);

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', d.id,
           'name', d.name,
           'wealth', d.wealth,
           'policing', d.policing,
           'here', d.id = c.district_id,
           'control', public.district_control(d.id)
         ) order by d.sort_order), '[]'::jsonb)
  into v_rows
  from public.districts d
  where d.city_id = v_city;

  return jsonb_build_object('city_id', v_city, 'districts', v_rows);
end;
$$;

-- ------------------------------------------------------------- buying in --

create or replace function public.buy_racket(p_racket_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c       public.characters%rowtype;
  r       public.rackets%rowtype;
  rt      public.racket_types%rowtype;
  d       public.districts%rowtype;
  v_price bigint;
  v_crew  uuid;
begin
  c := public.require_mafia();

  if c.family_id is null then
    raise exception 'A racket is family business. You do not have one.' using errcode = 'P0001';
  end if;
  if c.rank_id not in ('boss', 'captain') then
    raise exception 'Only a boss or a captain spends family money.' using errcode = 'P0001';
  end if;

  select * into r from public.rackets where id = p_racket_id for update;
  if not found then
    raise exception 'No such racket.' using errcode = 'P0001';
  end if;
  if r.owner_family_id is not null then
    raise exception 'Somebody already holds that. You will have to take it.' using errcode = 'P0001';
  end if;
  if r.district_id <> c.district_id then
    raise exception 'You have to be standing in the district to buy into it.' using errcode = 'P0001';
  end if;

  select * into rt from public.racket_types where id = r.type_id;
  select * into d  from public.districts where id = r.district_id;

  if not exists (
    select 1 from public.family_cities
    where family_id = c.family_id and city_id = d.city_id
  ) then
    raise exception 'Your family does not operate in this city yet.' using errcode = 'P0001';
  end if;

  v_price := public.racket_price(rt.base_income, d.wealth);

  if not exists (
    select 1 from public.families where id = c.family_id and treasury >= v_price
  ) then
    raise exception 'The treasury is short. That costs $%.',
      to_char(v_price, 'FM999,999,999') using errcode = 'P0001';
  end if;

  select id into v_crew from public.crews
  where family_id = c.family_id and district_id = r.district_id;

  update public.families set treasury = treasury - v_price where id = c.family_id;

  update public.rackets set
    owner_family_id = c.family_id,
    owner_crew_id = v_crew,
    taken_at = now(),
    grace_until = now() + (public.cfg('racket_grace_minutes') * interval '1 minute')
  where id = r.id;

  insert into public.events (scope, kind, body, payload)
  select 'district:' || d.id, 'racket_bought',
         f.name || ' bought into the ' || rt.name || ' in ' || d.name || '.',
         jsonb_build_object('racket_id', r.id, 'price', v_price)
  from public.families f where f.id = c.family_id;

  return public.list_rackets(r.district_id);
end;
$$;

-- --------------------------------------------------------- taking it anyway --

create or replace function public.take_racket(p_racket_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c           public.characters%rowtype;
  r           public.rackets%rowtype;
  rt          public.racket_types%rowtype;
  d           public.districts%rowtype;
  v_backup    int;
  v_defenders int := 0;
  v_unowned   boolean;
  v_chance    numeric;
  v_success   boolean;
  v_nerve     int;
  v_heat      numeric;
  v_crew      uuid;
  v_old_owner uuid;
begin
  c := public.require_mafia();

  if c.family_id is null then
    raise exception 'A racket is family business. You do not have one.' using errcode = 'P0001';
  end if;
  if public.rank_level(c.rank_id) < public.cfg('racket_min_rank_level')::int then
    raise exception 'You have to be made before you can move on a racket.' using errcode = 'P0001';
  end if;
  if c.jail_until is not null and c.jail_until > now() then
    raise exception 'You are in a cell.' using errcode = 'P0001';
  end if;

  select * into r from public.rackets where id = p_racket_id for update;
  if not found then
    raise exception 'No such racket.' using errcode = 'P0001';
  end if;
  if r.district_id <> c.district_id then
    raise exception 'You have to be standing in the district.' using errcode = 'P0001';
  end if;
  if r.owner_family_id = c.family_id then
    raise exception 'Your family already holds that one.' using errcode = 'P0001';
  end if;
  if r.grace_until is not null and r.grace_until > now() then
    raise exception 'It has just changed hands. Try again in %s.',
      ceil(extract(epoch from (r.grace_until - now())))::int using errcode = 'P0001';
  end if;

  v_nerve := public.cfg('racket_takeover_nerve')::int;
  if c.nerve < v_nerve then
    raise exception 'Not enough nerve. That takes %.', v_nerve using errcode = 'P0001';
  end if;

  select * into rt from public.racket_types where id = r.type_id;
  select * into d  from public.districts where id = r.district_id;

  if not exists (
    select 1 from public.family_cities
    where family_id = c.family_id and city_id = d.city_id
  ) then
    raise exception 'Your family does not operate in this city yet.' using errcode = 'P0001';
  end if;

  v_unowned := r.owner_family_id is null;
  v_backup  := public.family_presence(c.family_id, r.district_id, c.id);
  if not v_unowned then
    v_defenders := public.family_presence(r.owner_family_id, r.district_id, null);
  end if;

  v_chance  := public.racket_takeover_chance(rt.defence, v_unowned, v_backup, v_defenders, c.respect);
  v_success := random() < v_chance;
  v_heat    := public.cfg('racket_takeover_heat') * d.policing;
  v_old_owner := r.owner_family_id;

  update public.characters set
    nerve = nerve - v_nerve,
    nerve_at = case when nerve >= nerve_max then now() else nerve_at end,
    heat = least(100, heat + v_heat),
    health = case when v_success then health
                  else greatest(1, health - public.cfg('racket_fail_damage')::int) end
  where id = c.id;

  if v_success then
    select id into v_crew from public.crews
    where family_id = c.family_id and district_id = r.district_id;

    update public.rackets set
      owner_family_id = c.family_id,
      owner_crew_id = v_crew,
      taken_at = now(),
      grace_until = now() + (public.cfg('racket_grace_minutes') * interval '1 minute')
    where id = r.id;
  end if;

  insert into public.racket_attempts
    (racket_id, district_id, attacker_id, attacker_family_id, defender_family_id,
     success, chance, backup, defenders)
  values
    (r.id, r.district_id, c.id, c.family_id, v_old_owner,
     v_success, v_chance, least(v_backup, 5), least(v_defenders, 5));

  insert into public.events (scope, kind, body, payload)
  select 'district:' || d.id,
         case when v_success then 'racket_taken' else 'racket_defended' end,
         case when v_success
              then af.name || ' took the ' || rt.name || ' in ' || d.name ||
                   coalesce(' off ' || df.name, '') || '.'
              else af.name || ' moved on the ' || rt.name || ' in ' || d.name || ' and came off worse.'
         end,
         jsonb_build_object('racket_id', r.id, 'success', v_success)
  from public.families af
  left join public.families df on df.id = v_old_owner
  where af.id = c.family_id;

  -- Tell the family that just lost it, so a defender has something to react to.
  if v_success and v_old_owner is not null then
    insert into public.events (scope, kind, body, payload)
    select 'character:' || m.id, 'racket_lost',
           'You lost the ' || rt.name || ' in ' || d.name || '.',
           jsonb_build_object('racket_id', r.id)
    from public.characters m
    where m.family_id = v_old_owner and m.died_at is null;
  end if;

  return jsonb_build_object(
    'success', v_success,
    'chance', v_chance,
    'backup', v_backup,
    'defenders', v_defenders,
    'racket', rt.name,
    'district', d.name,
    'heat_gained', round(v_heat, 1),
    'rackets', public.list_rackets(r.district_id),
    'me', public.get_me()
  );
end;
$$;

-- ------------------------------------------------------- weekly racket pay --

-- Income is split: a share to the holding crew's captain as dirty money (it is
-- skim), the rest into the family treasury as clean (it is a business). A racket
-- the family holds with no crew in the district pays entirely to the treasury.
create or replace function public.run_weekly_rackets()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r            record;
  v_week       date := date_trunc('week', now())::date;
  v_share      numeric := public.cfg('racket_captain_share');
  v_income     bigint;
  v_to_captain bigint;
  v_to_family  bigint;
  v_paid       int := 0;
  v_total      bigint := 0;
begin
  for r in
    select rk.id, rk.owner_family_id, rt.base_income, d.wealth,
           (select cr.captain_id from public.crews cr where cr.id = rk.owner_crew_id) as captain_id
    from public.rackets rk
    join public.racket_types rt on rt.id = rk.type_id
    join public.districts d on d.id = rk.district_id
    join public.families f on f.id = rk.owner_family_id and f.disbanded_at is null
    where rk.owner_family_id is not null
      and (rk.last_paid_week is null or rk.last_paid_week < v_week)
    for update of rk
  loop
    v_income := round(r.base_income * r.wealth);

    if r.captain_id is not null then
      v_to_captain := floor(v_income * v_share);
      v_to_family  := v_income - v_to_captain;
      update public.characters set dirty = dirty + v_to_captain where id = r.captain_id;
    else
      v_to_captain := 0;
      v_to_family  := v_income;
    end if;

    update public.families set treasury = treasury + v_to_family where id = r.owner_family_id;
    update public.rackets set last_paid_week = v_week where id = r.id;

    v_paid  := v_paid + 1;
    v_total := v_total + v_income;
  end loop;

  return jsonb_build_object('week_start', v_week, 'rackets_paid', v_paid, 'total', v_total);
end;
$$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('weekly-rackets')
      where exists (select 1 from cron.job where jobname = 'weekly-rackets');
    -- Rackets pay out five minutes before the kick-up collects, so that money
    -- is in hand and gets taxed in the same week it was earned.
    perform cron.schedule('weekly-rackets', '55 2 * * 1', 'select public.run_weekly_rackets()');
  else
    raise notice 'pg_cron not installed — enable it, then schedule weekly-rackets and weekly-kickup.';
  end if;
end $$;

-- -------------------------------------------------------------- grants --

revoke execute on function
  public.racket_price(int, numeric),
  public.racket_takeover_chance(int, boolean, int, int, int),
  public.family_presence(uuid, text, uuid),
  public.run_weekly_rackets()
from public, anon, authenticated;

revoke execute on function
  public.list_rackets(text),
  public.district_control(text),
  public.city_map(text),
  public.rank_level(text),
  public.buy_racket(uuid),
  public.take_racket(uuid)
from public, anon, authenticated;

grant execute on function
  public.list_rackets(text),
  public.district_control(text),
  public.city_map(text),
  public.rank_level(text),
  public.buy_racket(uuid),
  public.take_racket(uuid)
to authenticated;
