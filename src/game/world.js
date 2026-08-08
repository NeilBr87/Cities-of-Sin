/**
 * The world: four cities, each split into districts.
 *
 * A district is the smallest unit of territory. Almost every system in the game
 * hangs off a district: crimes, rackets, property, police departments,
 * councilman seats, chat rooms and crews are all district-scoped.
 */

export const CITIES = [
  {
    id: 'ny',
    name: 'New York',
    short: 'NY',
    tz: 'America/New_York',
    tagline: 'Five boroughs, five families, one long memory.',
    // City-specific systems. Every city has exactly one signature system.
    signature: 'unions',
    signatureLabel: 'Union Halls',
    signatureBlurb:
      'Locals control the docks, the sanitation routes and the concrete. ' +
      'Whoever holds the local skims every job in the district.',
    travelCostFrom: { chi: 320, lv: 540, la: 620 },
  },
  {
    id: 'chi',
    name: 'Chicago',
    short: 'CHI',
    tz: 'America/Chicago',
    tagline: 'One Outfit, one machine, and everybody on the pad.',
    signature: 'machine',
    signatureLabel: 'The Ward Machine',
    signatureBlurb:
      'The ward machine trades jobs for votes. Precinct captains can be bought ' +
      'outright, which makes elections here the cheapest to rig and the ugliest to lose.',
    travelCostFrom: { ny: 320, lv: 380, la: 440 },
  },
  {
    id: 'lv',
    name: 'Las Vegas',
    short: 'LV',
    tz: 'America/Los_Angeles',
    tagline: 'The only town where the house launders for you.',
    signature: 'gambling',
    signatureLabel: 'The Casinos',
    signatureBlurb:
      'Casino floors, the count room and the skim. Vegas is the only city where ' +
      'dirty money can be washed at scale — and the only place you can lose it all on a hand.',
    travelCostFrom: { ny: 540, chi: 380, la: 180 },
  },
  {
    id: 'la',
    name: 'Los Angeles',
    short: 'LA',
    tz: 'America/Los_Angeles',
    tagline: 'Everyone is selling something, and most of it is a story.',
    signature: 'studios',
    signatureLabel: 'The Studios',
    signatureBlurb:
      'Studio payroll, teamster crews and production loans. LA money is soft, ' +
      'slow and enormous — a picture that never gets made still pays everybody on it.',
    travelCostFrom: { ny: 620, chi: 440, lv: 180 },
  },
];

/**
 * Districts.
 *
 * wealth      — base multiplier on crime payouts, racket income and property prices
 * policing    — base multiplier on heat gained and arrest odds (0.6 – 1.5)
 * contracts   — the flavour of the big politician-enabled projects here
 */
export const DISTRICTS = [
  // ---- New York ----
  { id: 'ny_little_italy', cityId: 'ny', name: 'Little Italy', wealth: 1.0, policing: 1.1, contracts: 'Restaurant Row redevelopment' },
  { id: 'ny_red_hook', cityId: 'ny', name: 'Red Hook Docks', wealth: 1.15, policing: 0.8, contracts: 'Container terminal expansion' },
  { id: 'ny_harlem', cityId: 'ny', name: 'Harlem', wealth: 0.8, policing: 1.0, contracts: 'Housing authority repairs' },
  { id: 'ny_midtown', cityId: 'ny', name: 'Midtown', wealth: 1.5, policing: 1.4, contracts: 'Esplanade waterfront project' },
  { id: 'ny_bensonhurst', cityId: 'ny', name: 'Bensonhurst', wealth: 0.95, policing: 0.85, contracts: 'Sanitation carting routes' },
  { id: 'ny_bronx', cityId: 'ny', name: 'The Bronx', wealth: 0.75, policing: 0.9, contracts: 'Cross-borough expressway' },

  // ---- Chicago ----
  { id: 'chi_loop', cityId: 'chi', name: 'The Loop', wealth: 1.45, policing: 1.35, contracts: 'Transit authority tunnelling' },
  { id: 'chi_cicero', cityId: 'chi', name: 'Cicero', wealth: 0.9, policing: 0.65, contracts: 'County road resurfacing' },
  { id: 'chi_south_side', cityId: 'chi', name: 'South Side', wealth: 0.75, policing: 0.95, contracts: 'Public housing demolition' },
  { id: 'chi_rush_street', cityId: 'chi', name: 'Rush Street', wealth: 1.25, policing: 1.15, contracts: 'Liquor licence overhaul' },
  { id: 'chi_stockyards', cityId: 'chi', name: 'The Stockyards', wealth: 0.85, policing: 0.75, contracts: 'Meatpackers union contract' },
  { id: 'chi_chinatown', cityId: 'chi', name: 'Chinatown', wealth: 1.0, policing: 1.0, contracts: 'Riverfront rezoning' },

  // ---- Las Vegas ----
  { id: 'lv_strip', cityId: 'lv', name: 'The Strip', wealth: 1.6, policing: 1.3, contracts: 'Resort licence and gaming board' },
  { id: 'lv_fremont', cityId: 'lv', name: 'Fremont Street', wealth: 1.15, policing: 1.05, contracts: 'Downtown revitalisation' },
  { id: 'lv_paradise', cityId: 'lv', name: 'Paradise', wealth: 1.1, policing: 0.9, contracts: 'Convention centre build-out' },
  { id: 'lv_north', cityId: 'lv', name: 'North Las Vegas', wealth: 0.7, policing: 0.7, contracts: 'Water district pipeline' },
  { id: 'lv_boulder', cityId: 'lv', name: 'Boulder Highway', wealth: 0.8, policing: 0.6, contracts: 'Highway motel corridor' },
  { id: 'lv_henderson', cityId: 'lv', name: 'Henderson', wealth: 0.95, policing: 0.8, contracts: 'Industrial park zoning' },

  // ---- Los Angeles ----
  { id: 'la_hollywood', cityId: 'la', name: 'Hollywood', wealth: 1.55, policing: 1.2, contracts: 'Studio backlot redevelopment' },
  { id: 'la_downtown', cityId: 'la', name: 'Downtown', wealth: 1.3, policing: 1.35, contracts: 'Civic centre construction' },
  { id: 'la_venice', cityId: 'la', name: 'Venice Beach', wealth: 1.05, policing: 0.85, contracts: 'Boardwalk concessions' },
  { id: 'la_san_pedro', cityId: 'la', name: 'San Pedro Docks', wealth: 1.2, policing: 0.75, contracts: 'Harbour freight terminal' },
  { id: 'la_valley', cityId: 'la', name: 'The Valley', wealth: 0.9, policing: 0.8, contracts: 'Freeway interchange' },
  { id: 'la_boyle_heights', cityId: 'la', name: 'Boyle Heights', wealth: 0.7, policing: 0.9, contracts: 'East side housing scheme' },
];

export const cityById = (id) => CITIES.find((c) => c.id === id);
export const districtById = (id) => DISTRICTS.find((d) => d.id === id);
export const districtsOf = (cityId) => DISTRICTS.filter((d) => d.cityId === cityId);

export function travelCost(fromCityId, toCityId) {
  if (fromCityId === toCityId) return 0;
  const to = cityById(toCityId);
  return to?.travelCostFrom?.[fromCityId] ?? 500;
}

/** Flight time in minutes between cities (halved if you own a private plane). */
export function travelMinutes(fromCityId, toCityId) {
  if (fromCityId === toCityId) return 0;
  const coastToCoast =
    (fromCityId === 'ny' && (toCityId === 'lv' || toCityId === 'la')) ||
    (toCityId === 'ny' && (fromCityId === 'lv' || fromCityId === 'la'));
  if (coastToCoast) return 45;
  if ((fromCityId === 'lv' && toCityId === 'la') || (fromCityId === 'la' && toCityId === 'lv')) return 15;
  return 30;
}
