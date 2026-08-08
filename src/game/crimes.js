/**
 * Crimes.
 *
 * Three tiers, exactly as briefed:
 *   tier 1 — petty street earners, always available, low heat
 *   tier 2 — sophisticated, higher risk, needs rank/skill/crew
 *   tier 3 — the big projects, only unlocked when a politician awards a contract
 *
 * payout      base dirty money, before district wealth multiplier
 * nerve       nerve points spent
 * cooldownSec per-player cooldown on this specific crime
 * baseSuccess 0–1 before skill, gun, crew and district modifiers
 * heat        heat added on success; failure adds heat * FAIL_HEAT_MULT
 * evidence    evidence points left for police investigations
 * sentenceSec base prison time if caught, before law modifiers
 */

export const CRIME_TIERS = {
  1: { id: 1, label: 'Street', blurb: 'Nickels and dimes. Nobody writes it down.' },
  2: { id: 2, label: 'Organised', blurb: 'Planned, crewed, and worth a warrant.' },
  3: { id: 3, label: 'Projects', blurb: 'Needs a politician in your pocket before it exists.' },
};

export const CRIMES = [
  // ---------- Tier 1: street ----------
  { id: 'pickpocket', tier: 1, name: 'Pickpocket', payout: 120, nerve: 1, cooldownSec: 90, baseSuccess: 0.82, heat: 1, evidence: 1, sentenceSec: 300,
    flavour: 'A tourist, a crowd, and two fingers.' },
  { id: 'shoplift', tier: 1, name: 'Boost from a Store', payout: 180, nerve: 1, cooldownSec: 120, baseSuccess: 0.78, heat: 2, evidence: 1, sentenceSec: 420,
    flavour: 'Walk in heavy-coated, walk out heavier.' },
  { id: 'extortion', tier: 1, name: 'Shake Down a Storefront', payout: 320, nerve: 2, cooldownSec: 300, baseSuccess: 0.7, heat: 4, evidence: 2, sentenceSec: 900,
    flavour: 'Nice place. Be a shame if the insurance lapsed.' },
  { id: 'mugging', tier: 1, name: 'Mugging', payout: 260, nerve: 2, cooldownSec: 240, baseSuccess: 0.72, heat: 4, evidence: 2, sentenceSec: 780,
    flavour: 'An alley does most of the work.' },
  { id: 'numbers', tier: 1, name: 'Run the Numbers', payout: 400, nerve: 2, cooldownSec: 480, baseSuccess: 0.75, heat: 3, evidence: 2, sentenceSec: 720,
    flavour: 'Policy slips, a paper bag, and a barber who counts.' },
  { id: 'car_theft', tier: 1, name: 'Boost a Car', payout: 650, nerve: 3, cooldownSec: 600, baseSuccess: 0.64, heat: 6, evidence: 3, sentenceSec: 1500,
    flavour: 'Sixty seconds if the wiring is kind.' },
  { id: 'burglary', tier: 1, name: 'Burglary', payout: 900, nerve: 3, cooldownSec: 900, baseSuccess: 0.6, heat: 7, evidence: 4, sentenceSec: 1800,
    flavour: 'Empty house, full cabinet.' },
  { id: 'loan_collection', tier: 1, name: 'Collect on a Loan', payout: 750, nerve: 2, cooldownSec: 600, baseSuccess: 0.74, heat: 4, evidence: 2, sentenceSec: 1200,
    flavour: 'The vig does not care about your week.' },

  // ---------- Tier 2: organised ----------
  { id: 'protection_racket', tier: 2, name: 'Run a Protection Racket', payout: 2600, nerve: 5, cooldownSec: 3600, baseSuccess: 0.58, heat: 12, evidence: 6, sentenceSec: 5400,
    requires: { rank: 'associate' }, flavour: 'A whole block, every week, forever. If it holds.' },
  { id: 'fencing', tier: 2, name: 'Fence a Truckload', payout: 3400, nerve: 5, cooldownSec: 4200, baseSuccess: 0.55, heat: 11, evidence: 6, sentenceSec: 5400,
    requires: { rank: 'associate' }, flavour: 'It fell off the back. All of it did.' },
  { id: 'chop_shop', tier: 2, name: 'Work the Chop Shop', payout: 4200, nerve: 6, cooldownSec: 5400, baseSuccess: 0.52, heat: 13, evidence: 7, sentenceSec: 7200,
    requires: { rank: 'associate' }, flavour: 'A car goes in whole and leaves as a catalogue.' },
  { id: 'armed_robbery', tier: 2, name: 'Armed Robbery', payout: 5200, nerve: 7, cooldownSec: 5400, baseSuccess: 0.46, heat: 18, evidence: 9, sentenceSec: 10800,
    requires: { rank: 'soldier', gun: true }, flavour: 'Everybody down. Nobody is a hero for $9 an hour.' },
  { id: 'bank_job', tier: 2, name: 'Bank Job', payout: 9500, nerve: 9, cooldownSec: 10800, baseSuccess: 0.38, heat: 26, evidence: 12, sentenceSec: 21600,
    requires: { rank: 'soldier', gun: true, crew: 3 }, flavour: 'Two minutes at the counter, ninety seconds at the door.' },
  { id: 'hijack', tier: 2, name: 'Hijack a Shipment', payout: 7200, nerve: 8, cooldownSec: 7200, baseSuccess: 0.44, heat: 20, evidence: 10, sentenceSec: 14400,
    requires: { rank: 'soldier', vehicle: true }, flavour: 'The driver takes a walk and a small envelope.' },
  { id: 'narcotics', tier: 2, name: 'Move Product', payout: 8000, nerve: 8, cooldownSec: 7200, baseSuccess: 0.5, heat: 24, evidence: 11, sentenceSec: 18000,
    requires: { rank: 'soldier' }, lawSensitive: 'narcotics',
    flavour: 'Legality is a policy setting. Ask the President.' },
  { id: 'casino_skim', tier: 2, name: 'Skim the Count Room', payout: 11000, nerve: 9, cooldownSec: 10800, baseSuccess: 0.42, heat: 22, evidence: 10, sentenceSec: 18000,
    requires: { rank: 'soldier', cityId: 'lv' }, flavour: 'The count room has two sets of scales. Vegas only.' },
  { id: 'union_shakedown', tier: 2, name: 'Squeeze the Local', payout: 9000, nerve: 8, cooldownSec: 10800, baseSuccess: 0.48, heat: 19, evidence: 9, sentenceSec: 16200,
    requires: { rank: 'soldier', cityId: 'ny' }, flavour: 'No dues, no dockworkers, no port. New York only.' },
  { id: 'ward_fix', tier: 2, name: 'Fix a Ward', payout: 8600, nerve: 8, cooldownSec: 10800, baseSuccess: 0.5, heat: 17, evidence: 9, sentenceSec: 14400,
    requires: { rank: 'soldier', cityId: 'chi' }, flavour: 'Vote early, vote often, vote paid. Chicago only.' },

  // ---------- Tier 3: projects (contract-gated) ----------
  { id: 'concrete_cartel', tier: 3, name: 'Concrete Cartel', payout: 65000, nerve: 12, cooldownSec: 86400, baseSuccess: 0.7, heat: 30, evidence: 14, sentenceSec: 43200,
    requires: { rank: 'captain', contract: 'construction' },
    flavour: 'Every cubic yard poured in the district pays a tax you invented.' },
  { id: 'waste_carting', tier: 3, name: 'Carting Monopoly', payout: 48000, nerve: 11, cooldownSec: 86400, baseSuccess: 0.72, heat: 26, evidence: 12, sentenceSec: 36000,
    requires: { rank: 'captain', contract: 'sanitation' },
    flavour: 'One hauler, one price, one very quiet bidding process.' },
  { id: 'pension_raid', tier: 3, name: 'Raid the Pension Fund', payout: 90000, nerve: 14, cooldownSec: 172800, baseSuccess: 0.6, heat: 38, evidence: 18, sentenceSec: 64800,
    requires: { rank: 'captain', contract: 'union' },
    flavour: 'A loan to a friend, secured against thirty years of somebody else\'s work.' },
  { id: 'gaming_licence', tier: 3, name: 'Buy a Gaming Licence', payout: 120000, nerve: 15, cooldownSec: 172800, baseSuccess: 0.62, heat: 34, evidence: 16, sentenceSec: 64800,
    requires: { rank: 'captain', contract: 'gaming', cityId: 'lv' },
    flavour: 'The board votes at ten. You bought nine of them by eight.' },
  { id: 'no_bid_contract', tier: 3, name: 'No-Bid Public Works', payout: 78000, nerve: 13, cooldownSec: 86400, baseSuccess: 0.68, heat: 28, evidence: 13, sentenceSec: 43200,
    requires: { rank: 'captain', contract: 'publicworks' },
    flavour: 'Three bids, two of them from companies you also own.' },
];

export const crimeById = (id) => CRIMES.find((c) => c.id === id);
export const crimesOfTier = (tier) => CRIMES.filter((c) => c.tier === tier);

/**
 * Police work is modelled as crimes-with-a-badge so it shares one engine.
 * Investigations consume evidence in a district; extortion and bribes are cash.
 */
export const POLICE_ACTIONS = [
  { id: 'patrol', name: 'Patrol the District', nerve: 1, cooldownSec: 120, pay: 220,
    flavour: 'Turns up small evidence and the occasional warm body.' },
  { id: 'canvass', name: 'Canvass for Witnesses', nerve: 2, cooldownSec: 300, pay: 380,
    flavour: 'Knock on forty doors. Two of them open.' },
  { id: 'investigate', name: 'Open an Investigation', nerve: 3, cooldownSec: 600, pay: 700,
    flavour: 'Builds a case file against the district\'s dirtiest name.' },
  { id: 'stakeout', name: 'Stake Out a Front', nerve: 4, cooldownSec: 1800, pay: 1400,
    flavour: 'Long hours, bad coffee, good photographs.' },
  { id: 'raid', name: 'Raid a Property', nerve: 6, cooldownSec: 3600, pay: 2600,
    flavour: 'Needs a case file. Seizes dirty money and destroys evidence of your own.' },
  { id: 'shakedown_citizen', name: 'Shake Down a Citizen', nerve: 2, cooldownSec: 600, pay: 500, dirty: true,
    flavour: 'A quota is a quota. This one goes in your pocket.' },
];

export const policeActionById = (id) => POLICE_ACTIONS.find((a) => a.id === id);
