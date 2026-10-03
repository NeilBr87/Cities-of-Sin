-- ============================================================================
-- Row Level Security
--
-- Read access is scoped here. Write access is granted NOWHERE — there is not a
-- single INSERT/UPDATE/DELETE policy in this file, and that is deliberate. With
-- RLS enabled and no write policy, every write from the browser is rejected,
-- including a write with a stolen anon key. Mutations happen only inside the
-- SECURITY DEFINER functions in the next migration.
-- ============================================================================

-- ------------------------------------------------------- policy helpers --

-- The caller's living character, or null. SECURITY DEFINER so that policies on
-- other tables can ask "where is this player?" without needing their own read
-- access to characters.
create or replace function public.current_character_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select c.id
  from public.characters c
  where c.profile_id = auth.uid()
    and c.died_at is null
  limit 1
$$;

create or replace function public.is_banned()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select p.banned_until > now() from public.profiles p where p.id = auth.uid()),
    false
  )
$$;

-- Channels are derived from who and where you are. A player in a cell trades
-- their district room for the prison block.
create or replace function public.can_read_channel(p_channel text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  c public.characters%rowtype;
  jailed boolean;
begin
  if p_channel = 'global' then
    return auth.uid() is not null;
  end if;

  select * into c
  from public.characters
  where profile_id = auth.uid() and died_at is null
  limit 1;

  if not found then
    return false;
  end if;

  jailed := c.jail_until is not null and c.jail_until > now();

  return case
    when p_channel = 'city:'     || c.city_id     then true
    when p_channel = 'district:' || c.district_id then not jailed
    when p_channel = 'prison:'   || coalesce(c.jail_city_id, '') then jailed
    else false
  end;
end;
$$;

-- ------------------------------------------- reference data: world-readable --

alter table public.cities      enable row level security;
alter table public.districts   enable row level security;
alter table public.crimes      enable row level security;
alter table public.game_config enable row level security;

-- Readable signed-out too: the landing page shows the world before you join.
create policy cities_read      on public.cities      for select to anon, authenticated using (true);
create policy districts_read   on public.districts   for select to anon, authenticated using (true);
create policy crimes_read      on public.crimes      for select to anon, authenticated using (true);
create policy game_config_read on public.game_config for select to anon, authenticated using (true);

-- ------------------------------------------------------------- accounts --

alter table public.profiles enable row level security;
alter table public.vaults   enable row level security;

-- Usernames are public — they appear on profiles and leaderboards.
create policy profiles_read on public.profiles
  for select to authenticated using (true);

-- Your vault balance is yours alone. This is the one number nobody else sees,
-- because knowing what a player has banked would tell you what killing them is
-- worth.
create policy vaults_read_own on public.vaults
  for select to authenticated using (profile_id = auth.uid());

-- ----------------------------------------------------------- characters --

alter table public.characters enable row level security;

-- Characters are public by design. This is a game about knowing who is rich,
-- who is hot and who is standing in your district. Anything that must stay
-- secret lives in another table (see vaults).
create policy characters_read on public.characters
  for select to authenticated using (true);

-- --------------------------------------------------------------- crime --

alter table public.crime_attempts enable row level security;

-- Your own rap sheet only. Police get access to a filtered view in M5 rather
-- than to the raw log.
create policy crime_attempts_read_own on public.crime_attempts
  for select to authenticated
  using (character_id = public.current_character_id());

-- ---------------------------------------------------------------- chat --

alter table public.chat_messages enable row level security;
alter table public.events        enable row level security;

create policy chat_read_own_channels on public.chat_messages
  for select to authenticated
  using (public.can_read_channel(channel));

create policy events_read_in_scope on public.events
  for select to authenticated
  using (
    scope = 'global'
    or public.can_read_channel(scope)
    or scope = 'character:' || coalesce(public.current_character_id()::text, '')
  );

-- ------------------------------------------------------------- grants --

-- Belt and braces: revoke the table-level write privileges the `authenticated`
-- role inherits by default, so a missing RLS policy can never become a hole.
revoke insert, update, delete on all tables in schema public from anon, authenticated;

alter default privileges in schema public
  revoke insert, update, delete on tables from anon, authenticated;
