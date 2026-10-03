-- ============================================================================
-- Cities of Sin — core schema
--
-- Design rule for the whole project: the client NEVER writes to a gameplay
-- table. RLS grants scoped SELECT and nothing else; every mutation goes through
-- a SECURITY DEFINER function in 20260909000002_functions.sql. If you find
-- yourself adding an INSERT policy for `authenticated`, stop and write an RPC.
-- ============================================================================

-- No extensions. gen_random_uuid() has been core since Postgres 13, and citext
-- would install into the `extensions` schema — invisible to every function in
-- this project, since they all pin search_path to public for safety.

-- ---------------------------------------------------------------- the world --

create table public.cities (
  id               text primary key,
  name             text not null,
  short_code       text not null,
  tagline          text not null,
  signature        text not null,
  signature_label  text not null,
  signature_blurb  text not null,
  sort_order       int  not null default 0
);

comment on table public.cities is
  'Static reference data. Four cities, each with one signature system.';

create table public.districts (
  id          text primary key,
  city_id     text not null references public.cities(id) on delete cascade,
  name        text not null,
  -- Multiplier on crime payouts, racket income and property prices.
  wealth      numeric(4,2) not null default 1.00 check (wealth > 0),
  -- Multiplier on heat gained and arrest odds.
  policing    numeric(4,2) not null default 1.00 check (policing > 0),
  flavour     text not null default '',
  sort_order  int  not null default 0
);

create index districts_city_idx on public.districts (city_id, sort_order);

-- Every tunable number, so balance changes are an UPDATE and not a migration.
create table public.game_config (
  key   text primary key,
  value numeric not null,
  note  text not null default ''
);

-- ------------------------------------------------------------- the account --

-- One row per auth.users row. Holds everything that outlives a character.
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  username     text not null,
  created_at   timestamptz not null default now(),
  is_admin     boolean not null default false,
  -- Moderation. Chat and RPCs check these before doing anything.
  banned_until timestamptz,
  ban_reason   text,
  muted_until  timestamptz,
  constraint username_format check (username ~ '^[A-Za-z0-9_]{3,20}$')
);

-- Case-insensitive uniqueness, without needing citext.
create unique index profiles_username_lower_idx on public.profiles (lower(username));

-- The Quantum Bank: belongs to the account, not the character. It is the only
-- thing that survives assassination, which is what stops permadeath from being
-- a reason to quit. Balance is clean money only.
create table public.vaults (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  balance    bigint not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------- the character --

create type public.life_path as enum ('mafia', 'politician', 'police');

create table public.characters (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references public.profiles(id) on delete cascade,

  -- Johnny 'The Boy' Smith
  first_name   text not null,
  nickname     text,
  last_name    text not null,
  bio          text not null default '',
  avatar_url   text,

  path         public.life_path not null,
  rank_id      text not null,

  city_id      text not null references public.cities(id),
  district_id  text not null references public.districts(id),

  clean        bigint not null default 0 check (clean >= 0),
  dirty        bigint not null default 0 check (dirty >= 0),
  respect      int    not null default 0 check (respect >= 0),
  heat         numeric(6,2) not null default 0 check (heat >= 0),
  nerve        int    not null default 10 check (nerve >= 0),
  nerve_max    int    not null default 10 check (nerve_max > 0),
  health       int    not null default 100 check (health between 0 and 100),

  jail_until   timestamptz,
  jail_city_id text references public.cities(id),

  -- Lazy regeneration: nothing is on a cron, it is all computed on read. Each
  -- pool carries its own clock and advances in whole units, so a player who
  -- logs in every 90 seconds is never cheated out of partial progress.
  nerve_at     timestamptz not null default now(),
  health_at    timestamptz not null default now(),
  heat_at      timestamptz not null default now(),

  -- Rolling laundering allowance, reset lazily once the window has passed.
  laundered_amount bigint not null default 0 check (laundered_amount >= 0),
  laundered_since  timestamptz not null default now(),

  -- Set on creation. Until it passes, this character cannot be attacked and
  -- cannot attack. Stops week-one players being farmed on sight (M4).
  immune_until timestamptz not null default (now() + interval '48 hours'),

  created_at   timestamptz not null default now(),
  died_at      timestamptz,
  death_cause  text,

  constraint name_format  check (first_name ~ '^[A-Za-z''-]{2,16}$'
                             and last_name  ~ '^[A-Za-z''-]{2,16}$'),
  constraint nick_format  check (nickname is null or nickname ~ '^[A-Za-z0-9 ''-]{2,20}$'),
  constraint bio_length   check (char_length(bio) <= 500)
);

-- The anti-alt rule that matters most: one living character per account, ever.
create unique index characters_one_alive_per_profile
  on public.characters (profile_id)
  where died_at is null;

create index characters_district_idx on public.characters (district_id) where died_at is null;
create index characters_respect_idx  on public.characters (respect desc)  where died_at is null;

-- ----------------------------------------------------------------- crime --

create table public.crimes (
  id               text primary key,
  tier             smallint not null check (tier between 1 and 3),
  name             text not null,
  flavour          text not null,
  -- Base dirty money, before the district wealth multiplier.
  payout           int not null check (payout > 0),
  nerve_cost       smallint not null check (nerve_cost > 0),
  cooldown_seconds int not null check (cooldown_seconds >= 0),
  base_success     numeric(3,2) not null check (base_success between 0.05 and 0.99),
  heat             numeric(5,2) not null check (heat >= 0),
  sentence_seconds int not null check (sentence_seconds > 0),
  -- Respect is the M1 progression gate. Tier 2 opens up as you earn it.
  min_respect      int not null default 0,
  -- Null means available in every city; set for regional jobs.
  city_id          text references public.cities(id),
  sort_order       int not null default 0
);

create table public.crime_attempts (
  id              bigint generated always as identity primary key,
  character_id    uuid not null references public.characters(id) on delete cascade,
  crime_id        text not null references public.crimes(id),
  district_id     text not null references public.districts(id),
  success         boolean not null,
  payout          int not null default 0,
  heat_gained     numeric(5,2) not null default 0,
  respect_gained  int not null default 0,
  arrested        boolean not null default false,
  created_at      timestamptz not null default now()
);

-- Serves the history list and, via the same index, the per-crime cooldown check.
create index crime_attempts_recent_idx
  on public.crime_attempts (character_id, crime_id, created_at desc);

-- ------------------------------------------------------------------ chat --

-- Channel ids are derived from who you are, never stored as memberships:
--   'global' | 'city:<city_id>' | 'district:<district_id>' | 'prison:<city_id>'
create table public.chat_messages (
  id           bigint generated always as identity primary key,
  channel      text not null,
  character_id uuid references public.characters(id) on delete set null,
  -- Denormalised so a dead character's messages still read correctly.
  author_name  text not null,
  body         text not null check (char_length(body) between 1 and 500),
  created_at   timestamptz not null default now()
);

create index chat_messages_channel_idx on public.chat_messages (channel, created_at desc);

-- The public activity feed. Scope matches the chat channel format plus
-- 'character:<uuid>' for things only one player should be told about.
create table public.events (
  id         bigint generated always as identity primary key,
  scope      text not null,
  kind       text not null,
  body       text not null,
  payload    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index events_scope_idx on public.events (scope, created_at desc);

-- ------------------------------------------------------------- realtime --

-- Chat and the activity feed push; everything else is request/response.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.chat_messages;
    alter publication supabase_realtime add table public.events;
  end if;
end $$;
