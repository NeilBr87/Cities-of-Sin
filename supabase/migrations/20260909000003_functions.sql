-- ============================================================================
-- The game server.
--
-- Every one of these is SECURITY DEFINER with a pinned search_path, so they run
-- with the privileges needed to write gameplay tables that RLS otherwise seals
-- shut. They are the only way in. Each validates, mutates and returns in one
-- transaction, which is what makes "pay out, add heat, spend nerve, maybe jail"
-- an atomic outcome rather than four things that can half-happen.
-- ============================================================================

-- ---------------------------------------------------------------- helpers --

create or replace function public.cfg(p_key text)
returns numeric
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select value from public.game_config where key = p_key
$$;

create or replace function public.clamp(v numeric, lo numeric, hi numeric)
returns numeric
language sql
immutable
as $$ select greatest(lo, least(hi, v)) $$;

-- Johnny 'The Boy' Smith
create or replace function public.display_name(c public.characters)
returns text
language sql
immutable
as $$
  select btrim(
    c.first_name
    || case when c.nickname is null or c.nickname = '' then ' ' else ' ''' || c.nickname || ''' ' end
    || c.last_name
  )
$$;

create or replace function public.username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p_username ~ '^[A-Za-z0-9_]{3,20}$'
     and not exists (
       select 1 from public.profiles where lower(username) = lower(p_username)
     )
$$;

-- ------------------------------------------------------ account bootstrap --

-- A new auth.users row gets a profile and an empty vault, atomically with the
-- signup itself. The username arrives in the signup metadata.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_base    text;
  v_try     text;
  v_attempt int := 0;
begin
  v_base := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'username'), ''),
    'player_' || substr(replace(new.id::text, '-', ''), 1, 10)
  );

  -- Fall back to a suffixed name rather than failing the whole signup. The
  -- client checks availability first; this only catches the race between two
  -- people claiming the same handle in the same second.
  if v_base !~ '^[A-Za-z0-9_]{3,20}$' then
    v_base := 'player_' || substr(replace(new.id::text, '-', ''), 1, 10);
  end if;

  loop
    v_try := case when v_attempt = 0
                  then v_base
                  else left(v_base, 15) || floor(random() * 9000 + 1000)::int::text
             end;
    begin
      insert into public.profiles (id, username) values (new.id, v_try);
      exit;
    exception when unique_violation then
      v_attempt := v_attempt + 1;
      if v_attempt > 5 then
        raise exception 'Could not allocate a username.' using errcode = 'P0001';
      end if;
    end;
  end loop;

  insert into public.vaults (profile_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------ the tick --

-- Applies everything that happens to a character purely through the passage of
-- time: nerve and health regenerate, heat cools, sentences end. Called at the
-- top of every RPC so the player's state is always current before a rule is
-- checked against it. Returns the character with the row still locked.
create or replace function public.apply_tick(p_character_id uuid)
returns public.characters
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c            public.characters%rowtype;
  v_rate       numeric;
  v_units      int;
  v_hours      numeric;
begin
  select * into c from public.characters where id = p_character_id for update;
  if not found then
    raise exception 'No such character.' using errcode = 'P0001';
  end if;

  -- Nerve, in whole points.
  if c.nerve < c.nerve_max then
    v_rate  := public.cfg('nerve_regen_seconds');
    v_units := floor(extract(epoch from (now() - c.nerve_at)) / v_rate);
    if v_units > 0 then
      c.nerve    := least(c.nerve_max, c.nerve + v_units);
      c.nerve_at := c.nerve_at + ((v_units * v_rate)::double precision * interval '1 second');
    end if;
  end if;
  if c.nerve >= c.nerve_max then
    c.nerve_at := now();
  end if;

  -- Health, in whole points.
  if c.health < 100 then
    v_rate  := public.cfg('health_regen_seconds');
    v_units := floor(extract(epoch from (now() - c.health_at)) / v_rate);
    if v_units > 0 then
      c.health    := least(100, c.health + v_units);
      c.health_at := c.health_at + ((v_units * v_rate)::double precision * interval '1 second');
    end if;
  end if;
  if c.health >= 100 then
    c.health_at := now();
  end if;

  -- Heat cools continuously.
  if c.heat > 0 then
    v_hours := extract(epoch from (now() - c.heat_at)) / 3600.0;
    c.heat  := greatest(0, c.heat - (v_hours * public.cfg('heat_decay_per_hour')));
  end if;
  c.heat_at := now();

  -- Time served.
  if c.jail_until is not null and c.jail_until <= now() then
    c.jail_until   := null;
    c.jail_city_id := null;
  end if;

  -- The laundering window.
  if now() - c.laundered_since > (public.cfg('launder_window_hours')::double precision * interval '1 hour') then
    c.laundered_amount := 0;
    c.laundered_since  := now();
  end if;

  update public.characters set
    nerve = c.nerve, nerve_at = c.nerve_at,
    health = c.health, health_at = c.health_at,
    heat = c.heat, heat_at = c.heat_at,
    jail_until = c.jail_until, jail_city_id = c.jail_city_id,
    laundered_amount = c.laundered_amount, laundered_since = c.laundered_since
  where id = c.id;

  return c;
end;
$$;

-- The caller's living character, ticked and locked. Raises if there isn't one,
-- which is how every gameplay RPC starts.
create or replace function public.require_character()
returns public.characters
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in.' using errcode = 'P0001';
  end if;
  if public.is_banned() then
    raise exception 'This account is suspended.' using errcode = 'P0001';
  end if;

  select id into v_id
  from public.characters
  where profile_id = auth.uid() and died_at is null
  limit 1;

  if v_id is null then
    raise exception 'You do not have a living character.' using errcode = 'P0001';
  end if;

  return public.apply_tick(v_id);
end;
$$;

-- ------------------------------------------------------------- read: me --

-- One round-trip for everything the shell needs to render.
create or replace function public.get_me()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c        public.characters%rowtype;
  v_id     uuid;
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Not signed in.' using errcode = 'P0001';
  end if;

  select id into v_id
  from public.characters
  where profile_id = auth.uid() and died_at is null
  limit 1;

  -- Signed in with no character yet is a normal state, not an error: the client
  -- routes to character creation on a null character.
  if v_id is null then
    select jsonb_build_object(
      'character', null,
      'profile', to_jsonb(p) - 'id',
      'vault', coalesce(v.balance, 0),
      'has_dead_character', exists (
        select 1 from public.characters
        where profile_id = auth.uid() and died_at is not null
      )
    )
    into v_result
    from public.profiles p
    left join public.vaults v on v.profile_id = p.id
    where p.id = auth.uid();
    return v_result;
  end if;

  c := public.apply_tick(v_id);

  select jsonb_build_object(
    'character', to_jsonb(c)
      || jsonb_build_object(
           'display_name', public.display_name(c),
           'jailed', c.jail_until is not null and c.jail_until > now(),
           'jail_seconds_left', greatest(0, extract(epoch from (coalesce(c.jail_until, now()) - now()))::int),
           'immune', c.immune_until > now()
         ),
    'city', to_jsonb(ct),
    'district', to_jsonb(d),
    'profile', to_jsonb(p) - 'id',
    'vault', coalesce(vt.balance, 0),
    'server_time', now()
  )
  into v_result
  from public.cities ct
  join public.districts d on d.id = c.district_id
  join public.profiles p on p.id = c.profile_id
  left join public.vaults vt on vt.profile_id = c.profile_id
  where ct.id = c.city_id;

  return v_result;
end;
$$;

-- ------------------------------------------------- create a character --

create or replace function public.create_character(
  p_first_name text,
  p_last_name  text,
  p_nickname   text,
  p_path       public.life_path,
  p_city_id    text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_district_id text;
  v_rank        text;
  v_new_id      uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in.' using errcode = 'P0001';
  end if;
  if public.is_banned() then
    raise exception 'This account is suspended.' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.characters
    where profile_id = auth.uid() and died_at is null
  ) then
    raise exception 'You already have a living character.' using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.cities where id = p_city_id) then
    raise exception 'That city does not exist.' using errcode = 'P0001';
  end if;

  -- Start in the least policed district in the chosen city: a soft landing.
  select id into v_district_id
  from public.districts
  where city_id = p_city_id
  order by policing asc, sort_order asc
  limit 1;

  v_rank := case p_path
              when 'mafia'      then 'hoodlum'
              when 'politician' then 'staffer'
              when 'police'     then 'rookie'
            end;

  insert into public.characters (
    profile_id, first_name, last_name, nickname, path, rank_id,
    city_id, district_id, clean, nerve, nerve_max
  ) values (
    auth.uid(), btrim(p_first_name), btrim(p_last_name), nullif(btrim(coalesce(p_nickname, '')), ''),
    p_path, v_rank, p_city_id, v_district_id,
    public.cfg('starting_clean')::bigint,
    public.cfg('nerve_max')::int,
    public.cfg('nerve_max')::int
  )
  returning id into v_new_id;

  insert into public.events (scope, kind, body)
  select 'city:' || p_city_id, 'arrival',
         public.display_name(c) || ' stepped off the bus in ' || ci.name || '.'
  from public.characters c join public.cities ci on ci.id = c.city_id
  where c.id = v_new_id;

  return public.get_me();
end;
$$;

-- ------------------------------------------------------------- crime --

-- The odds, exposed so the client can show them before you commit. Kept in one
-- function so the number on the button and the number that gets rolled can
-- never drift apart.
create or replace function public.crime_success_chance(
  c public.characters,
  cr public.crimes,
  d public.districts
)
returns numeric
language sql
stable
as $$
  select public.clamp(
    cr.base_success
      - (d.policing * 0.05)
      - ((c.heat / 100.0) * 0.15)
      + (least(c.respect, 2000) / 2000.0 * 0.10),
    0.05, 0.95
  )
$$;

-- What the player can attempt right now, with live odds and cooldowns.
create or replace function public.list_crimes()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c      public.characters%rowtype;
  d      public.districts%rowtype;
  result jsonb;
begin
  c := public.require_character();
  select * into d from public.districts where id = c.district_id;

  -- Ordered inside the aggregate, and by the numeric column rather than by the
  -- jsonb text — otherwise crime 10 sorts before crime 2.
  select coalesce(jsonb_agg(item order by ord), '[]'::jsonb)
  into result
  from (
    select
      cr.sort_order as ord,
      to_jsonb(cr)
        || jsonb_build_object(
             'chance', public.crime_success_chance(c, cr, d),
             'expected_payout', round(cr.payout * d.wealth),
             'locked', c.respect < cr.min_respect,
             'cooldown_left', greatest(0, coalesce((
               select ceil(extract(epoch from (
                 ca.created_at + (cr.cooldown_seconds * interval '1 second') - now()
               )))::int
               from public.crime_attempts ca
               where ca.character_id = c.id and ca.crime_id = cr.id
               order by ca.created_at desc
               limit 1
             ), 0))
           ) as item
    from public.crimes cr
    where cr.city_id is null or cr.city_id = c.city_id
  ) rows;

  return result;
end;
$$;

create or replace function public.commit_crime(p_crime_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c            public.characters%rowtype;
  cr           public.crimes%rowtype;
  d            public.districts%rowtype;
  v_last       timestamptz;
  v_chance     numeric;
  v_success    boolean;
  v_payout     int    := 0;
  v_respect    int    := 0;
  v_heat       numeric;
  v_arrested   boolean := false;
  v_sentence   int    := 0;
  v_arrest_odds numeric;
begin
  c := public.require_character();

  if c.jail_until is not null and c.jail_until > now() then
    raise exception 'You are in a cell. Nothing to steal in here.' using errcode = 'P0001';
  end if;

  select * into cr from public.crimes where id = p_crime_id;
  if not found then
    raise exception 'No such crime.' using errcode = 'P0001';
  end if;

  if cr.city_id is not null and cr.city_id <> c.city_id then
    raise exception 'That job only runs in one city, and you are not in it.' using errcode = 'P0001';
  end if;

  if c.respect < cr.min_respect then
    raise exception 'Nobody would trust you with that yet. Needs % respect.', cr.min_respect
      using errcode = 'P0001';
  end if;

  if c.nerve < cr.nerve_cost then
    raise exception 'Not enough nerve. That job takes %.', cr.nerve_cost using errcode = 'P0001';
  end if;

  select created_at into v_last
  from public.crime_attempts
  where character_id = c.id and crime_id = cr.id
  order by created_at desc
  limit 1;

  if v_last is not null and now() < v_last + (cr.cooldown_seconds * interval '1 second') then
    raise exception 'Too soon. That one needs to cool off.' using errcode = 'P0001';
  end if;

  select * into d from public.districts where id = c.district_id;

  v_chance  := public.crime_success_chance(c, cr, d);
  v_success := random() < v_chance;

  -- Heat: a botched job is always louder than a clean one.
  v_heat := cr.heat * d.policing
            * case when v_success then 1 else public.cfg('fail_heat_multiplier') end;

  if v_success then
    -- Variance keeps identical jobs from paying identical money.
    v_payout  := round(cr.payout * d.wealth * (0.85 + random() * 0.30));
    v_respect := case cr.tier when 1 then 2 when 2 then 12 else 60 end;
  else
    -- Failing is how you get caught. Heat makes it much worse.
    v_arrest_odds := public.clamp(
      (public.cfg('arrest_on_fail_base') + (c.heat / 100.0) * 0.35) * d.policing,
      0.02, 0.85
    );
    if random() < v_arrest_odds then
      v_arrested := true;
      v_sentence := public.clamp(
        cr.sentence_seconds,
        public.cfg('sentence_min_seconds'),
        public.cfg('sentence_max_seconds')
      )::int;
    end if;
  end if;

  update public.characters set
    nerve   = nerve - cr.nerve_cost,
    -- Spending nerve restarts the regen clock only if the pool was full.
    nerve_at = case when nerve >= nerve_max then now() else nerve_at end,
    dirty   = dirty + v_payout,
    respect = respect + v_respect,
    heat    = least(100, heat + v_heat),
    jail_until   = case when v_arrested then now() + (v_sentence * interval '1 second') else jail_until end,
    jail_city_id = case when v_arrested then c.city_id else jail_city_id end
  where id = c.id;

  insert into public.crime_attempts
    (character_id, crime_id, district_id, success, payout, heat_gained, respect_gained, arrested)
  values
    (c.id, cr.id, d.id, v_success, v_payout, v_heat, v_respect, v_arrested);

  if v_arrested then
    insert into public.events (scope, kind, body, payload)
    values ('district:' || d.id, 'arrest',
            public.display_name(c) || ' got picked up in ' || d.name || '.',
            jsonb_build_object('crime', cr.name));
  end if;

  return jsonb_build_object(
    'success', v_success,
    'arrested', v_arrested,
    'payout', v_payout,
    'respect_gained', v_respect,
    'heat_gained', round(v_heat, 1),
    'sentence_seconds', v_sentence,
    'chance', v_chance,
    'crime', cr.name,
    'flavour', cr.flavour,
    'me', public.get_me()
  );
end;
$$;

-- ------------------------------------------------------------ movement --

create or replace function public.move_to_district(p_district_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c public.characters%rowtype;
  d public.districts%rowtype;
begin
  c := public.require_character();

  if c.jail_until is not null and c.jail_until > now() then
    raise exception 'You are in a cell.' using errcode = 'P0001';
  end if;

  select * into d from public.districts where id = p_district_id;
  if not found then
    raise exception 'No such district.' using errcode = 'P0001';
  end if;
  if d.city_id <> c.city_id then
    raise exception 'That district is in another city. You need a plane ticket.'
      using errcode = 'P0001';
  end if;
  if d.id = c.district_id then
    raise exception 'You are already there.' using errcode = 'P0001';
  end if;

  update public.characters set district_id = d.id where id = c.id;
  return public.get_me();
end;
$$;

create or replace function public.fly_to_city(p_city_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c             public.characters%rowtype;
  v_cost        bigint;
  v_district_id text;
begin
  c := public.require_character();

  if c.jail_until is not null and c.jail_until > now() then
    raise exception 'You are in a cell.' using errcode = 'P0001';
  end if;
  if p_city_id = c.city_id then
    raise exception 'You are already in that city.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.cities where id = p_city_id) then
    raise exception 'No such city.' using errcode = 'P0001';
  end if;

  v_cost := public.cfg('flight_cost')::bigint;
  if c.clean < v_cost then
    raise exception 'A ticket costs $%. You cannot cover it with clean money.',
      to_char(v_cost, 'FM999,999,999') using errcode = 'P0001';
  end if;

  select id into v_district_id
  from public.districts
  where city_id = p_city_id
  order by policing asc, sort_order asc
  limit 1;

  update public.characters set
    clean = clean - v_cost,
    city_id = p_city_id,
    district_id = v_district_id
  where id = c.id;

  return public.get_me();
end;
$$;

-- -------------------------------------------------------------- money --

-- Dirty money buys nothing. This is the only way to make it real, and the rate
-- is punishing on purpose until fronts arrive (M7).
create or replace function public.launder(p_amount bigint)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c        public.characters%rowtype;
  v_rate   numeric;
  v_cap    bigint;
  v_out    bigint;
begin
  c := public.require_character();

  if p_amount <= 0 then
    raise exception 'Launder how much?' using errcode = 'P0001';
  end if;
  if c.dirty < p_amount then
    raise exception 'You do not have that much dirty money.' using errcode = 'P0001';
  end if;

  v_cap := public.cfg('launder_cap')::bigint;
  if c.laundered_amount + p_amount > v_cap then
    raise exception 'Washing that much would attract attention. $% left in this window.',
      to_char(greatest(0, v_cap - c.laundered_amount), 'FM999,999,999') using errcode = 'P0001';
  end if;

  v_rate := public.cfg('launder_rate');
  v_out  := floor(p_amount * v_rate);

  update public.characters set
    dirty = dirty - p_amount,
    clean = clean + v_out,
    laundered_amount = laundered_amount + p_amount
  where id = c.id;

  return jsonb_build_object('spent', p_amount, 'received', v_out, 'me', public.get_me());
end;
$$;

create or replace function public.vault_deposit(p_amount bigint)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c     public.characters%rowtype;
  v_fee numeric;
  v_net bigint;
begin
  c := public.require_character();

  if p_amount < public.cfg('vault_min_deposit') then
    raise exception 'The vault does not take deposits under $%.',
      to_char(public.cfg('vault_min_deposit'), 'FM999,999,999') using errcode = 'P0001';
  end if;
  if c.clean < p_amount then
    raise exception 'Not enough clean money.' using errcode = 'P0001';
  end if;

  v_fee := public.cfg('vault_deposit_fee');
  v_net := floor(p_amount * (1 - v_fee));

  update public.characters set clean = clean - p_amount where id = c.id;
  update public.vaults
    set balance = balance + v_net, updated_at = now()
    where profile_id = c.profile_id;

  return jsonb_build_object('deposited', p_amount, 'banked', v_net, 'me', public.get_me());
end;
$$;

create or replace function public.vault_withdraw(p_amount bigint)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c public.characters%rowtype;
begin
  c := public.require_character();

  if p_amount <= 0 then
    raise exception 'Withdraw how much?' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.vaults where profile_id = c.profile_id and balance >= p_amount
  ) then
    raise exception 'The vault does not hold that much.' using errcode = 'P0001';
  end if;

  update public.vaults
    set balance = balance - p_amount, updated_at = now()
    where profile_id = c.profile_id;
  update public.characters set clean = clean + p_amount where id = c.id;

  return jsonb_build_object('withdrawn', p_amount, 'me', public.get_me());
end;
$$;

-- ------------------------------------------------------------- prison --

create or replace function public.post_bail()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c      public.characters%rowtype;
  v_left int;
  v_cost bigint;
begin
  c := public.require_character();

  if c.jail_until is null or c.jail_until <= now() then
    raise exception 'You are not in a cell.' using errcode = 'P0001';
  end if;

  v_left := ceil(extract(epoch from (c.jail_until - now())))::int;
  v_cost := (v_left * public.cfg('bail_per_second'))::bigint;

  if c.clean < v_cost then
    raise exception 'Bail is $%. Clean money only — the court does not take a paper bag.',
      to_char(v_cost, 'FM999,999,999') using errcode = 'P0001';
  end if;

  update public.characters set
    clean = clean - v_cost,
    jail_until = null,
    jail_city_id = null
  where id = c.id;

  return jsonb_build_object('paid', v_cost, 'me', public.get_me());
end;
$$;

-- --------------------------------------------------------------- chat --

create or replace function public.send_chat(p_channel text, p_body text)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c        public.characters%rowtype;
  v_muted  timestamptz;
  v_recent int;
  v_id     bigint;
begin
  c := public.require_character();

  select muted_until into v_muted from public.profiles where id = auth.uid();
  if v_muted is not null and v_muted > now() then
    raise exception 'You are muted until %.', to_char(v_muted, 'HH24:MI') using errcode = 'P0001';
  end if;

  if not public.can_read_channel(p_channel) then
    raise exception 'You are not in that room.' using errcode = 'P0001';
  end if;

  if btrim(coalesce(p_body, '')) = '' then
    raise exception 'Say something.' using errcode = 'P0001';
  end if;

  -- Flood control.
  select count(*) into v_recent
  from public.chat_messages
  where character_id = c.id and created_at > now() - interval '10 seconds';

  if v_recent >= public.cfg('chat_burst_limit') then
    raise exception 'Slow down.' using errcode = 'P0001';
  end if;

  insert into public.chat_messages (channel, character_id, author_name, body)
  values (p_channel, c.id, public.display_name(c), left(btrim(p_body), 500))
  returning id into v_id;

  return v_id;
end;
$$;

-- ------------------------------------------------------------ profile --

create or replace function public.update_bio(p_bio text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c public.characters%rowtype;
begin
  c := public.require_character();
  update public.characters set bio = left(coalesce(p_bio, ''), 500) where id = c.id;
  return public.get_me();
end;
$$;

-- --------------------------------------------------------- leaderboard --

create or replace function public.leaderboard(p_metric text default 'respect')
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  result jsonb;
begin
  if p_metric not in ('respect', 'clean', 'heat') then
    raise exception 'Unknown leaderboard.' using errcode = 'P0001';
  end if;

  select coalesce(jsonb_agg(r order by ord desc), '[]'::jsonb) into result
  from (
    select
      case p_metric
        when 'respect' then c.respect::numeric
        when 'clean'   then c.clean::numeric
        else                c.heat
      end as ord,
      jsonb_build_object(
        'id', c.id,
        'name', public.display_name(c),
        'path', c.path,
        'rank_id', c.rank_id,
        'city', ci.name,
        'respect', c.respect,
        'clean', c.clean,
        'heat', round(c.heat)
      ) as r
    from public.characters c
    join public.cities ci on ci.id = c.city_id
    where c.died_at is null
    order by ord desc
    limit 50
  ) rows;

  return result;
end;
$$;

-- ------------------------------------------------------------- grants --

-- Postgres grants EXECUTE to PUBLIC on every new function, and anon and
-- authenticated both inherit PUBLIC — so revoking from those two roles alone
-- would change nothing. Every revoke below therefore names PUBLIC.

-- Internal helpers: reachable only from inside other SECURITY DEFINER
-- functions, which run as the definer and need no grant at all.
revoke execute on function
  public.apply_tick(uuid),
  public.require_character(),
  public.cfg(text),
  public.clamp(numeric, numeric, numeric),
  public.display_name(public.characters),
  public.crime_success_chance(public.characters, public.crimes, public.districts)
from public;

-- Gameplay: signed-in callers only.
revoke execute on function
  public.get_me(),
  public.create_character(text, text, text, public.life_path, text),
  public.list_crimes(),
  public.commit_crime(text),
  public.move_to_district(text),
  public.fly_to_city(text),
  public.launder(bigint),
  public.vault_deposit(bigint),
  public.vault_withdraw(bigint),
  public.post_bail(),
  public.send_chat(text, text),
  public.update_bio(text),
  public.leaderboard(text)
from public;

grant execute on function
  public.get_me(),
  public.create_character(text, text, text, public.life_path, text),
  public.list_crimes(),
  public.commit_crime(text),
  public.move_to_district(text),
  public.fly_to_city(text),
  public.launder(bigint),
  public.vault_deposit(bigint),
  public.vault_withdraw(bigint),
  public.post_bail(),
  public.send_chat(text, text),
  public.update_bio(text),
  public.leaderboard(text)
to authenticated;

-- These two are called from inside RLS policy expressions, which evaluate as
-- the querying role rather than as a definer. Without this grant every policy
-- that uses them fails closed and the game reads as empty.
grant execute on function
  public.can_read_channel(text),
  public.current_character_id(),
  public.is_banned()
to authenticated;

-- The signup page needs this one before a session exists.
grant execute on function public.username_available(text) to anon, authenticated;
