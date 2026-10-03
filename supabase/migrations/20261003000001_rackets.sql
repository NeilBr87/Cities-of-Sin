-- ============================================================================
-- M3 — Rackets and district control.
--
-- A district is made up of rackets. They can be bought with family money or
-- taken off whoever holds them, which is harder and usually needs a crew behind
-- you. Whoever holds the most rackets in a district controls it; a tie leaves it
-- contested, which is what a stalemate looks like on a map.
--
-- Racket types are regionalised: New York runs on locals, concrete and carting;
-- Vegas on the count room and the wire; LA on studios and the harbour.
-- ============================================================================

-- A type is the *kind* of business. One row per city per kind.
create table public.racket_types (
  id          text primary key,
  city_id     text not null references public.cities(id) on delete cascade,
  name        text not null,
  blurb       text not null,
  -- 1–10. Drives both the price and how hard it is to take by force.
  defence     smallint not null check (defence between 1 and 10),
  -- Weekly income before the district wealth multiplier. The purchase price is
  -- derived from this (see racket_price_multiple) so the two can never drift.
  base_income int not null check (base_income > 0),
  sort_order  int not null default 0
);

create index racket_types_city_idx on public.racket_types (city_id, sort_order);

-- An instance is that business in a specific district: the thing you own.
create table public.rackets (
  id               uuid primary key default gen_random_uuid(),
  type_id          text not null references public.racket_types(id) on delete cascade,
  district_id      text not null references public.districts(id) on delete cascade,
  owner_family_id  uuid references public.families(id) on delete set null,
  -- Which crew actually holds it. Null means the family holds it directly,
  -- which happens when a boss buys into a district with no crew in it.
  owner_crew_id    uuid references public.crews(id) on delete set null,
  taken_at         timestamptz,
  -- Held for a short while after a takeover, a racket cannot be taken again.
  -- Without this, two crews ping-pong the same racket all evening.
  grace_until      timestamptz,
  last_paid_week   date,

  unique (type_id, district_id)
);

create index rackets_district_idx on public.rackets (district_id);
create index rackets_owner_idx    on public.rackets (owner_family_id) where owner_family_id is not null;
create index rackets_crew_idx     on public.rackets (owner_crew_id)   where owner_crew_id is not null;

-- Every takeover attempt, won or lost. Feeds the district activity log and
-- gives a defender something to read in the morning.
create table public.racket_attempts (
  id           bigint generated always as identity primary key,
  racket_id    uuid not null references public.rackets(id) on delete cascade,
  district_id  text not null references public.districts(id),
  attacker_id  uuid references public.characters(id) on delete set null,
  attacker_family_id uuid references public.families(id) on delete set null,
  defender_family_id uuid references public.families(id) on delete set null,
  success      boolean not null,
  chance       numeric(4,3) not null,
  backup       smallint not null default 0,
  defenders    smallint not null default 0,
  created_at   timestamptz not null default now()
);

create index racket_attempts_district_idx on public.racket_attempts (district_id, created_at desc);
create index racket_attempts_racket_idx   on public.racket_attempts (racket_id, created_at desc);

-- ------------------------------------------------------------------ config --

insert into public.game_config (key, value, note) values
  ('racket_price_multiple',  8,    'Purchase price = base_income x this x district wealth.'),
  ('racket_takeover_base',   0.50, 'Base odds of taking a racket by force.'),
  ('racket_unowned_bonus',   0.15, 'Added when nobody holds it — there is nobody to fight.'),
  ('racket_takeover_nerve',  6,    'Nerve a takeover attempt costs.'),
  ('racket_takeover_heat',   14,   'Heat a takeover adds, before district policing.'),
  ('racket_fail_damage',     25,   'Health lost when a takeover goes wrong.'),
  ('racket_grace_minutes',   30,   'A freshly taken racket cannot be taken again for this long.'),
  ('racket_captain_share',   0.40, 'Share of weekly racket income paid to the holding crew''s captain, dirty. The rest goes to the family treasury, clean.'),
  ('racket_min_rank_level',  3,    'Rank level needed to move on a racket. 3 = soldier.')
on conflict (key) do update
  set value = excluded.value, note = excluded.note;

-- --------------------------------------------------------------------- RLS --

alter table public.racket_types     enable row level security;
alter table public.rackets          enable row level security;
alter table public.racket_attempts  enable row level security;

-- All public. You cannot decide whether to move on a district without being
-- able to see who holds what in it.
create policy racket_types_read    on public.racket_types    for select to anon, authenticated using (true);
create policy rackets_read         on public.rackets         for select to authenticated using (true);
create policy racket_attempts_read on public.racket_attempts for select to authenticated using (true);

revoke insert, update, delete
  on public.racket_types, public.rackets, public.racket_attempts
  from anon, authenticated;

-- ------------------------------------------------------------- racket types --

insert into public.racket_types (id, city_id, name, blurb, defence, base_income, sort_order) values
  -- New York: locals, concrete, carting. Everything moves through somebody.
  ('ny_concrete',  'ny', 'Concrete Supply',       'Nothing gets poured in this district without your trucks.',       8, 4000, 1),
  ('ny_longshore', 'ny', 'Longshoremen''s Local', 'No dues, no dockers, no port. The oldest money there is.',        7, 3600, 2),
  ('ny_carting',   'ny', 'Carting Route',         'One hauler, one price, and a very quiet bidding process.',         6, 3000, 3),
  ('ny_garment',   'ny', 'Garment Trucking',      'Every rail of clothing in the district rides on your say-so.',     5, 2500, 4),
  ('ny_numbers',   'ny', 'Numbers Bank',          'Policy slips, a paper bag, and a barber who can count.',           4, 1900, 5),
  ('ny_social',    'ny', 'Social Club',           'Espresso, card tables, and the blinds permanently down.',          3, 1300, 6),

  -- Chicago: the machine, the barns, the wheel.
  ('chi_ward',      'chi', 'Ward Office',          'Jobs for votes, votes for jobs. The machine in one room.',        7, 3800, 1),
  ('chi_teamsters', 'chi', 'Teamsters Barn',       'If the trucks do not roll, the district does not eat.',           6, 3100, 2),
  ('chi_liquor',    'chi', 'Liquor Distribution',  'Every licence in the district buys from one wholesaler.',         6, 2900, 3),
  ('chi_packing',   'chi', 'Meatpacking Floor',    'Union cards, kill floors, and a smell that hides a lot.',         5, 2400, 4),
  ('chi_policy',    'chi', 'Policy Wheel',         'The oldest numbers game in the city, and still the best run.',    4, 1800, 5),
  ('chi_towing',    'chi', 'Towing Contract',      'You decide which cars get taken and what it costs to see them.',  3, 1200, 6),

  -- Las Vegas: the count room is the whole town.
  ('lv_countroom',  'lv', 'Casino Count Room',     'Two sets of scales and nobody looking at either.',                9, 4600, 1),
  ('lv_wire',       'lv', 'Sportsbook Wire',       'The line moves when you say it moves.',                           6, 3000, 2),
  ('lv_slots',      'lv', 'Slot Route',            'Four hundred machines in bars nobody audits.',                    5, 2200, 3),
  ('lv_taxi',       'lv', 'Taxi Medallions',       'Every fare from the airport goes where you send it.',             5, 2100, 4),
  ('lv_loanwindow', 'lv', 'Loan Window',           'Open all night, next to the cashier, at four points a week.',     4, 1700, 5),
  ('lv_showroom',   'lv', 'Showroom Booking',      'Who plays the room, and what the room pays them.',                3, 1400, 6),

  -- Los Angeles: soft money, slow money, enormous money.
  ('la_harbour',   'la', 'Harbour Freight',        'The other end of every container that leaves Red Hook.',          8, 4200, 1),
  ('la_studio',    'la', 'Studio Teamsters',       'Forty grips on the call sheet. Twelve of them exist.',            7, 3900, 2),
  ('la_loans',     'la', 'Production Loans',       'A picture that never gets made still pays everybody on it.',      6, 3200, 3),
  ('la_nightclub', 'la', 'Nightclub Strip',        'Door money, bar money, and nothing through a register.',          5, 2300, 4),
  ('la_casting',   'la', 'Extras Casting Agency',  'Five hundred hopefuls paying you for the privilege.',             4, 2000, 5),
  ('la_valet',     'la', 'Valet Concession',       'Every key in the district passes through your hand.',             2, 1100, 6)
on conflict (id) do update set
  name = excluded.name, blurb = excluded.blurb,
  defence = excluded.defence, base_income = excluded.base_income,
  sort_order = excluded.sort_order;

-- Instantiate every city's racket types into every one of its districts, so
-- each district has the same six slots and control means holding four of them.
insert into public.rackets (type_id, district_id)
select rt.id, d.id
from public.racket_types rt
join public.districts d on d.city_id = rt.city_id
on conflict (type_id, district_id) do nothing;
