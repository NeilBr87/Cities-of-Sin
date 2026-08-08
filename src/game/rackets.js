/**
 * Rackets.
 *
 * A district is not an abstract score any more — it is a list of rackets, and
 * whoever holds the most of them controls it. Rackets can be bought when nobody
 * owns them and taken by force when somebody does. Taking one is hard and
 * usually needs a crew behind you.
 *
 * Rackets are owned by a **crew** where the taker has one, and by the family
 * directly otherwise (a boss without a crew, for instance). District control is
 * always counted at the family level.
 *
 * Every racket is regional. The same archetype wears a different name in Red
 * Hook than it does on the Sunset Strip, because that is the difference between
 * a world and a spreadsheet.
 */

/** Archetypes carry the numbers; the per-district entries carry the character. */
export const RACKET_TYPES = {
  numbers: { id: 'numbers', label: 'Numbers', income: 2200, defence: 18, price: 45000 },
  protection: { id: 'protection', label: 'Protection', income: 3000, defence: 26, price: 62000 },
  vice: { id: 'vice', label: 'Vice', income: 3800, defence: 30, price: 78000 },
  transport: { id: 'transport', label: 'Transport', income: 4600, defence: 34, price: 96000 },
  union: { id: 'union', label: 'Union', income: 5600, defence: 42, price: 128000 },
  narcotics: { id: 'narcotics', label: 'Narcotics', income: 6800, defence: 46, price: 155000 },
  luxury: { id: 'luxury', label: 'High End', income: 8200, defence: 52, price: 210000 },
};

export const racketType = (id) => RACKET_TYPES[id];

/**
 * Four rackets per district, 24 districts, 96 in the world.
 * `t` is the archetype id; the name is what players actually see.
 */
export const DISTRICT_RACKETS = {
  // ---------------- New York ----------------
  ny_little_italy: [
    { id: 'ny_li_1', t: 'numbers', name: 'The Barber Shop Book' },
    { id: 'ny_li_2', t: 'protection', name: 'Mulberry Street Storefronts' },
    { id: 'ny_li_3', t: 'vice', name: 'The Social Club Card Game' },
    { id: 'ny_li_4', t: 'union', name: 'Restaurant Suppliers Local' },
  ],
  ny_red_hook: [
    { id: 'ny_rh_1', t: 'transport', name: 'Pier 41 Loading Rights' },
    { id: 'ny_rh_2', t: 'union', name: 'Longshoremen Local 1814' },
    { id: 'ny_rh_3', t: 'narcotics', name: 'The Container Pipeline' },
    { id: 'ny_rh_4', t: 'protection', name: 'Warehouse Row Insurance' },
  ],
  ny_harlem: [
    { id: 'ny_ha_1', t: 'numbers', name: 'The Harlem Policy Bank' },
    { id: 'ny_ha_2', t: 'vice', name: 'Lenox Avenue After-Hours' },
    { id: 'ny_ha_3', t: 'narcotics', name: 'The 125th Street Corner' },
    { id: 'ny_ha_4', t: 'protection', name: 'Bodega Collections' },
  ],
  ny_midtown: [
    { id: 'ny_mi_1', t: 'luxury', name: 'The Diamond District Fence' },
    { id: 'ny_mi_2', t: 'vice', name: 'The Midtown Escort Book' },
    { id: 'ny_mi_3', t: 'union', name: 'Hotel Workers Local 6' },
    { id: 'ny_mi_4', t: 'luxury', name: 'Theatre District Ticket Scalping' },
  ],
  ny_bensonhurst: [
    { id: 'ny_be_1', t: 'transport', name: 'Private Carting Routes' },
    { id: 'ny_be_2', t: 'numbers', name: 'The 18th Avenue Wire' },
    { id: 'ny_be_3', t: 'protection', name: 'Contractor Tribute' },
    { id: 'ny_be_4', t: 'vice', name: 'The Basement Sportsbook' },
  ],
  ny_bronx: [
    { id: 'ny_br_1', t: 'transport', name: 'Hunts Point Produce Trucks' },
    { id: 'ny_br_2', t: 'narcotics', name: 'The Grand Concourse Trade' },
    { id: 'ny_br_3', t: 'numbers', name: 'Fordham Road Runners' },
    { id: 'ny_br_4', t: 'protection', name: 'Auto Shop Shakedown' },
  ],

  // ---------------- Chicago ----------------
  chi_loop: [
    { id: 'chi_lo_1', t: 'luxury', name: 'LaSalle Street Loan Sharking' },
    { id: 'chi_lo_2', t: 'union', name: 'Building Trades Council' },
    { id: 'chi_lo_3', t: 'vice', name: 'The Board of Trade Book' },
    { id: 'chi_lo_4', t: 'protection', name: 'Loop Parking Concessions' },
  ],
  chi_cicero: [
    { id: 'chi_ci_1', t: 'vice', name: 'The Cicero Casino Backroom' },
    { id: 'chi_ci_2', t: 'numbers', name: 'Roosevelt Road Bookmaking' },
    { id: 'chi_ci_3', t: 'protection', name: 'Tavern Protection' },
    { id: 'chi_ci_4', t: 'transport', name: 'The Bootleg Cigarette Run' },
  ],
  chi_south_side: [
    { id: 'chi_ss_1', t: 'narcotics', name: 'The Englewood Supply' },
    { id: 'chi_ss_2', t: 'numbers', name: 'South Side Policy Wheel' },
    { id: 'chi_ss_3', t: 'protection', name: 'Corner Store Tribute' },
    { id: 'chi_ss_4', t: 'vice', name: 'The 63rd Street Rooms' },
  ],
  chi_rush_street: [
    { id: 'chi_rs_1', t: 'vice', name: 'The Rush Street Strip' },
    { id: 'chi_rs_2', t: 'luxury', name: 'Gold Coast Chemin de Fer' },
    { id: 'chi_rs_3', t: 'narcotics', name: 'Nightclub Distribution' },
    { id: 'chi_rs_4', t: 'protection', name: 'Liquor Licence Facilitation' },
  ],
  chi_stockyards: [
    { id: 'chi_sy_1', t: 'union', name: 'Meatpackers Local 25' },
    { id: 'chi_sy_2', t: 'transport', name: 'Refrigerated Haulage' },
    { id: 'chi_sy_3', t: 'protection', name: 'Packing House Tribute' },
    { id: 'chi_sy_4', t: 'numbers', name: 'The Yard Gate Book' },
  ],
  chi_chinatown: [
    { id: 'chi_cn_1', t: 'vice', name: 'The Wentworth Gambling Parlour' },
    { id: 'chi_cn_2', t: 'transport', name: 'River Barge Smuggling' },
    { id: 'chi_cn_3', t: 'protection', name: 'Merchant Association Dues' },
    { id: 'chi_cn_4', t: 'narcotics', name: 'The Import Channel' },
  ],

  // ---------------- Las Vegas ----------------
  lv_strip: [
    { id: 'lv_st_1', t: 'luxury', name: 'The Count Room Skim' },
    { id: 'lv_st_2', t: 'luxury', name: 'High Roller Markers' },
    { id: 'lv_st_3', t: 'vice', name: 'The Showroom Escort Ring' },
    { id: 'lv_st_4', t: 'union', name: 'Culinary Workers Local 226' },
  ],
  lv_fremont: [
    { id: 'lv_fr_1', t: 'vice', name: 'Glitter Gulch Slots' },
    { id: 'lv_fr_2', t: 'numbers', name: 'The Downtown Sportsbook' },
    { id: 'lv_fr_3', t: 'protection', name: 'Pawn Shop Row' },
    { id: 'lv_fr_4', t: 'luxury', name: 'The Junket Operation' },
  ],
  lv_paradise: [
    { id: 'lv_pa_1', t: 'transport', name: 'Airport Limousine Rights' },
    { id: 'lv_pa_2', t: 'vice', name: 'Convention Trade Entertainment' },
    { id: 'lv_pa_3', t: 'narcotics', name: 'The Resort Supply Line' },
    { id: 'lv_pa_4', t: 'protection', name: 'Off-Strip Lounges' },
  ],
  lv_north: [
    { id: 'lv_no_1', t: 'narcotics', name: 'The North Town Trade' },
    { id: 'lv_no_2', t: 'numbers', name: 'Neighbourhood Book' },
    { id: 'lv_no_3', t: 'protection', name: 'Liquor Store Collections' },
    { id: 'lv_no_4', t: 'transport', name: 'Salvage Yard Chop Line' },
  ],
  lv_boulder: [
    { id: 'lv_bo_1', t: 'vice', name: 'The Motel Strip Rooms' },
    { id: 'lv_bo_2', t: 'transport', name: 'Highway Freight Hijacking' },
    { id: 'lv_bo_3', t: 'numbers', name: 'Truck Stop Wire Room' },
    { id: 'lv_bo_4', t: 'protection', name: 'Roadhouse Tribute' },
  ],
  lv_henderson: [
    { id: 'lv_he_1', t: 'union', name: 'Chemical Plant Local' },
    { id: 'lv_he_2', t: 'transport', name: 'Industrial Haulage Contracts' },
    { id: 'lv_he_3', t: 'protection', name: 'Warehouse Protection' },
    { id: 'lv_he_4', t: 'numbers', name: 'The Plant Gate Book' },
  ],

  // ---------------- Los Angeles ----------------
  la_hollywood: [
    { id: 'la_ho_1', t: 'union', name: 'Studio Teamsters Local 399' },
    { id: 'la_ho_2', t: 'luxury', name: 'Production Loan Sharking' },
    { id: 'la_ho_3', t: 'vice', name: 'The Sunset Strip Clubs' },
    { id: 'la_ho_4', t: 'narcotics', name: 'The Above-the-Line Supply' },
  ],
  la_downtown: [
    { id: 'la_dt_1', t: 'luxury', name: 'Jewellery District Fencing' },
    { id: 'la_dt_2', t: 'protection', name: 'Garment District Tribute' },
    { id: 'la_dt_3', t: 'union', name: 'Civic Construction Local' },
    { id: 'la_dt_4', t: 'numbers', name: 'The Spring Street Wire' },
  ],
  la_venice: [
    { id: 'la_ve_1', t: 'vice', name: 'Boardwalk Card Rooms' },
    { id: 'la_ve_2', t: 'narcotics', name: 'The Beach Trade' },
    { id: 'la_ve_3', t: 'protection', name: 'Concession Stand Rights' },
    { id: 'la_ve_4', t: 'numbers', name: 'The Pier Book' },
  ],
  la_san_pedro: [
    { id: 'la_sp_1', t: 'transport', name: 'Harbour Loading Rights' },
    { id: 'la_sp_2', t: 'union', name: 'Longshoremen Local 13' },
    { id: 'la_sp_3', t: 'narcotics', name: 'The Pacific Import Line' },
    { id: 'la_sp_4', t: 'protection', name: 'Cannery Row Insurance' },
  ],
  la_valley: [
    { id: 'la_va_1', t: 'vice', name: 'The Valley Film Operation' },
    { id: 'la_va_2', t: 'transport', name: 'Freeway Trucking Routes' },
    { id: 'la_va_3', t: 'numbers', name: 'Van Nuys Bookmaking' },
    { id: 'la_va_4', t: 'protection', name: 'Strip Mall Collections' },
  ],
  la_boyle_heights: [
    { id: 'la_bh_1', t: 'protection', name: 'First Street Merchants' },
    { id: 'la_bh_2', t: 'numbers', name: 'The East Side Book' },
    { id: 'la_bh_3', t: 'narcotics', name: 'The Boyle Heights Corner' },
    { id: 'la_bh_4', t: 'transport', name: 'Produce Market Haulage' },
  ],
};

/** Every racket in the world, flattened, with its district and archetype resolved. */
export const ALL_RACKETS = Object.entries(DISTRICT_RACKETS).flatMap(([districtId, list]) =>
  list.map((r) => ({
    ...r,
    districtId,
    type: r.t,
    ...RACKET_TYPES[r.t],
    id: r.id,
    name: r.name,
    label: RACKET_TYPES[r.t].label,
  }))
);

export const racketById = (id) => ALL_RACKETS.find((r) => r.id === id);
export const racketsOfDistrict = (districtId) => ALL_RACKETS.filter((r) => r.districtId === districtId);

/** Weekly dirty income, scaled by how rich the district is. */
export function racketIncome(racket, district) {
  return Math.round((racket?.income ?? 0) * (district?.wealth ?? 1));
}

/** What it costs to buy an unowned racket outright. */
export function racketPrice(racket, district) {
  return Math.round((racket?.price ?? 0) * (district?.wealth ?? 1));
}

/**
 * Odds of taking a racket by force.
 *
 * Deliberately hostile to lone wolves: a solo attacker with no crew is capped
 * well below even odds against anything above a numbers game. Bringing a crew
 * is the single biggest factor, which is the point — this is the system that
 * makes crews matter.
 */
export function takeoverChance({ attackerCrewSize = 0, attackerSkill = 0, attackerRankLevel = 1, racket, defenderStrength = 0 }) {
  const base = 0.5;
  const crewBonus = Math.min(attackerCrewSize, 8) * 0.055;
  const skillBonus = (attackerSkill / 100) * 0.18;
  const rankBonus = attackerRankLevel * 0.02;
  const racketDefence = (racket?.defence ?? 20) / 100;
  const held = defenderStrength * 0.012; // each defending member makes it harder

  const solo = attackerCrewSize === 0 ? 0.18 : 0;

  return Math.max(0.03, Math.min(0.9,
    base + crewBonus + skillBonus + rankBonus - racketDefence - held - solo));
}
