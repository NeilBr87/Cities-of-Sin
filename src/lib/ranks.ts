/**
 * Display metadata for paths and ranks.
 *
 * Presentation only. Every rule that depends on a rank — who can kick whom, who
 * collects what — lives in Postgres. If a number here ever matters to an
 * outcome, it is in the wrong file.
 */

import type { LifePath } from './types';

export interface PathMeta {
  id: LifePath;
  label: string;
  entryRank: string;
  tagline: string;
  blurb: string;
}

export const PATHS: Record<LifePath, PathMeta> = {
  mafia: {
    id: 'mafia',
    label: 'Mafia',
    entryRank: 'hoodlum',
    tagline: 'Earn dirty. Kick up. Get made.',
    blurb:
      'Nobody pays you a wage. You take rackets, hold districts, and the ceiling ' +
      'is a family of your own — five seats per city and no sixth.',
  },
  politician: {
    id: 'politician',
    label: 'Politician',
    entryRank: 'staffer',
    tagline: 'You do not earn. You award.',
    blurb:
      'Contracts, pardons and the law itself. Everything you have is on loan ' +
      'from the voters, and the voters are all in this game.',
  },
  police: {
    id: 'police',
    label: 'Police',
    entryRank: 'rookie',
    tagline: 'The salary is steady. The salary is small.',
    blurb:
      'Arrests pay bonuses. So do bribes, and nobody has ever checked which one ' +
      'paid for the boat.',
  },
};

export interface RankMeta {
  id: string;
  path: LifePath;
  level: number;
  label: string;
  blurb: string;
}

export const RANKS: Record<string, RankMeta> = {
  // ---- Mafia ----
  hoodlum: {
    id: 'hoodlum', path: 'mafia', level: 1, label: 'Hoodlum',
    blurb: 'On the path but unattached. No family, no protection, and nobody taking a cut.',
  },
  associate: {
    id: 'associate', path: 'mafia', level: 2, label: 'Associate',
    blurb: 'Signed on with a family but not made. Kicks up nothing, and is owed nothing.',
  },
  soldier: {
    id: 'soldier', path: 'mafia', level: 3, label: 'Soldier',
    blurb: 'Made. Ten percent goes up every week, to a captain if you have one.',
  },
  captain: {
    id: 'captain', path: 'mafia', level: 4, label: 'Captain',
    blurb: 'Runs a crew that carries your name. Collects from it, and kicks up from yourself.',
  },
  boss: {
    id: 'boss', path: 'mafia', level: 5, label: 'Boss',
    blurb: 'Runs the family. Collects from every captain. Can be voted down by your own people.',
  },

  // ---- Politician ----
  staffer: {
    id: 'staffer', path: 'politician', level: 1, label: 'Staffer',
    blurb: 'On the ballot path, holding no office. Small wage, useful access.',
  },
  councilman: {
    id: 'councilman', path: 'politician', level: 2, label: 'Councilman',
    blurb: 'Holds one district. Awards small contracts. Re-elected weekly.',
  },
  mayor: {
    id: 'mayor', path: 'politician', level: 3, label: 'Mayor',
    blurb: 'Holds a city. Sets city law, awards the big contracts, pardons inside the line.',
  },
  president: {
    id: 'president', path: 'politician', level: 4, label: 'President',
    blurb: 'Holds everything. Sets federal law, pardons anyone, points the police at anyone.',
  },

  // ---- Police ----
  rookie: {
    id: 'rookie', path: 'police', level: 1, label: 'Rookie',
    blurb: 'Badged but unassigned. Pick a department to start working cases.',
  },
  cop: {
    id: 'cop', path: 'police', level: 2, label: 'Officer',
    blurb: 'Assigned to a district. Investigates, arrests, and takes what is offered.',
  },
  lieutenant: {
    id: 'lieutenant', path: 'police', level: 3, label: 'Lieutenant',
    blurb: 'Runs a district department. Names it, staffs it, and points it at a family.',
  },
  chief: {
    id: 'chief', path: 'police', level: 4, label: 'Chief of Police',
    blurb: 'Runs a city force. Appointed by the ranking politician, or by seniority.',
  },
};

export const rankOf = (id: string): RankMeta =>
  RANKS[id] ?? { id, path: 'mafia', level: 0, label: id, blurb: '' };
