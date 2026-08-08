/**
 * The complete API surface of Cities of Sin.
 *
 * Every function here is one Xano endpoint. The path strings are the contract —
 * `docs/XANO_SETUP.md` builds exactly these, in these API groups, with these
 * request and response shapes. Keep the two in sync.
 */

import { get, post, patch, del, setToken } from './client';

export const auth = {
  signup: async (body) => {
    const r = await post('/auth/signup', body);
    setToken(r.authToken);
    return r;
  },
  login: async (body) => {
    const r = await post('/auth/login', body);
    setToken(r.authToken);
    return r;
  },
  logout: () => setToken(null),
  me: () => get('/auth/me'),
};

export const player = {
  me: () => get('/me'),
  createCharacter: (body) => post('/me/character', body),
  updateProfile: (body) => patch('/me/profile', body),
  choosePath: (path) => post('/me/path', { path }),
  travel: (cityId) => post('/me/travel', { cityId }),
  moveDistrict: (districtId) => post('/me/district', { districtId }),
  enterProperty: (propertyId) => post('/me/enter-property', { propertyId }),
  leaveProperty: () => post('/me/leave-property', {}),
  get: (id) => get(`/players/${id}`),
  search: (q) => get(`/players?search=${encodeURIComponent(q || '')}`),
  leaderboard: (metric = 'respect') => get(`/leaderboard?metric=${metric}`),
};

export const crimes = {
  list: () => get('/crimes'),
  commit: (crimeId, opts = {}) => post('/crimes/commit', { crimeId, ...opts }),
  history: () => get('/crimes/history'),
};

export const bank = {
  summary: () => get('/bank'),
  launder: (amount, frontId) => post('/bank/launder', { amount, frontId }),
  transfer: (toPlayerId, amount, kind) => post('/bank/transfer', { toPlayerId, amount, kind }),
  // The Quantum Bank belongs to the account, not the character. It is the only
  // thing that survives assassination.
  quantumDeposit: (amount) => post('/bank/quantum/deposit', { amount }),
  quantumWithdraw: (amount) => post('/bank/quantum/withdraw', { amount }),
};

export const rackets = {
  ofDistrict: (districtId) => get(`/districts/${districtId}/rackets`),
  mine: () => get('/me/rackets'),
  buy: (racketId) => post('/rackets/buy', { racketId }),
  takeover: (racketId) => post('/rackets/takeover', { racketId }),
};

export const diplomacy = {
  overview: () => get('/diplomacy'),
  propose: (familyId, state) => post('/diplomacy/propose', { familyId, state }),
  respond: (messageId, accept) => post('/diplomacy/respond', { messageId, accept }),
  end: (familyId) => post('/diplomacy/end', { familyId }),
  offerPeace: (familyId, money, racketIds) => post('/diplomacy/peace', { familyId, money, racketIds }),
};

export const market = {
  catalogue: () => get('/market'),
  buyItem: (itemId, qty = 1) => post('/market/buy', { itemId, qty }),
  sellItem: (itemId, qty = 1) => post('/market/sell', { itemId, qty }),
  equip: (itemId, slot) => post('/market/equip', { itemId, slot }),
  inventory: () => get('/me/inventory'),
};

export const property = {
  listings: (districtId) => get(`/property?districtId=${districtId}`),
  mine: () => get('/me/property'),
  buy: (typeId, districtId) => post('/property/buy', { typeId, districtId }),
  sell: (propertyId) => post('/property/sell', { propertyId }),
  buyFront: (frontId, districtId) => post('/property/front/buy', { frontId, districtId }),
};

export const families = {
  list: () => get('/families'),
  get: (id) => get(`/families/${id}`),
  create: (body) => post('/families', body),
  update: (id, body) => patch(`/families/${id}`, body),
  disband: (id) => del(`/families/${id}`),
  join: (id) => post(`/families/${id}/join`, {}),
  leave: () => post('/families/leave', {}),
  members: (id) => get(`/families/${id}/members`),
  makeMember: (playerId) => post('/families/make', { playerId }),
  promote: (playerId, rankId, districtId) => post('/families/promote', { playerId, rankId, districtId }),
  demote: (playerId, rankId) => post('/families/demote', { playerId, rankId }),
  kick: (playerId) => post('/families/kick', { playerId }),
  voteOutBoss: () => post('/families/vote-boss', {}),
  treasury: (id) => get(`/families/${id}/treasury`),
  expand: (cityId) => post('/families/expand', { cityId }),
};

export const crews = {
  mine: () => get('/me/crew'),
  get: (id) => get(`/crews/${id}`),
  ofFamily: (familyId) => get(`/families/${familyId}/crews`),
  join: (crewId) => post(`/crews/${crewId}/join`, {}),
  leave: () => post('/crews/leave', {}),
  kick: (playerId) => post('/crews/kick', { playerId }),
  organiseJob: (body) => post('/crews/jobs', body),
  jobs: () => get('/crews/jobs'),
  joinJob: (jobId) => post(`/crews/jobs/${jobId}/join`, {}),
};

export const hits = {
  order: (targetPlayerId, bounty) => post('/hits', { targetPlayerId, bounty }),
  assignCaptain: (hitId, captainId) => post(`/hits/${hitId}/assign`, { captainId }),
  assignShooter: (hitId, playerId) => post(`/hits/${hitId}/shooter`, { playerId }),
  execute: (hitId) => post(`/hits/${hitId}/execute`, {}),
  list: () => get('/hits'),
};

export const combat = {
  attack: (targetPlayerId) => post('/combat/attack', { targetPlayerId }),
  // Only available against a family you are at war with, and only if you are made.
  assassinate: (targetPlayerId) => post('/combat/assassinate', { targetPlayerId }),
  log: () => get('/combat/log'),
  graves: () => get('/graves'),
};

export const politics = {
  parties: () => get('/parties'),
  party: (id) => get(`/parties/${id}`),
  createParty: (body) => post('/parties', body),
  updateParty: (id, body) => patch(`/parties/${id}`, body),
  joinParty: (id) => post(`/parties/${id}/join`, {}),
  leaveParty: () => post('/parties/leave', {}),
  elections: () => get('/elections'),
  standFor: (seat, scopeId) => post('/elections/stand', { seat, scopeId }),
  campaign: (electionId, spend) => post(`/elections/${electionId}/campaign`, { spend }),
  vote: (electionId, candidateId) => post(`/elections/${electionId}/vote`, { candidateId }),
  offices: () => get('/offices'),
  laws: () => get('/laws'),
  setLaw: (body) => post('/laws', body),
  pardon: (playerId) => post('/pardons', { playerId }),
  contracts: () => get('/contracts'),
  awardContract: (body) => post('/contracts/award', body),
  directPolice: (familyId, scopeId) => post('/police/directive', { familyId, scopeId }),
};

export const police = {
  departments: (cityId) => get(`/departments?cityId=${cityId}`),
  department: (id) => get(`/departments/${id}`),
  createDepartment: (body) => post('/departments', body),
  updateDepartment: (id, body) => patch(`/departments/${id}`, body),
  deleteDepartment: (id) => del(`/departments/${id}`),
  joinDepartment: (id) => post(`/departments/${id}/join`, {}),
  kickFromDepartment: (playerId) => post('/departments/kick', { playerId }),
  appointChief: (playerId, cityId) => post('/police/chief', { playerId, cityId }),
  action: (actionId, opts = {}) => post('/police/action', { actionId, ...opts }),
  cases: () => get('/police/cases'),
  arrest: (targetPlayerId) => post('/police/arrest', { targetPlayerId }),
  offerBribe: (officerId, amount) => post('/police/bribe', { officerId, amount }),
  wanted: (districtId) => get(`/police/wanted?districtId=${districtId}`),
};

export const prison = {
  status: () => get('/prison'),
  inmates: (cityId) => get(`/prison/inmates?cityId=${cityId}`),
  bust: (inmateId) => post('/prison/bust', { inmateId }),
  bail: (inmateId) => post('/prison/bail', { inmateId }),
  activity: (activityId) => post('/prison/activity', { activityId }),
};

export const chat = {
  channels: () => get('/chat/channels'),
  messages: (channelId, since) =>
    get(`/chat/${encodeURIComponent(channelId)}/messages${since ? `?since=${since}` : ''}`),
  send: (channelId, text) => post(`/chat/${encodeURIComponent(channelId)}/messages`, { text }),
};

export const territory = {
  district: (districtId) => get(`/districts/${districtId}`),
  city: (cityId) => get(`/cities/${cityId}`),
};

/**
 * Development helpers. In Xano these are background tasks on a schedule, not
 * endpoints — but having them callable makes the weekly economy testable in
 * seconds instead of in weeks.
 */
export const dev = {
  runWeekly: () => post('/dev/run-weekly', {}),
  resetWorld: () => post('/dev/reset', {}),
};

const api = {
  auth, player, crimes, bank, market, property, families, crews,
  hits, combat, politics, police, prison, chat, territory,
  rackets, diplomacy, dev,
};

export default api;
