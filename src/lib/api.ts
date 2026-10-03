/**
 * The whole API surface.
 *
 * Every gameplay call is an RPC to a SECURITY DEFINER function in Postgres —
 * the client has no write access to any gameplay table, so this file is not a
 * convenience wrapper, it is the only door. Reads that need no logic go
 * straight through PostgREST with RLS doing the scoping.
 */

import { supabase } from './supabase';
import type {
  BossVoteResult, ChatMessage, City, Crime, CrimeResult, District, FamilyDetail,
  FamilyListing, GameEvent, LeaderboardRow, LifePath, Me,
} from './types';

/** Postgres RAISE messages arrive as `error.message`; surface them verbatim. */
async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

// --------------------------------------------------------------------- auth --

export const auth = {
  async signUp(email: string, password: string, username: string) {
    const available = await rpc<boolean>('username_available', { p_username: username });
    if (!available) throw new Error('That username is taken, or uses characters it should not.');

    const { error } = await supabase.auth.signUp({
      email,
      password,
      // Read by the handle_new_user() trigger to create the profile row.
      options: { data: { username } },
    });
    if (error) throw new Error(error.message);
  },

  async signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  },

  async signOut() {
    await supabase.auth.signOut();
  },

  usernameAvailable: (username: string) =>
    rpc<boolean>('username_available', { p_username: username }),
};

// ------------------------------------------------------------------ player --

export const player = {
  me: () => rpc<Me>('get_me'),

  create: (input: {
    firstName: string;
    lastName: string;
    nickname: string | null;
    path: LifePath;
    cityId: string;
  }) =>
    rpc<Me>('create_character', {
      p_first_name: input.firstName,
      p_last_name: input.lastName,
      p_nickname: input.nickname,
      p_path: input.path,
      p_city_id: input.cityId,
    }),

  updateBio: (bio: string) => rpc<Me>('update_bio', { p_bio: bio }),
  moveToDistrict: (districtId: string) => rpc<Me>('move_to_district', { p_district_id: districtId }),
  flyToCity: (cityId: string) => rpc<Me>('fly_to_city', { p_city_id: cityId }),
};

// ------------------------------------------------------------------- world --

export const world = {
  async cities() {
    const { data, error } = await supabase.from('cities').select('*').order('sort_order');
    if (error) throw new Error(error.message);
    return (data ?? []) as City[];
  },

  async districts(cityId?: string) {
    let q = supabase.from('districts').select('*').order('sort_order');
    if (cityId) q = q.eq('city_id', cityId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return (data ?? []) as District[];
  },

  /** Everyone standing in a district right now — the reason to look around. */
  async whoIsHere(districtId: string) {
    const { data, error } = await supabase
      .from('characters')
      .select('id, first_name, nickname, last_name, path, rank_id, respect, heat')
      .eq('district_id', districtId)
      .is('died_at', null)
      .order('respect', { ascending: false })
      .limit(40);
    if (error) throw new Error(error.message);
    return data ?? [];
  },
};

// ------------------------------------------------------------------ crimes --

export const crimes = {
  list: () => rpc<Crime[]>('list_crimes'),
  commit: (crimeId: string) => rpc<CrimeResult>('commit_crime', { p_crime_id: crimeId }),

  async history(limit = 20) {
    const { data, error } = await supabase
      .from('crime_attempts')
      .select('*, crimes(name)')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return data ?? [];
  },
};

// -------------------------------------------------------------------- money --

export const money = {
  launder: (amount: number) =>
    rpc<{ spent: number; received: number; me: Me }>('launder', { p_amount: amount }),
  vaultDeposit: (amount: number) =>
    rpc<{ deposited: number; banked: number; me: Me }>('vault_deposit', { p_amount: amount }),
  vaultWithdraw: (amount: number) =>
    rpc<{ withdrawn: number; me: Me }>('vault_withdraw', { p_amount: amount }),
};

// ------------------------------------------------------------------- prison --

export const prison = {
  postBail: () => rpc<{ paid: number; me: Me }>('post_bail'),

  async inmates(cityId: string) {
    const { data, error } = await supabase
      .from('characters')
      .select('id, first_name, nickname, last_name, path, rank_id, jail_until')
      .eq('jail_city_id', cityId)
      .gt('jail_until', new Date().toISOString())
      .order('jail_until');
    if (error) throw new Error(error.message);
    return data ?? [];
  },
};

// --------------------------------------------------------------------- chat --

export const chat = {
  send: (channel: string, body: string) =>
    rpc<number>('send_chat', { p_channel: channel, p_body: body }),

  async history(channel: string, limit = 60) {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('channel', channel)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return ((data ?? []) as ChatMessage[]).reverse();
  },

  /**
   * Realtime. Postgres pushes the INSERT; RLS is re-checked per subscriber, so
   * a player cannot subscribe their way into a room they can't read.
   */
  subscribe(channel: string, onMessage: (m: ChatMessage) => void) {
    const sub = supabase
      .channel(`chat:${channel}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `channel=eq.${channel}` },
        (payload) => onMessage(payload.new as ChatMessage),
      )
      .subscribe();
    return () => void supabase.removeChannel(sub);
  },
};

// ------------------------------------------------------------------- events --

export const events = {
  async recent(scopes: string[], limit = 25) {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .in('scope', scopes)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return (data ?? []) as GameEvent[];
  },

  subscribe(onEvent: (e: GameEvent) => void) {
    const sub = supabase
      .channel('events:feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'events' },
        (payload) => onEvent(payload.new as GameEvent),
      )
      .subscribe();
    return () => void supabase.removeChannel(sub);
  },
};

// ----------------------------------------------------------------- families --

export const families = {
  list: (cityId?: string) => rpc<FamilyListing>('list_families', { p_city_id: cityId ?? null }),

  /** Omit the id for your own family. Returns null if you have none. */
  get: (familyId?: string) =>
    rpc<FamilyDetail | null>('get_family', { p_family_id: familyId ?? null }),

  found: (name: string, motto: string, logo: string) =>
    rpc<FamilyDetail>('found_family', { p_name: name, p_motto: motto, p_logo: logo }),

  update: (name: string, motto: string, logo: string) =>
    rpc<FamilyDetail>('update_family', { p_name: name, p_motto: motto, p_logo: logo }),

  disband: () => rpc<Me>('disband_family'),

  join: (familyId: string) => rpc<Me>('join_family', { p_family_id: familyId }),
  leave: () => rpc<Me>('leave_family'),

  // Boss actions.
  make: (characterId: string) => rpc<FamilyDetail>('make_member', { p_character_id: characterId }),
  promote: (characterId: string, districtId: string) =>
    rpc<FamilyDetail>('promote_to_captain', {
      p_character_id: characterId,
      p_district_id: districtId,
    }),
  demote: (characterId: string) => rpc<FamilyDetail>('demote_captain', { p_character_id: characterId }),
  kick: (characterId: string) => rpc<FamilyDetail>('kick_from_family', { p_character_id: characterId }),
  expand: (cityId: string) => rpc<FamilyDetail>('expand_to_city', { p_city_id: cityId }),
  withdraw: (amount: number) => rpc<Me>('family_withdraw', { p_amount: amount }),

  // Anyone in the family.
  deposit: (amount: number) => rpc<Me>('family_deposit', { p_amount: amount }),
  voteOutBoss: () => rpc<BossVoteResult>('vote_out_boss'),

  // Crews.
  joinCrew: (crewId: string) => rpc<Me>('join_crew', { p_crew_id: crewId }),
  leaveCrew: () => rpc<Me>('leave_crew'),
  kickFromCrew: (characterId: string) =>
    rpc<FamilyDetail>('kick_from_crew', { p_character_id: characterId }),
};

// -------------------------------------------------------------- leaderboard --

export const leaderboard = {
  top: (metric: 'respect' | 'clean' | 'heat' = 'respect') =>
    rpc<LeaderboardRow[]>('leaderboard', { p_metric: metric }),
};

const api = { auth, player, world, crimes, money, prison, chat, events, leaderboard, families };
export default api;
