/**
 * The setting is deliberately not hard-coded. The brief said "somewhere from
 * 1970 to modern", so the era is a single switch that drives flavour text,
 * which items exist, and how communication/surveillance works.
 *
 * Change DEFAULT_ERA (or set REACT_APP_ERA) and the whole game re-skins.
 */

export const ERAS = {
  seventies: {
    id: 'seventies',
    year: 1979,
    label: "The Long Seventies",
    blurb:
      "Cash in paper bags, unions with real teeth, no cameras on the corner. " +
      "A payphone is the only phone that matters.",
    // Mechanical consequences of the era, read by the rest of the game.
    traits: {
      surveillance: 0.6, // multiplier on police passive heat detection
      wireTapping: false, // police cannot passively read district chat
      forensics: 0.5, // multiplier on evidence left behind by crimes
      wireTransfers: false, // laundering must be done physically, at a front
      travelSpeed: 1.0,
    },
    excludedItems: ['burner_phone', 'encrypted_laptop', 'drone', 'ev_sedan'],
  },
  nineties: {
    id: 'nineties',
    year: 1994,
    label: "The Long Goodbye",
    blurb:
      "RICO has teeth, the old bosses are dying in federal beds, and everyone " +
      "suspects everyone. Pagers, car phones, and rats.",
    traits: {
      surveillance: 0.85,
      wireTapping: true,
      forensics: 0.8,
      wireTransfers: true,
      travelSpeed: 1.15,
    },
    excludedItems: ['encrypted_laptop', 'drone', 'ev_sedan'],
  },
  modern: {
    id: 'modern',
    year: 2026,
    label: "Modern Day",
    blurb:
      "The money is digital, the muscle is subcontracted, and there is a camera " +
      "on every corner. The rules are the same. The paperwork is worse.",
    traits: {
      surveillance: 1.25,
      wireTapping: true,
      forensics: 1.2,
      wireTransfers: true,
      travelSpeed: 1.3,
    },
    excludedItems: ['payphone_tap', 'pager'],
  },
};

export const DEFAULT_ERA = 'seventies';

export const ERA = ERAS[process.env.REACT_APP_ERA] || ERAS[DEFAULT_ERA];

export function eraAllows(itemId) {
  return !ERA.excludedItems.includes(itemId);
}
