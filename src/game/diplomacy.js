/**
 * Diplomacy between families.
 *
 * Every pair of families is Neutral until a boss changes it. The three named
 * states each allow exactly ONE partner at a time, so choosing an ally means
 * choosing which war you are prepared to join, and signing a pact means picking
 * the one family you will not be robbing this month.
 */

export const DIPLOMACY = {
  NEUTRAL: 'neutral',
  NAP: 'nap',
  WAR: 'war',
  ALLIED: 'allied',
};

export const DIPLOMACY_META = {
  [DIPLOMACY.NEUTRAL]: {
    id: DIPLOMACY.NEUTRAL,
    label: 'Neutral',
    short: 'Neutral',
    exclusive: false,
    requiresConsent: false,
    colour: '#6e6a7d',
    blurb:
      'The default, and the only state you can hold with any number of families. ' +
      'Everybody can rob everybody. Nobody is obliged to anybody.',
  },
  [DIPLOMACY.NAP]: {
    id: DIPLOMACY.NAP,
    label: 'Non-Aggression Pact',
    short: 'Pact',
    exclusive: true,
    requiresConsent: true,
    colour: '#4f9d69',
    blurb:
      'Members of both families cannot attack or mug each other. One family only. ' +
      'Either boss can tear it up whenever they like.',
  },
  [DIPLOMACY.WAR]: {
    id: DIPLOMACY.WAR,
    label: 'To the Mattresses',
    short: 'At war',
    exclusive: true,
    requiresConsent: false,
    colour: '#b4322c',
    blurb:
      'Soldiers and above on both sides can assassinate each other freely — no ' +
      'contract, no bounty, no permission from the boss. One family only. ' +
      'Ending it means somebody has to offer terms.',
  },
  [DIPLOMACY.ALLIED]: {
    id: DIPLOMACY.ALLIED,
    label: 'Allies',
    short: 'Allied',
    exclusive: true,
    requiresConsent: true,
    colour: '#c9a227',
    blurb:
      'When your ally goes to the mattresses, you go with them — your soldiers ' +
      'inherit the war. One family only. Either boss can walk away.',
  },
};

/** The states a boss can propose. Neutral is what you return to, not what you ask for. */
export const PROPOSABLE = [DIPLOMACY.NAP, DIPLOMACY.WAR, DIPLOMACY.ALLIED];

export const diplomacyMeta = (state) => DIPLOMACY_META[state] || DIPLOMACY_META[DIPLOMACY.NEUTRAL];

/**
 * Whether `state` permits one family's members to attack or mug the other's.
 * War does not merely permit it — it also unlocks assassination without orders.
 */
export function allowsAttack(state) {
  return state !== DIPLOMACY.NAP;
}

/** Only war lets soldiers and above kill without a boss-issued contract. */
export function allowsFreeAssassination(state) {
  return state === DIPLOMACY.WAR;
}

/**
 * War declaration is deliberately NOT consensual — see the note in
 * docs/GAME_DESIGN.md §7. The other boss is notified rather than asked, because
 * a war you have to be granted permission to start is not a war.
 */
export function needsConsent(state) {
  return !!DIPLOMACY_META[state]?.requiresConsent;
}

export function isExclusive(state) {
  return !!DIPLOMACY_META[state]?.exclusive;
}
