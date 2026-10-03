export type LifePath = 'mafia' | 'politician' | 'police';

export interface City {
  id: string;
  name: string;
  short_code: string;
  tagline: string;
  signature: string;
  signature_label: string;
  signature_blurb: string;
  sort_order: number;
}

export interface District {
  id: string;
  city_id: string;
  name: string;
  wealth: number;
  policing: number;
  flavour: string;
  sort_order: number;
}

export interface Character {
  id: string;
  profile_id: string;
  first_name: string;
  nickname: string | null;
  last_name: string;
  bio: string;
  avatar_url: string | null;
  path: LifePath;
  rank_id: string;
  city_id: string;
  district_id: string;
  clean: number;
  dirty: number;
  respect: number;
  heat: number;
  nerve: number;
  nerve_max: number;
  health: number;
  jail_until: string | null;
  jail_city_id: string | null;
  immune_until: string;
  created_at: string;
  /** Rolling laundering allowance, reset server-side once the window passes. */
  laundered_amount: number;
  laundered_since: string;
  family_id: string | null;
  crew_id: string | null;
  joined_family_at: string | null;
  /** Derived server-side by get_me(). */
  display_name: string;
  jailed: boolean;
  jail_seconds_left: number;
  immune: boolean;
}

export interface Profile {
  username: string;
  created_at: string;
  is_admin: boolean;
  muted_until: string | null;
}

/** The one payload the shell needs to render. */
export interface Me {
  character: Character | null;
  city?: City;
  district?: District;
  profile: Profile;
  vault: number;
  family: MyFamily | null;
  crew: MyCrew | null;
  server_time?: string;
  has_dead_character?: boolean;
}

export interface Crime {
  id: string;
  tier: 1 | 2 | 3;
  name: string;
  flavour: string;
  payout: number;
  nerve_cost: number;
  cooldown_seconds: number;
  base_success: number;
  heat: number;
  sentence_seconds: number;
  min_respect: number;
  city_id: string | null;
  sort_order: number;
  /** Live, computed per player by list_crimes(). */
  chance: number;
  expected_payout: number;
  locked: boolean;
  cooldown_left: number;
}

export interface CrimeResult {
  success: boolean;
  arrested: boolean;
  payout: number;
  respect_gained: number;
  heat_gained: number;
  sentence_seconds: number;
  chance: number;
  crime: string;
  flavour: string;
  me: Me;
}

export interface ChatMessage {
  id: number;
  channel: string;
  character_id: string | null;
  author_name: string;
  body: string;
  created_at: string;
}

export interface GameEvent {
  id: number;
  scope: string;
  kind: string;
  body: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface LeaderboardRow {
  id: string;
  name: string;
  path: LifePath;
  rank_id: string;
  city: string;
  respect: number;
  clean: number;
  heat: number;
}

// ---------------------------------------------------------------- families --

export interface FamilySummary {
  id: string;
  name: string;
  motto: string;
  logo: string;
  city_id: string;
  city: string;
  founded_at: string;
  boss: string | null;
  member_count: number;
  crew_count: number;
}

export interface FamilyListing {
  families: FamilySummary[];
  seats_per_city: number;
  founding_cost: number;
}

export interface FamilyMember {
  id: string;
  name: string;
  rank_id: string;
  respect: number;
  crew_id: string | null;
  district_id: string;
  joined_at: string | null;
}

export interface FamilyCrew {
  id: string;
  name: string;
  district_id: string;
  district: string;
  captain: { id: string; name: string };
  size: number;
}

export interface FamilyDetail {
  id: string;
  name: string;
  motto: string;
  logo: string;
  city_id: string;
  city: string;
  treasury: number;
  founded_at: string;
  boss: { id: string; name: string; respect: number } | null;
  member_count: number;
  cities: { id: string; name: string }[];
  crews: FamilyCrew[];
  members: FamilyMember[];
}

/** The slice of family standing carried in every get_me() payload. */
export interface MyFamily {
  id: string;
  name: string;
  logo: string;
  motto: string;
  city_id: string;
  treasury: number;
  is_boss: boolean;
}

export interface MyCrew {
  id: string;
  name: string;
  district_id: string;
  is_captain: boolean;
}

export interface BossVoteResult {
  demoted: boolean;
  votes: number;
  eligible: number;
  needed?: number;
}

// ----------------------------------------------------------------- rackets --

export interface Racket {
  id: string;
  type_id: string;
  name: string;
  blurb: string;
  defence: number;
  income: number;
  price: number;
  owner_family_id: string | null;
  owner: { id: string; name: string; logo: string } | null;
  owner_crew: string | null;
  mine: boolean;
  defenders: number;
  grace_seconds: number;
  chance: number;
}

export interface DistrictControl {
  family_id: string | null;
  contested: boolean;
  held: number;
  total: number;
  standings: { family_id: string; name: string; logo: string; held: number }[];
}

export interface RacketListing {
  district: { id: string; name: string; wealth: number; policing: number };
  rackets: Racket[];
  control: DistrictControl;
  /** Family members standing in this district besides you — your muscle. */
  backup: number;
  can_act: boolean;
  is_boss_or_captain: boolean;
  nerve_cost: number;
  treasury: number | null;
}

export interface TakeoverResult {
  success: boolean;
  chance: number;
  backup: number;
  defenders: number;
  racket: string;
  district: string;
  heat_gained: number;
  rackets: RacketListing;
  me: Me;
}

export interface CityMap {
  city_id: string;
  districts: {
    id: string;
    name: string;
    wealth: number;
    policing: number;
    here: boolean;
    control: DistrictControl;
  }[];
}
