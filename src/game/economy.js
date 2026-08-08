/**
 * Every tunable number in the game lives here, and every formula that turns
 * those numbers into an outcome.
 *
 * IMPORTANT: the server is the authority. This module exists so the client can
 * *predict* outcomes (show odds, show payouts, grey out what you cannot afford)
 * and so that the Xano function stacks have one unambiguous specification to be
 * ported from. If the two ever disagree, the server wins and the client is the bug.
 */

import { rank } from './ranks';
import { ERA } from './era';

export const CONFIG = {
  // ---- Resources ----
  NERVE_MAX_BASE: 10,
  NERVE_REGEN_SEC: 300, // one nerve every 5 minutes
  HEALTH_MAX: 100,
  HEALTH_REGEN_SEC: 120, // one health point every 2 minutes

  // ---- Heat ----
  HEAT_MAX: 100,
  HEAT_DECAY_PER_HOUR: 3, // passive cool-off
  HEAT_ARREST_THRESHOLD: 45, // police may attack-to-arrest at or above this
  FAIL_HEAT_MULT: 1.6, // a botched crime is louder than a clean one

  // ---- Money ----
  STARTING_CLEAN: 2000,
  STARTING_DIRTY: 0,
  BANK_INTEREST_WEEKLY: 0.01, // clean money only

  // ---- Kick-ups (weekly cron) ----
  KICK_UP_PCT: 0.10,
  // The brief says captains collect from "soldiers and associates", but also that
  // associates "don't kick up". The associate rule is the more specific one, so it
  // wins — flip this to true if you want associates taxed as well.
  ASSOCIATES_KICK_UP: false,
  // Kick-ups are taken from dirty money first, then clean if dirty is short.
  KICK_UP_SOURCE: ['dirty', 'clean'],

  // ---- Families ----
  // Five families PER CITY, not five in the world. Four cities means twenty
  // seats, and a family that owns a city outright still has three rivals.
  MAX_FAMILIES_PER_CITY: 5,
  FAMILY_FOUNDING_COST: 2500000, // clean money, first come first served
  FAMILY_NAME_MAX: 32,
  BOSS_VOTE_OUT_QUORUM: 0.5, // strict majority of family members demotes the boss to soldier
  BOSS_VOTE_COOLDOWN_DAYS: 7,
  MADE_MIN_RESPECT: 500, // an associate needs this much respect before a boss can make them
  // A family starts in its home city and buys its way into the others.
  FAMILY_EXPANSION_COST: 1200000,
  // One crew per family per district. A family that wants more crews has to
  // spread out, which is what makes territory a map problem and not a number.
  MAX_CREWS_PER_DISTRICT: 1,

  // ---- Rackets ----
  RACKET_TAKEOVER_NERVE: 6,
  RACKET_TAKEOVER_COOLDOWN_SEC: 3600,
  RACKET_TAKEOVER_HEAT: 14,
  RACKET_FAIL_DAMAGE: 35,
  // Held for this long after a takeover, a racket cannot be taken again — it
  // stops two crews ping-ponging the same racket all evening.
  RACKET_GRACE_SEC: 1800,

  // ---- Diplomacy ----
  // A pact or alliance cannot be torn up the instant it is signed.
  DIPLOMACY_MIN_DURATION_SEC: 3600,
  PEACE_OFFER_EXPIRY_HOURS: 24,

  // ---- Death and the Quantum Bank ----
  // Assassination is permanent. The character is gone and the player starts
  // again — possibly on a completely different path.
  DEATH_IS_PERMANENT: true,
  // The Quantum Bank is the one thing that survives you. It belongs to the
  // account, not the character. The deposit fee is what stops it being a
  // free insurance policy against every risk in the game.
  QUANTUM_DEPOSIT_FEE: 0.10,
  QUANTUM_MIN_DEPOSIT: 1000,
  QUANTUM_INTEREST_WEEKLY: 0, // it is a vault, not an investment
  // A new character inherits nothing but what they withdraw from the vault.
  RESPAWN_STARTING_CLEAN: 2000,

  // ---- Parties ----
  MAX_PARTIES: 5,
  PARTY_FOUNDING_COST: 750000,

  // ---- Elections ----
  TERM_DAYS: { councilman: 7, mayor: 30, president: 60 },
  // Scaled by seat so the bottom rung is reachable on starting money. A fresh
  // staffer has $2,000 and no salary yet, so a flat fee would lock them out of
  // the ladder entirely until the first weekly payroll.
  CAMPAIGN_FEE: { district: 1500, city: 15000, nation: 50000 },
  VOTE_COST_NERVE: 1,

  // ---- Assassination ----
  ASSASSINATION_CONTRACT_MIN: 50000,
  ASSASSINATION_COOLDOWN_HOURS: 12,
  HOSPITAL_MINUTES: 30,
  // A non-lethal beating still costs the loser a quarter of the dirty money on them.
  MUGGING_TAKE: 0.25,

  // ---- Police ----
  ARREST_BASE_CHANCE: 0.35,
  ARREST_BONUS_BASE: 1200, // paid clean, scaled by heat and rank of arrestee
  BRIBE_HEAT_PER_1K: 1.5, // heat removed per $1,000 of bribe
  MAX_BRIBE_PER_DAY: 250000,

  // ---- Prison ----
  // Sentences are deliberately short. Nobody logs in to wait.
  SENTENCE_MIN_SEC: 300, // 5 minutes
  SENTENCE_MAX_SEC: 86400, // 24 hours, hard ceiling regardless of law
  BUST_BASE_CHANCE: 0.3,
  BUST_FAIL_SENTENCE_ADD_SEC: 600,
  BAIL_PER_SEC: 8, // clean money to buy your way out, per second remaining

  // ---- Laundering ----
  LAUNDER_FLOOR_RATE: 0.6, // worst rate available without a front
  LAUNDER_NO_FRONT_CAP: 5000, // weekly cap on washing without owning a front

};

/**
 * Who controls a district: whoever holds the most rackets in it. A tie leaves
 * the district contested and under nobody's control, which is a state worth
 * having — it is what a stalemate looks like on the map.
 */
export function districtController(rackets = []) {
  const counts = new Map();
  rackets.forEach((r) => {
    if (!r.ownerFamilyId) return;
    const key = String(r.ownerFamilyId);
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  if (counts.size === 0) return { familyId: null, count: 0, contested: false };

  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const [topId, topCount] = sorted[0];
  const contested = sorted.length > 1 && sorted[1][1] === topCount;
  return {
    familyId: contested ? null : topId,
    count: topCount,
    contested,
    standings: sorted.map(([familyId, count]) => ({ familyId, count })),
  };
}

/** What lands in the vault after the deposit fee. */
export function quantumDepositNet(amount) {
  return Math.round(amount * (1 - CONFIG.QUANTUM_DEPOSIT_FEE));
}

/** The chance a crime succeeds, all modifiers applied. Returns 0.05 – 0.95. */
export function crimeSuccessChance(crime, player, district, opts = {}) {
  let chance = crime.baseSuccess;

  // Skill: every 10 points of the relevant skill is +2%.
  const skill = player?.skills?.[crime.tier === 3 ? 'business' : 'crime'] ?? 0;
  chance += (skill / 10) * 0.02;

  // Rank confidence.
  chance += rank(player?.rankId).level * 0.012;

  // A district that is well policed is harder to work.
  chance -= (district?.policing ?? 1) * 0.05;

  // Guns help on anything violent, and are required by some jobs.
  if (crime.requires?.gun && opts.hasGun) chance += 0.06;

  // Crew members brought along.
  if (opts.crewSize) chance += Math.min(opts.crewSize, 5) * 0.02;

  // Your own heat makes everyone careful around you.
  chance -= ((player?.heat ?? 0) / CONFIG.HEAT_MAX) * 0.15;

  // The era's forensics rating cuts both ways for the criminal.
  chance -= (ERA.traits.forensics - 0.5) * 0.05;

  return clamp(chance, 0.05, 0.95);
}

/** Dirty money a successful crime pays out. */
export function crimePayout(crime, player, district) {
  const wealth = district?.wealth ?? 1;
  const skill = player?.skills?.crime ?? 0;
  const skillBonus = 1 + (skill / 100) * 0.35;
  const variance = 0.85 + Math.random() * 0.3;
  return Math.round(crime.payout * wealth * skillBonus * variance);
}

/** Heat added by attempting a crime. */
export function crimeHeat(crime, district, success) {
  const base = crime.heat * (district?.policing ?? 1) * ERA.traits.surveillance;
  return Math.round(success ? base : base * CONFIG.FAIL_HEAT_MULT);
}

/**
 * Prison sentence in seconds.
 * `lawMultiplier` comes from the current law table — the President and Mayors
 * set how long each crime costs, which is the main lever politicians hold over
 * the mafia. Always clamped so nobody is ever benched for a whole weekend.
 */
export function sentenceSeconds(crime, lawMultiplier = 1) {
  const raw = crime.sentenceSec * lawMultiplier;
  return Math.round(clamp(raw, CONFIG.SENTENCE_MIN_SEC, CONFIG.SENTENCE_MAX_SEC));
}

/** What it costs to buy your way out right now. */
export function bailCost(secondsRemaining) {
  return Math.round(secondsRemaining * CONFIG.BAIL_PER_SEC);
}

/** Odds a police attack-to-arrest succeeds. */
export function arrestChance(officer, target, district) {
  if ((target?.heat ?? 0) < CONFIG.HEAT_ARREST_THRESHOLD) return 0;
  let c = CONFIG.ARREST_BASE_CHANCE;
  c += ((target.heat - CONFIG.HEAT_ARREST_THRESHOLD) / CONFIG.HEAT_MAX) * 0.5;
  c += rank(officer?.rankId).level * 0.04;
  c += (officer?.skills?.investigation ?? 0) / 100 * 0.2;
  c -= rank(target?.rankId).level * 0.03;
  c -= (target?.defence ?? 0) / 200;
  c += ((district?.policing ?? 1) - 1) * 0.1;
  return clamp(c, 0.05, 0.9);
}

/** Clean-money bonus paid to the arresting officer. */
export function arrestBonus(target) {
  const heatFactor = 1 + (target?.heat ?? 0) / CONFIG.HEAT_MAX;
  const rankFactor = 1 + rank(target?.rankId).level * 0.45;
  return Math.round(CONFIG.ARREST_BONUS_BASE * heatFactor * rankFactor);
}

/** Attack resolution between two players. Higher roll wins. */
export function combatScore(player, opts = {}) {
  const gunAtk = opts.gunAttack ?? 0;
  const armour = opts.armourDefence ?? 0;
  const inside = opts.propertySafety ?? 0;
  const base =
    (player?.skills?.combat ?? 0) * 0.6 +
    gunAtk * 2 +
    armour +
    inside * 0.8 +
    rank(player?.rankId).level * 3 +
    (player?.health ?? 100) * 0.2;
  return base * (0.85 + Math.random() * 0.3);
}

/** Laundering: dirty in, clean out. */
export function launderOutput(dirtyAmount, front) {
  const rate = front ? front.rate : CONFIG.LAUNDER_FLOOR_RATE;
  return Math.round(dirtyAmount * rate);
}

export function launderWeeklyCap(fronts = []) {
  if (!fronts.length) return CONFIG.LAUNDER_NO_FRONT_CAP;
  return fronts.reduce((sum, f) => sum + f.weeklyCapacity, 0);
}

/** Weekly kick-up owed by a player, given their balances. */
export function kickUpOwed(player) {
  const r = rank(player?.rankId);
  if (!r.kickUpPct) return 0;
  if (r.id === 'associate' && !CONFIG.ASSOCIATES_KICK_UP) return 0;
  const pool = (player?.dirty ?? 0) + (player?.clean ?? 0);
  return Math.round(pool * (r.kickUpPct / 100));
}

export function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

/** Respect is the mafia XP track — it gates being made and promoted. */
export function respectForCrime(crime, success) {
  if (!success) return 0;
  return crime.tier === 1 ? 2 : crime.tier === 2 ? 12 : 60;
}
