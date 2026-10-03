-- ============================================================================
-- M4 — Violence, death, and the Quantum Bank.
--
-- Three separate things, deliberately:
--
--   1. ATTACKS. Anyone can attack anyone in the same district and take money
--      off them. Nobody dies. Losing drops your health, and health hitting zero
--      puts you in hospital, where you cannot be touched. That hospital window
--      IS the anti-griefing mechanism — there is no per-target cooldown, because
--      somebody attacked repeatedly ends up safe rather than farmed.
--
--   2. HITS. Only a boss can order a killing. Boss orders and funds it, assigns
--      a captain, the captain names a shooter from their crew, the shooter has
--      to find the target and pull it off. Four people, four steps.
--
--   3. DEATH. Permanent. The character is gone and the account starts again,
--      possibly on a different path. Everything is lost except what was put in
--      the vault, which belongs to the account rather than the character.
-- ============================================================================

alter table public.characters
  -- Health at zero means hospital, not death. Death only comes from a hit.
  add column hospital_until timestamptz,
  add column killed_by      uuid references public.characters(id) on delete set null;

create index characters_hospital_idx on public.characters (hospital_until)
  where hospital_until is not null;

-- Every attack, so a victim has something to read when they log back in.
create table public.attacks (
  id            bigint generated always as identity primary key,
  attacker_id   uuid not null references public.characters(id) on delete cascade,
  target_id     uuid not null references public.characters(id) on delete cascade,
  district_id   text not null references public.districts(id),
  attacker_won  boolean not null,
  took_clean    bigint not null default 0,
  took_dirty    bigint not null default 0,
  damage_dealt  int not null default 0,
  damage_taken  int not null default 0,
  hospitalised  boolean not null default false,
  created_at    timestamptz not null default now()
);

create index attacks_target_idx   on public.attacks (target_id, created_at desc);
create index attacks_attacker_idx on public.attacks (attacker_id, created_at desc);

-- A contract, from the boss's decision through to somebody pulling a trigger.
create type public.hit_state as enum ('ordered', 'assigned', 'ready', 'done', 'failed', 'cancelled');

create table public.hits (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid not null references public.families(id) on delete cascade,
  ordered_by   uuid references public.characters(id) on delete set null,
  target_id    uuid not null references public.characters(id) on delete cascade,
  captain_id   uuid references public.characters(id) on delete set null,
  shooter_id   uuid references public.characters(id) on delete set null,
  state        public.hit_state not null default 'ordered',
  -- Held out of the treasury the moment the contract is opened, so a boss
  -- cannot order a killing they cannot pay for, and paid to the shooter on
  -- success or returned to the treasury on failure.
  bounty       bigint not null check (bounty >= 0),
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz,
  outcome      text
);

create index hits_family_idx  on public.hits (family_id, created_at desc);
create index hits_target_idx  on public.hits (target_id) where state in ('ordered', 'assigned', 'ready');
create index hits_shooter_idx on public.hits (shooter_id) where state = 'ready';

-- One open contract per target per family. Otherwise a boss can stack five
-- contracts on one person and roll the dice five times.
create unique index hits_one_open_per_target
  on public.hits (family_id, target_id)
  where state in ('ordered', 'assigned', 'ready');

-- The record of who died and who did it. Kept separately from `characters`
-- because a grave outlives the row's usefulness and should be cheap to read.
create table public.graves (
  id              bigint generated always as identity primary key,
  profile_id      uuid references public.profiles(id) on delete set null,
  character_id    uuid,
  name            text not null,
  path            public.life_path not null,
  rank_id         text not null,
  family_name     text,
  respect         int not null default 0,
  killed_by_name  text,
  cause           text not null,
  born_at         timestamptz not null,
  died_at         timestamptz not null default now()
);

create index graves_died_idx on public.graves (died_at desc);

-- ------------------------------------------------------------------ config --

insert into public.game_config (key, value, note) values
  ('attack_nerve',          3,    'Nerve an attack costs.'),
  ('attack_heat',           8,    'Heat an attack adds, before district policing.'),
  -- Both clean and dirty are taken, with dirty bleeding faster: cash in a bag
  -- is easier to lift than money in a bank.
  ('mug_dirty_pct',         0.35, 'Share of the loser''s dirty money the winner takes.'),
  ('mug_clean_pct',         0.12, 'Share of the loser''s clean money the winner takes.'),
  ('attack_damage_base',    30,   'Base health the loser loses. Scaled by the margin.'),
  ('attack_damage_winner',  8,    'Base health the winner loses anyway.'),
  ('hospital_minutes',      20,   'Time in hospital when health hits zero. Untouchable, and discharged on full health.'),
  -- A moderate floor: peers can fight, but a boss cannot farm hoodlums. The
  -- 48-hour new-arrival immunity still covers everybody's first two days.
  ('attack_rank_gap',       2,    'You cannot attack anyone more than this many rank levels below you.'),
  ('hit_bounty_min',        50000, 'Minimum contract, out of the family treasury.'),
  ('hit_success_base',      0.55, 'Base odds a shooter lands a contract.'),
  ('hit_respect_reward',    150,  'Respect to the shooter for a completed contract.'),
  ('respawn_clean',         2000, 'What a new character starts with after the old one is buried.')
on conflict (key) do update
  set value = excluded.value, note = excluded.note;

-- --------------------------------------------------------------------- RLS --

alter table public.attacks enable row level security;
alter table public.hits    enable row level security;
alter table public.graves  enable row level security;

-- You can see fights you were in. Not other people's.
create policy attacks_read_own on public.attacks
  for select to authenticated
  using (
    attacker_id = public.current_character_id()
    or target_id = public.current_character_id()
  );

-- Contracts are visible to the family that opened them, and to the shooter who
-- has to carry one out. Never to the target — the whole point is not knowing.
create policy hits_read_involved on public.hits
  for select to authenticated
  using (
    family_id = (
      select c.family_id from public.characters c where c.id = public.current_character_id()
    )
  );

-- The graveyard is public. Who died, and who killed them, is the news.
create policy graves_read on public.graves
  for select to authenticated using (true);

revoke insert, update, delete
  on public.attacks, public.hits, public.graves
  from anon, authenticated;
