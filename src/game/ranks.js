/**
 * The three pathways and the ranks inside each.
 *
 * `level` is used for ordering and for "rank of arrestee" bonuses.
 * `salary` is the weekly wage paid by the payroll cron (clean money).
 */

export const PATHS = {
  MAFIA: 'mafia',
  POLITICIAN: 'politician',
  POLICE: 'police',
  CIVILIAN: 'civilian', // has not chosen yet
};

export const PATH_META = {
  [PATHS.MAFIA]: {
    id: PATHS.MAFIA,
    label: 'Mafia',
    entryRank: 'hoodlum',
    blurb:
      'Earn dirty, kick up, get made. Take rackets, hold districts, and the ' +
      'ceiling is a family of your own — five seats per city and no sixth.',
  },
  [PATHS.POLITICIAN]: {
    id: PATHS.POLITICIAN,
    label: 'Politician',
    entryRank: 'staffer',
    blurb:
      'You do not earn, you award. Contracts, pardons and the law itself. ' +
      'Everything you have is on loan from the voters.',
  },
  [PATHS.POLICE]: {
    id: PATHS.POLICE,
    label: 'Police',
    entryRank: 'rookie',
    blurb:
      'Salary is steady and small. Arrests pay bonuses. So do bribes — ' +
      'nobody has ever checked which one paid for the boat.',
  },
};

export const RANKS = {
  // ---- Mafia ----
  hoodlum: {
    id: 'hoodlum', path: PATHS.MAFIA, level: 1, label: 'Hoodlum',
    salary: 0, kickUpPct: 0,
    blurb: 'On the mafia path but unattached. No family, no protection, no cut taken.',
  },
  associate: {
    id: 'associate', path: PATHS.MAFIA, level: 2, label: 'Associate',
    salary: 0, kickUpPct: 0,
    blurb: 'Signed on with a family but not made. Does not kick up yet — and is owed nothing.',
  },
  soldier: {
    id: 'soldier', path: PATHS.MAFIA, level: 3, label: 'Soldier',
    salary: 0, kickUpPct: 10,
    blurb: 'Made. Kicks 10% up weekly, to a captain if in a crew, otherwise straight to the boss.',
  },
  captain: {
    id: 'captain', path: PATHS.MAFIA, level: 4, label: 'Captain',
    salary: 0, kickUpPct: 10,
    blurb: 'Runs a crew named after them. Collects 10% from the crew, kicks 10% of their own up to the boss.',
  },
  boss: {
    id: 'boss', path: PATHS.MAFIA, level: 5, label: 'Boss',
    salary: 0, kickUpPct: 0,
    blurb: 'Runs the family. Collects from every captain. Can be voted down to soldier by a majority of the family.',
  },

  // ---- Politician ----
  staffer: {
    id: 'staffer', path: PATHS.POLITICIAN, level: 1, label: 'Staffer',
    salary: 900,
    blurb: 'On the ballot path, holding no office. Small wage, big access.',
  },
  councilman: {
    id: 'councilman', path: PATHS.POLITICIAN, level: 2, label: 'Councilman',
    salary: 6500, seat: 'district', termDays: 7,
    blurb: 'Holds one district. Awards small contracts. Re-elected weekly.',
  },
  mayor: {
    id: 'mayor', path: PATHS.POLITICIAN, level: 3, label: 'Mayor',
    salary: 24000, seat: 'city', termDays: 30,
    blurb: 'Holds a city. Sets city law, awards big contracts, pardons within the city. Re-elected monthly.',
  },
  president: {
    id: 'president', path: PATHS.POLITICIAN, level: 4, label: 'President',
    salary: 60000, seat: 'nation', termDays: 60,
    blurb: 'Holds everything. Sets federal law, awards the huge contracts, pardons anyone, points the police at anyone.',
  },

  // ---- Police ----
  rookie: {
    id: 'rookie', path: PATHS.POLICE, level: 1, label: 'Rookie',
    salary: 1200,
    blurb: 'Badged but unassigned. Pick a department to start working cases.',
  },
  cop: {
    id: 'cop', path: PATHS.POLICE, level: 2, label: 'Officer',
    salary: 4500,
    blurb: 'Assigned to a district department. Investigates, arrests, and takes what is offered.',
  },
  lieutenant: {
    id: 'lieutenant', path: PATHS.POLICE, level: 3, label: 'Lieutenant',
    salary: 12000, seat: 'district',
    blurb: 'Runs a district department. Names it, staffs it, and points it at a family.',
  },
  chief: {
    id: 'chief', path: PATHS.POLICE, level: 4, label: 'Chief of Police',
    salary: 30000, seat: 'city',
    blurb: 'Runs a city force. Appointed by the ranking politician, or by seniority if the seat is vacant.',
  },

  civilian: {
    id: 'civilian', path: PATHS.CIVILIAN, level: 0, label: 'Civilian',
    salary: 0,
    blurb: 'Fresh off the bus. Pick a path.',
  },
};

export const rank = (id) => RANKS[id] || RANKS.civilian;
export const ranksOfPath = (path) =>
  Object.values(RANKS).filter((r) => r.path === path).sort((a, b) => a.level - b.level);

/** Used for the police arrest bonus — a bigger name is worth more. */
export function arrestBonusMultiplier(rankId) {
  const lvl = rank(rankId).level;
  return 1 + lvl * 0.45;
}
