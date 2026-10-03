-- ============================================================================
-- M2 — Families and crews.
--
-- The hierarchy the whole game hangs off: five families per city, first come
-- first served; a boss who collects from captains; captains who run one crew per
-- district and collect from their soldiers; associates who are inside but not
-- yet made.
--
-- Same rule as everywhere else: reads via RLS, writes only via the RPCs in the
-- next migration.
-- ============================================================================

create table public.families (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  motto        text not null default '',
  -- One or two emoji. Cheap, requires no upload pipeline, reads well at 12px.
  logo         text not null default '🎩',
  -- Where the family was founded. It can operate elsewhere (see family_cities)
  -- but this is the seat, and it is the city whose five slots it occupies.
  city_id      text not null references public.cities(id),
  boss_id      uuid references public.characters(id) on delete set null,
  treasury     bigint not null default 0 check (treasury >= 0),
  founded_at   timestamptz not null default now(),
  disbanded_at timestamptz,

  constraint family_name_format check (char_length(btrim(name)) between 3 and 32),
  constraint family_motto_length check (char_length(motto) <= 120),
  constraint family_logo_length check (char_length(logo) between 1 and 8)
);

-- Names are claimed globally, not per city — two Genovese families in one world
-- would make every chat message ambiguous.
create unique index families_name_lower_idx
  on public.families (lower(name)) where disbanded_at is null;

create index families_city_idx on public.families (city_id) where disbanded_at is null;

-- Which cities a family operates in. The home city is inserted on founding;
-- others are bought with expand_to_city().
create table public.family_cities (
  family_id  uuid not null references public.families(id) on delete cascade,
  city_id    text not null references public.cities(id),
  opened_at  timestamptz not null default now(),
  primary key (family_id, city_id)
);

create table public.crews (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.families(id) on delete cascade,
  captain_id  uuid not null references public.characters(id) on delete cascade,
  district_id text not null references public.districts(id),
  -- Denormalised from the captain's surname at creation: "Genovese Crew".
  name        text not null,
  created_at  timestamptz not null default now()
);

-- The rule that turns territory into a map problem rather than a number: a
-- family that wants more crews has to spread out.
create unique index crews_one_per_district on public.crews (family_id, district_id);
create index crews_family_idx on public.crews (family_id);

-- Membership lives on the character.
alter table public.characters
  add column family_id uuid references public.families(id) on delete set null,
  add column crew_id   uuid references public.crews(id) on delete set null,
  add column joined_family_at timestamptz;

create index characters_family_idx on public.characters (family_id) where died_at is null;
create index characters_crew_idx   on public.characters (crew_id)   where died_at is null;

-- A boss can be voted down to soldier by a majority of the family. Votes are
-- one per member and are cleared whenever the bossship changes.
create table public.boss_votes (
  family_id  uuid not null references public.families(id) on delete cascade,
  voter_id   uuid not null references public.characters(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (family_id, voter_id)
);

-- The weekly kick-up ledger. Every transfer is recorded so a boss can see who
-- actually paid, and so the cron can be made idempotent per week.
create table public.kickups (
  id            bigint generated always as identity primary key,
  week_start    date not null,
  family_id     uuid not null references public.families(id) on delete cascade,
  from_id       uuid not null references public.characters(id) on delete cascade,
  to_id         uuid references public.characters(id) on delete set null,
  amount        bigint not null,
  from_dirty    bigint not null default 0,
  from_clean    bigint not null default 0,
  created_at    timestamptz not null default now()
);

-- Makes the weekly run idempotent: a second run in the same week no-ops.
create unique index kickups_once_per_week on public.kickups (week_start, from_id);
create index kickups_family_idx on public.kickups (family_id, week_start desc);

-- ------------------------------------------------------------------ config --

insert into public.game_config (key, value, note) values
  ('family_founding_cost', 100000, 'Clean money to start a family. Five seats per city, first come first served.'),
  ('family_expansion_cost', 60000, 'Clean money from the treasury to open in another city.'),
  ('max_families_per_city', 5,     'Hard cap. There is no sixth seat.'),
  ('made_min_respect',      500,   'Respect an associate needs before a boss can make them.'),
  ('kick_up_pct',           0.10,  'Weekly cut owed upward by soldiers and captains.'),
  ('boss_vote_threshold',   0.50,  'Strict majority of the family demotes the boss.'),
  ('captain_min_respect',   1200,  'Respect a soldier needs before they can be given a crew.')
on conflict (key) do update
  set value = excluded.value, note = excluded.note;

-- --------------------------------------------------------------------- RLS --

alter table public.families      enable row level security;
alter table public.family_cities enable row level security;
alter table public.crews         enable row level security;
alter table public.boss_votes    enable row level security;
alter table public.kickups       enable row level security;

-- Families are public. Who runs what is the point of the game — you cannot
-- decide whether to move on a district without knowing who holds it.
create policy families_read      on public.families      for select to authenticated using (true);
create policy family_cities_read on public.family_cities for select to authenticated using (true);
create policy crews_read         on public.crews         for select to authenticated using (true);

-- Votes and the money ledger are internal to the family.
create policy boss_votes_read on public.boss_votes
  for select to authenticated
  using (family_id = (
    select c.family_id from public.characters c
    where c.id = public.current_character_id()
  ));

create policy kickups_read on public.kickups
  for select to authenticated
  using (family_id = (
    select c.family_id from public.characters c
    where c.id = public.current_character_id()
  ));

-- The blanket revoke in the RLS migration only covered tables that existed then.
revoke insert, update, delete
  on public.families, public.family_cities, public.crews,
     public.boss_votes, public.kickups
  from anon, authenticated;
