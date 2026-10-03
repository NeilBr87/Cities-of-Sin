-- ============================================================================
-- World seed.
--
-- This is reference data, not user data, so it belongs in a migration: the
-- world should be identical on a fresh local stack and in production.
-- Re-runnable — every insert is an upsert.
-- ============================================================================

-- ------------------------------------------------------------- balance --

insert into public.game_config (key, value, note) values
  ('nerve_max',             10,     'Nerve pool. Every crime spends from it.'),
  ('nerve_regen_seconds',   300,    'One nerve every five minutes.'),
  ('health_regen_seconds',  120,    'One health point every two minutes.'),
  ('heat_decay_per_hour',   3,      'Passive cool-off. Heat is capped at 100.'),
  ('fail_heat_multiplier',  1.6,    'A botched job is louder than a clean one.'),
  ('arrest_on_fail_base',   0.22,   'Base odds of being taken in after a failed crime.'),
  ('sentence_min_seconds',  300,    'Five minutes. Nobody logs in to wait.'),
  ('sentence_max_seconds',  86400,  'Hard ceiling: one day, whatever the law says.'),
  ('bail_per_second',       8,      'Clean money to buy out the rest of a sentence.'),
  ('starting_clean',        2000,   'What a new character steps off the bus with.'),
  ('launder_rate',          0.60,   'Dirty in, clean out. Brutal until fronts exist.'),
  ('launder_cap',           25000,  'Dirty money washable per window without a front.'),
  ('launder_window_hours',  24,     'Rolling window for the laundering cap.'),
  ('vault_deposit_fee',     0.10,   'The price of putting money beyond death.'),
  ('vault_min_deposit',     1000,   'Stops the vault being used as a wallet.'),
  ('flight_cost',           1500,   'Clean money for a seat between cities.'),
  ('chat_burst_limit',      5,      'Messages allowed per ten seconds.')
on conflict (key) do update
  set value = excluded.value, note = excluded.note;

-- -------------------------------------------------------------- cities --

insert into public.cities (id, name, short_code, tagline, signature, signature_label, signature_blurb, sort_order) values
  ('ny', 'New York', 'NY',
   'Five boroughs, five families, one long memory.',
   'unions', 'Union Halls',
   'Locals control the docks, the sanitation routes and the concrete. Whoever holds the local skims every job in the district.', 1),

  ('chi', 'Chicago', 'CHI',
   'One Outfit, one machine, and everybody on the pad.',
   'machine', 'The Ward Machine',
   'The ward machine trades jobs for votes. Precinct captains can be bought outright, which makes elections here the cheapest to rig and the ugliest to lose.', 2),

  ('lv', 'Las Vegas', 'LV',
   'The only town where the house launders for you.',
   'gambling', 'The Casinos',
   'Casino floors, the count room and the skim. Vegas is the only city where dirty money can be washed at scale — and the only place you can lose it all on one hand.', 3),

  ('la', 'Los Angeles', 'LA',
   'Everyone is selling something, and most of it is a story.',
   'studios', 'The Studios',
   'Studio payroll, teamster crews and production loans. LA money is soft, slow and enormous — a picture that never gets made still pays everybody on it.', 4)
on conflict (id) do update set
  name = excluded.name, tagline = excluded.tagline,
  signature_blurb = excluded.signature_blurb;

-- ----------------------------------------------------------- districts --

insert into public.districts (id, city_id, name, wealth, policing, flavour, sort_order) values
  -- New York
  ('ny_little_italy',  'ny', 'Little Italy',      1.00, 1.10, 'Social clubs with the blinds down and the espresso machine running.', 1),
  ('ny_red_hook',      'ny', 'Red Hook Docks',    1.15, 0.80, 'Containers that arrive full and leave fuller.', 2),
  ('ny_harlem',        'ny', 'Harlem',            0.80, 1.00, 'Policy banks, storefront churches, and a very long institutional memory.', 3),
  ('ny_midtown',       'ny', 'Midtown',           1.50, 1.40, 'Glass, money, and a cop on every second corner.', 4),
  ('ny_bensonhurst',   'ny', 'Bensonhurst',       0.95, 0.85, 'Where everybody knows the name and nobody remembers the face.', 5),
  ('ny_bronx',         'ny', 'The Bronx',         0.75, 0.90, 'Cheap, loud, and unpoliced enough to be worth the trip.', 6),

  -- Chicago
  ('chi_loop',         'chi', 'The Loop',         1.45, 1.35, 'City Hall, the banks, and the shortest distance between them.', 1),
  ('chi_cicero',       'chi', 'Cicero',           0.90, 0.65, 'A town the Outfit bought outright and never gave back.', 2),
  ('chi_south_side',   'chi', 'South Side',       0.75, 0.95, 'Miles of it, and not a squad car in sight after dark.', 3),
  ('chi_rush_street',  'chi', 'Rush Street',      1.25, 1.15, 'Liquor licences, cover charges, and cash that never sees a register.', 4),
  ('chi_stockyards',   'chi', 'The Stockyards',   0.85, 0.75, 'Trucks, unions, and a smell that hides a multitude of sins.', 5),
  ('chi_chinatown',    'chi', 'Chinatown',        1.00, 1.00, 'Its own arrangements, its own rules, and no interest in yours.', 6),

  -- Las Vegas
  ('lv_strip',         'lv', 'The Strip',         1.60, 1.30, 'Every dollar here is watched by four cameras and one accountant.', 1),
  ('lv_fremont',       'lv', 'Fremont Street',    1.15, 1.05, 'Old Vegas. Smaller rooms, looser counts.', 2),
  ('lv_paradise',      'lv', 'Paradise',          1.10, 0.90, 'Convention money, expense accounts, and nobody going home to explain it.', 3),
  ('lv_north',         'lv', 'North Las Vegas',   0.70, 0.70, 'Where the people who make the Strip work actually live.', 4),
  ('lv_boulder',       'lv', 'Boulder Highway',   0.80, 0.60, 'Motels, pawn shops, and a long dark road out of town.', 5),
  ('lv_henderson',     'lv', 'Henderson',         0.95, 0.80, 'Industrial parks and zoning decisions worth more than the buildings.', 6),

  -- Los Angeles
  ('la_hollywood',     'la', 'Hollywood',         1.55, 1.20, 'Production loans, payroll padding, and a lot of people owed favours.', 1),
  ('la_downtown',      'la', 'Downtown',          1.30, 1.35, 'Civic contracts and the people who decide them, in one square mile.', 2),
  ('la_venice',        'la', 'Venice Beach',      1.05, 0.85, 'Boardwalk cash, and everybody too sunburnt to be a witness.', 3),
  ('la_san_pedro',     'la', 'San Pedro Docks',   1.20, 0.75, 'The other end of every container that leaves Red Hook.', 4),
  ('la_valley',        'la', 'The Valley',        0.90, 0.80, 'Strip malls, storage units, and a great many small businesses.', 5),
  ('la_boyle_heights', 'la', 'Boyle Heights',     0.70, 0.90, 'Old money moved out. The arrangements stayed.', 6)
on conflict (id) do update set
  name = excluded.name, wealth = excluded.wealth,
  policing = excluded.policing, flavour = excluded.flavour;

-- -------------------------------------------------------------- crimes --

-- Tier 1 is always available. Tier 2 opens on respect, which is what gives a
-- new player a ladder to climb before families and rackets exist.
--
-- The list deliberately mixes eras: a shakedown and a numbers bank sit next to
-- card skimming and wire fraud, because that is what the business actually
-- looks like once you stop filming it.

insert into public.crimes
  (id, tier, name, flavour, payout, nerve_cost, cooldown_seconds, base_success, heat, sentence_seconds, min_respect, city_id, sort_order)
values
  -- ---- Tier 1: street ----
  ('pickpocket',      1, 'Pickpocket',              'A tourist, a crowd, and two fingers.',                          120, 1,   90, 0.82,  1,   300,   0, null,  1),
  ('shoplift',        1, 'Boost from a Store',      'Walk in heavy-coated, walk out heavier.',                       180, 1,  120, 0.78,  2,   420,   0, null,  2),
  ('mugging',         1, 'Mugging',                 'An alley does most of the work.',                               260, 2,  240, 0.72,  4,   780,   0, null,  3),
  ('extortion',       1, 'Shake Down a Storefront', 'Nice place. Be a shame if the insurance lapsed.',               320, 2,  300, 0.70,  4,   900,   0, null,  4),
  ('card_skim',       1, 'Skim a Card Reader',      'Ninety seconds with a screwdriver pays for a month.',           380, 2,  360, 0.68,  4,  1200,   0, null,  5),
  ('numbers',         1, 'Run the Numbers',         'Policy slips, a paper bag, and a barber who counts.',           400, 2,  480, 0.75,  3,   720,   0, null,  6),
  ('loan_collection', 1, 'Collect on a Loan',       'The vig does not care about your week.',                        750, 2,  600, 0.74,  4,  1200,  20, null,  7),
  ('car_theft',       1, 'Boost a Car',             'Sixty seconds, if the wiring is kind.',                         650, 3,  600, 0.64,  6,  1500,  20, null,  8),
  ('burglary',        1, 'Burglary',                'Empty house, full cabinet.',                                    900, 3,  900, 0.60,  7,  1800,  40, null,  9),

  -- ---- Tier 2: organised ----
  ('protection',      2, 'Run a Protection Racket', 'A whole block, every week, forever. If it holds.',             2600, 5, 3600, 0.58, 12,  5400,  60, null, 20),
  ('fencing',         2, 'Fence a Truckload',       'It fell off the back. All of it did.',                         3400, 5, 4200, 0.55, 11,  5400, 100, null, 21),
  ('chop_shop',       2, 'Work the Chop Shop',      'A car goes in whole and leaves as a catalogue.',               4200, 6, 5400, 0.52, 13,  7200, 150, null, 22),
  ('cargo_theft',     2, 'Take a Cargo Load',       'The driver takes a walk and a small envelope.',                5200, 6, 5400, 0.50, 15,  9000, 200, null, 23),
  ('staged_crash',    2, 'Stage an Accident',       'Four passengers, four whiplash claims, one very tired doctor.', 4800, 5, 5400, 0.60, 10,  7200, 250, null, 24),
  ('cigarette_run',   2, 'Run Untaxed Smokes',      'Buy south, sell north, keep the difference the state wanted.',  6000, 6, 7200, 0.62, 12,  9000, 300, null, 25),
  ('wire_fraud',      2, 'Wire Fraud',              'No mask, no gun, no witness, and a much better hourly rate.',   7500, 7, 7200, 0.54, 16, 14400, 350, null, 26),
  ('armed_robbery',   2, 'Armed Robbery',           'Everybody down. Nobody is a hero for nine dollars an hour.',    5200, 7, 5400, 0.46, 18, 10800, 450, null, 27),
  ('pump_and_dump',   2, 'Pump and Dump',           'Buy it quiet, shout about it loud, leave before the bell.',     9000, 8, 10800, 0.50, 20, 18000, 700, null, 28),
  ('bank_job',        2, 'Bank Job',                'Two minutes at the counter, ninety seconds at the door.',       9500, 9, 10800, 0.38, 26, 21600, 900, null, 29),

  -- ---- Tier 2: regional ----
  ('union_shakedown', 2, 'Squeeze the Local',       'No dues, no dockworkers, no port.',                             9000, 8, 10800, 0.48, 19, 16200, 600, 'ny', 40),
  ('ward_fix',        2, 'Fix a Ward',              'Vote early, vote often, vote paid.',                            8600, 8, 10800, 0.50, 17, 14400, 600, 'chi', 41),
  ('casino_skim',     2, 'Skim the Count Room',     'The count room has two sets of scales.',                       11000, 9, 10800, 0.42, 22, 18000, 600, 'lv', 42),
  ('studio_payroll',  2, 'Pad the Studio Payroll',  'Forty grips on the call sheet. Twelve of them exist.',          9800, 8, 10800, 0.52, 18, 16200, 600, 'la', 43)
on conflict (id) do update set
  name = excluded.name, flavour = excluded.flavour, payout = excluded.payout,
  nerve_cost = excluded.nerve_cost, cooldown_seconds = excluded.cooldown_seconds,
  base_success = excluded.base_success, heat = excluded.heat,
  sentence_seconds = excluded.sentence_seconds, min_respect = excluded.min_respect,
  city_id = excluded.city_id, sort_order = excluded.sort_order;
