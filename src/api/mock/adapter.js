/**
 * The mock backend.
 *
 * It implements every route in src/api/index.js against the localStorage store.
 * The rules it enforces are the rules docs/XANO_SETUP.md asks Xano to enforce —
 * treat this file as executable documentation of the server's function stacks.
 */

import * as db from './store';
import { DISTRICTS, CITIES, districtById, cityById, travelCost, travelMinutes } from '../../game/world';
import { CRIMES, crimeById, policeActionById } from '../../game/crimes';
import { RANKS, rank, PATHS } from '../../game/ranks';
import {
  CONFIG, crimeSuccessChance, crimePayout, crimeHeat, sentenceSeconds, bailCost,
  arrestChance, arrestBonus, combatScore, launderOutput, respectForCrime, clamp,
} from '../../game/economy';
import { GUNS, VEHICLES, ARMOUR, PROPERTY_TYPES, FRONTS, itemById, propertyTypeById, frontById, propertyPrice } from '../../game/items';
import { crewName } from '../../game/format';

// ---------------------------------------------------------------- plumbing --

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const fail = (status, message) => { throw new HttpError(status, message); };

const routes = [];
const route = (method, pattern, handler) =>
  routes.push({ method, parts: pattern.split('/').filter(Boolean), handler });

function match(method, pathname) {
  const parts = pathname.split('/').filter(Boolean);
  for (const r of routes) {
    if (r.method !== method || r.parts.length !== parts.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < r.parts.length; i++) {
      const p = r.parts[i];
      if (p.startsWith(':')) params[p.slice(1)] = decodeURIComponent(parts[i]);
      else if (p !== parts[i]) { ok = false; break; }
    }
    if (ok) return { handler: r.handler, params };
  }
  return null;
}

export async function mockRequest(method, path, body, token) {
  // A touch of latency keeps loading states honest during development.
  await new Promise((r) => setTimeout(r, 60));
  const [pathname, qs] = path.split('?');
  const query = Object.fromEntries(new URLSearchParams(qs || ''));
  const m = match(method, pathname);
  if (!m) fail(404, `No mock route for ${method} ${pathname}`);
  try {
    return m.handler({ params: m.params, query, body: body || {}, token });
  } catch (e) {
    if (e instanceof HttpError) {
      const err = new Error(e.message);
      err.status = e.status;
      throw err;
    }
    throw e;
  }
}

// ------------------------------------------------------------ shared logic --

const nowIso = () => new Date().toISOString();
const secsSince = (iso) => (Date.now() - new Date(iso).getTime()) / 1000;

function userFromToken(token) {
  if (!token || !token.startsWith('mock:')) fail(401, 'Not signed in.');
  const user = db.byId('users', token.slice(5));
  if (!user) fail(401, 'Session expired.');
  return user;
}

function currentPlayer(token) {
  const user = userFromToken(token);
  const p = db.find('players', (x) => String(x.userId) === String(user.id));
  if (!p) fail(409, 'No character yet.');
  return tick(p);
}

/** Lazy regeneration: nerve, health and heat all catch up on read. */
function tick(p) {
  const changes = {};
  const elapsed = secsSince(p.nerveAt || nowIso());

  const regen = Math.floor(elapsed / CONFIG.NERVE_REGEN_SEC);
  if (regen > 0 && p.nerve < p.nerveMax) {
    changes.nerve = Math.min(p.nerveMax, p.nerve + regen);
    changes.nerveAt = nowIso();
  } else if (p.nerve >= p.nerveMax) {
    changes.nerveAt = nowIso();
  }

  const healed = Math.floor(elapsed / CONFIG.HEALTH_REGEN_SEC);
  if (healed > 0 && p.health < CONFIG.HEALTH_MAX) {
    changes.health = Math.min(CONFIG.HEALTH_MAX, p.health + healed);
  }

  const cooled = Math.floor((elapsed / 3600) * CONFIG.HEAT_DECAY_PER_HOUR);
  if (cooled > 0 && p.heat > 0) changes.heat = Math.max(0, p.heat - cooled);

  if (p.jailUntil && new Date(p.jailUntil) <= new Date()) {
    changes.jailUntil = null;
    changes.jailCityId = null;
  }

  changes.lastSeen = nowIso();
  return db.update('players', p.id, changes);
}

const inJail = (p) => !!(p.jailUntil && new Date(p.jailUntil) > new Date());
function requireFree(p) {
  if (inJail(p)) fail(403, 'You are in a cell. That is rather the point of a cell.');
}

function spend(p, amount, kind = 'clean') {
  if ((p[kind] ?? 0) < amount) fail(402, `Not enough ${kind} money.`);
  return db.update('players', p.id, { [kind]: p[kind] - amount });
}

function cooldownLeft(playerId, key) {
  const c = db.find('cooldowns', (x) => String(x.playerId) === String(playerId) && x.key === key);
  if (!c) return 0;
  return Math.max(0, Math.round((new Date(c.until).getTime() - Date.now()) / 1000));
}

function setCooldown(playerId, key, seconds) {
  const existing = db.find('cooldowns', (x) => String(x.playerId) === String(playerId) && x.key === key);
  const until = new Date(Date.now() + seconds * 1000).toISOString();
  if (existing) db.update('cooldowns', existing.id, { until });
  else db.insert('cooldowns', { playerId, key, until });
}

function equippedGun(p) {
  const inv = db.filter('inventory', (i) => String(i.playerId) === String(p.id) && i.equipped && i.slot === 'gun')[0];
  return inv ? GUNS.find((g) => g.id === inv.itemId) : null;
}
function equippedArmour(p) {
  const inv = db.filter('inventory', (i) => String(i.playerId) === String(p.id) && i.equipped && i.slot === 'armour')[0];
  return inv ? ARMOUR.find((a) => a.id === inv.itemId) : null;
}
function ownsVehicle(p) {
  return db.filter('inventory', (i) => String(i.playerId) === String(p.id))
    .some((i) => VEHICLES.some((v) => v.id === i.itemId));
}

function familyContracts(familyId) {
  if (!familyId) return [];
  return db.filter('contracts', (c) =>
    String(c.awardedToFamilyId) === String(familyId) && new Date(c.expiresAt) > new Date());
}

function lawFor(category, cityId) {
  const city = db.find('laws', (l) => l.scope === 'city' && l.scopeId === cityId && l.category === category);
  const nation = db.find('laws', (l) => l.scope === 'nation' && l.category === category);
  // Federal law overrides city law, exactly as the brief specifies.
  return nation || city || { sentenceMultiplier: 1, legal: false };
}

function addDominance(familyId, districtId, points) {
  if (!familyId) return;
  const row = db.find('dominance', (d) => String(d.familyId) === String(familyId) && d.districtId === districtId);
  if (row) db.update('dominance', row.id, { points: Math.min(100, row.points + points) });
  else db.insert('dominance', { familyId, districtId, points });
}

/** Public shape of a player — never leaks another player's balances. */
function publicPlayer(p) {
  if (!p) return null;
  return {
    id: p.id, username: p.username, firstName: p.firstName, lastName: p.lastName,
    nickname: p.nickname, bio: p.bio, avatar: p.avatar, path: p.path, rankId: p.rankId,
    cityId: p.cityId, districtId: p.districtId, respect: p.respect, heat: p.heat,
    familyId: p.familyId, crewId: p.crewId, partyId: p.partyId, departmentId: p.departmentId,
    jailUntil: p.jailUntil, health: p.health, isNpc: !!p.isNpc, lastSeen: p.lastSeen,
  };
}

function selfPlayer(p) {
  const gun = equippedGun(p);
  const armour = equippedArmour(p);
  return {
    ...p,
    fullState: true,
    equipped: { gun: gun || null, armour: armour || null },
    family: p.familyId ? db.byId('families', p.familyId) : null,
    crew: p.crewId ? db.byId('crews', p.crewId) : null,
    party: p.partyId ? db.byId('parties', p.partyId) : null,
    department: p.departmentId ? db.byId('departments', p.departmentId) : null,
    contracts: familyContracts(p.familyId).map((c) => c.kind),
    jailSecondsLeft: inJail(p) ? Math.round((new Date(p.jailUntil) - Date.now()) / 1000) : 0,
  };
}

// ------------------------------------------------------------------- auth --

route('POST', '/auth/signup', ({ body }) => {
  const { username, password, email } = body;
  if (!username || username.length < 3) fail(400, 'Username must be at least 3 characters.');
  if (!password || password.length < 6) fail(400, 'Password must be at least 6 characters.');
  if (db.find('users', (u) => u.username.toLowerCase() === username.toLowerCase()))
    fail(409, 'That username is taken.');
  // The mock stores the password in the clear on purpose — it never leaves the
  // browser. Xano hashes it with its built-in password field type.
  const user = db.insert('users', { username, password, email: email || null });
  return { authToken: `mock:${user.id}`, user: { id: user.id, username } };
});

route('POST', '/auth/login', ({ body }) => {
  const user = db.find('users', (u) => u.username.toLowerCase() === (body.username || '').toLowerCase());
  if (!user || user.password !== body.password) fail(401, 'Wrong username or password.');
  return { authToken: `mock:${user.id}`, user: { id: user.id, username: user.username } };
});

route('GET', '/auth/me', ({ token }) => {
  const user = userFromToken(token);
  const p = db.find('players', (x) => String(x.userId) === String(user.id));
  return { user: { id: user.id, username: user.username }, hasCharacter: !!p };
});

// ------------------------------------------------------------------- self --

route('GET', '/me', ({ token }) => selfPlayer(currentPlayer(token)));

route('POST', '/me/character', ({ token, body }) => {
  const user = userFromToken(token);
  if (db.find('players', (x) => String(x.userId) === String(user.id)))
    fail(409, 'You already have a character.');
  const { firstName, lastName, nickname, path, cityId, bio, avatar } = body;
  if (!firstName || !lastName) fail(400, 'A first and last name are required.');
  if (!CITIES.some((c) => c.id === cityId)) fail(400, 'Pick a city.');
  const chosenPath = Object.values(PATHS).includes(path) ? path : PATHS.CIVILIAN;
  const entry = chosenPath === PATHS.CIVILIAN ? 'civilian'
    : chosenPath === PATHS.MAFIA ? 'hoodlum'
      : chosenPath === PATHS.POLICE ? 'rookie' : 'staffer';
  const district = DISTRICTS.find((d) => d.cityId === cityId);
  const p = db.insert('players', {
    userId: user.id, username: user.username,
    firstName, lastName, nickname: nickname || null, bio: bio || '', avatar: avatar || null,
    path: chosenPath, rankId: entry, cityId, districtId: district.id,
    clean: CONFIG.STARTING_CLEAN, dirty: CONFIG.STARTING_DIRTY,
    respect: 0, heat: 0, health: CONFIG.HEALTH_MAX,
    nerve: CONFIG.NERVE_MAX_BASE, nerveMax: CONFIG.NERVE_MAX_BASE, nerveAt: nowIso(),
    skills: { crime: 5, combat: 5, investigation: 5, business: 5 },
    familyId: null, crewId: null, partyId: null, departmentId: null,
    jailUntil: null, jailCityId: null, insidePropertyId: null, isNpc: false, lastSeen: nowIso(),
  });
  db.log(p.id, 'character', `Arrived in ${cityById(cityId).name}.`);
  return selfPlayer(p);
});

route('PATCH', '/me/profile', ({ token, body }) => {
  const p = currentPlayer(token);
  const allowed = ['bio', 'avatar', 'nickname', 'firstName', 'lastName'];
  const changes = {};
  allowed.forEach((k) => { if (body[k] !== undefined) changes[k] = body[k]; });
  return selfPlayer(db.update('players', p.id, changes));
});

route('POST', '/me/path', ({ token, body }) => {
  const p = currentPlayer(token);
  if (p.path !== PATHS.CIVILIAN) fail(409, 'You have already chosen a life.');
  const entry = body.path === PATHS.MAFIA ? 'hoodlum'
    : body.path === PATHS.POLICE ? 'rookie'
      : body.path === PATHS.POLITICIAN ? 'staffer' : null;
  if (!entry) fail(400, 'Unknown path.');
  return selfPlayer(db.update('players', p.id, { path: body.path, rankId: entry }));
});

route('POST', '/me/travel', ({ token, body }) => {
  const p = currentPlayer(token);
  requireFree(p);
  const to = cityById(body.cityId);
  if (!to) fail(400, 'No such city.');
  if (to.id === p.cityId) fail(409, 'You are already there.');
  const cost = travelCost(p.cityId, to.id);
  spend(p, cost, 'clean');
  const district = DISTRICTS.find((d) => d.cityId === to.id);
  const updated = db.update('players', p.id, {
    cityId: to.id, districtId: district.id, insidePropertyId: null,
  });
  db.log(p.id, 'travel', `Flew to ${to.name}.`);
  return { player: selfPlayer(updated), cost, minutes: travelMinutes(p.cityId, to.id) };
});

route('POST', '/me/district', ({ token, body }) => {
  const p = currentPlayer(token);
  requireFree(p);
  const d = districtById(body.districtId);
  if (!d) fail(400, 'No such district.');
  if (d.cityId !== p.cityId) fail(409, 'That district is in another city. Fly there first.');
  return selfPlayer(db.update('players', p.id, { districtId: d.id, insidePropertyId: null }));
});

route('POST', '/me/enter-property', ({ token, body }) => {
  const p = currentPlayer(token);
  const prop = db.byId('properties', body.propertyId);
  if (!prop || String(prop.ownerId) !== String(p.id)) fail(403, 'That is not your door.');
  if (prop.districtId !== p.districtId) fail(409, 'You are not in that district.');
  return selfPlayer(db.update('players', p.id, { insidePropertyId: prop.id }));
});

route('POST', '/me/leave-property', ({ token }) => {
  const p = currentPlayer(token);
  return selfPlayer(db.update('players', p.id, { insidePropertyId: null }));
});

route('GET', '/me/inventory', ({ token }) => {
  const p = currentPlayer(token);
  return db.filter('inventory', (i) => String(i.playerId) === String(p.id))
    .map((i) => ({ ...i, item: itemById(i.itemId) }));
});

route('GET', '/me/property', ({ token }) => {
  const p = currentPlayer(token);
  return {
    properties: db.filter('properties', (x) => String(x.ownerId) === String(p.id))
      .map((x) => ({ ...x, type: propertyTypeById(x.typeId), district: districtById(x.districtId) })),
    fronts: db.filter('fronts', (x) => String(x.ownerId) === String(p.id))
      .map((x) => ({ ...x, front: frontById(x.frontId), district: districtById(x.districtId) })),
  };
});

route('GET', '/me/crew', ({ token }) => {
  const p = currentPlayer(token);
  if (!p.crewId) return null;
  const crew = db.byId('crews', p.crewId);
  return {
    ...crew,
    captain: publicPlayer(db.byId('players', crew.captainId)),
    members: db.filter('players', (x) => String(x.crewId) === String(crew.id)).map(publicPlayer),
  };
});

// ----------------------------------------------------------------- players --

route('GET', '/players/:id', ({ params }) => {
  const p = db.byId('players', params.id);
  if (!p) fail(404, 'No such player.');
  return {
    ...publicPlayer(p),
    family: p.familyId ? db.byId('families', p.familyId) : null,
    crew: p.crewId ? db.byId('crews', p.crewId) : null,
    party: p.partyId ? db.byId('parties', p.partyId) : null,
  };
});

route('GET', '/players', ({ query }) => {
  const q = (query.search || '').toLowerCase();
  return db.filter('players', (p) =>
    !q || p.username.toLowerCase().includes(q) ||
    `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) ||
    (p.nickname || '').toLowerCase().includes(q)
  ).slice(0, 50).map(publicPlayer);
});

route('GET', '/leaderboard', ({ query }) => {
  const metric = ['respect', 'clean', 'heat'].includes(query.metric) ? query.metric : 'respect';
  return db.all('players')
    .slice()
    .sort((a, b) => (b[metric] ?? 0) - (a[metric] ?? 0))
    .slice(0, 50)
    .map((p) => ({ ...publicPlayer(p), metric, value: metric === 'clean' ? undefined : p[metric] }));
});

// ------------------------------------------------------------------ crimes --

route('GET', '/crimes', ({ token }) => {
  const p = currentPlayer(token);
  const district = districtById(p.districtId);
  const gun = equippedGun(p);
  const contracts = familyContracts(p.familyId).map((c) => c.kind);
  const crewSize = p.crewId ? db.filter('players', (x) => String(x.crewId) === String(p.crewId)).length : 0;

  return CRIMES.map((c) => {
    const req = c.requires || {};
    const reasons = [];
    if (req.rank && rank(p.rankId).level < rank(req.rank).level) reasons.push(`Requires ${RANKS[req.rank].label}`);
    if (req.cityId && req.cityId !== p.cityId) reasons.push(`${cityById(req.cityId).name} only`);
    if (req.gun && !gun) reasons.push('Requires a gun');
    if (req.vehicle && !ownsVehicle(p)) reasons.push('Requires a vehicle');
    if (req.crew && crewSize < req.crew) reasons.push(`Requires a crew of ${req.crew}`);
    if (req.contract && !contracts.includes(req.contract)) reasons.push('Requires an awarded contract');
    if (c.lawSensitive) {
      const law = lawFor(c.lawSensitive, p.cityId);
      if (law.legal) reasons.push('Currently legal — no money in it');
    }
    const cd = cooldownLeft(p.id, `crime:${c.id}`);
    return {
      ...c,
      district: district?.name,
      estimatedPayout: Math.round(c.payout * (district?.wealth ?? 1)),
      successChance: crimeSuccessChance(c, p, district, { hasGun: !!gun, crewSize }),
      cooldownLeft: cd,
      locked: reasons.length > 0,
      lockReasons: reasons,
      affordableNerve: p.nerve >= c.nerve,
    };
  });
});

route('POST', '/crimes/commit', ({ token, body }) => {
  const p = currentPlayer(token);
  requireFree(p);
  if (p.path !== PATHS.MAFIA) fail(403, 'That is not your line of work.');

  const crime = crimeById(body.crimeId);
  if (!crime) fail(404, 'No such crime.');

  const district = districtById(p.districtId);
  const gun = equippedGun(p);
  const crewSize = p.crewId ? db.filter('players', (x) => String(x.crewId) === String(p.crewId)).length : 0;
  const req = crime.requires || {};

  if (req.rank && rank(p.rankId).level < rank(req.rank).level) fail(403, `You need to be a ${RANKS[req.rank].label}.`);
  if (req.cityId && req.cityId !== p.cityId) fail(403, `That job only exists in ${cityById(req.cityId).name}.`);
  if (req.gun && !gun) fail(403, 'You need a gun on you for that.');
  if (req.vehicle && !ownsVehicle(p)) fail(403, 'You need a vehicle for that.');
  if (req.crew && crewSize < req.crew) fail(403, `You need at least ${req.crew} in your crew.`);
  if (req.contract && !familyContracts(p.familyId).some((c) => c.kind === req.contract))
    fail(403, 'Your family holds no contract for that. Talk to a politician.');

  const cd = cooldownLeft(p.id, `crime:${crime.id}`);
  if (cd > 0) fail(429, `Too soon. Wait ${cd}s.`);
  if (p.nerve < crime.nerve) fail(403, 'Not enough nerve.');

  const chance = crimeSuccessChance(crime, p, district, { hasGun: !!gun, crewSize });
  const success = Math.random() < chance;

  const heat = crimeHeat(crime, district, success);
  const changes = {
    nerve: p.nerve - crime.nerve,
    nerveAt: nowIso(),
    heat: clamp(p.heat + heat, 0, CONFIG.HEAT_MAX),
  };

  let payout = 0;
  let respect = 0;
  let jailed = null;

  if (success) {
    payout = crimePayout(crime, p, district);
    respect = respectForCrime(crime, true);
    changes.dirty = p.dirty + payout;
    changes.respect = p.respect + respect;
    changes.skills = { ...p.skills, crime: Math.min(100, p.skills.crime + (crime.tier === 1 ? 0.3 : 1)) };
    addDominance(p.familyId, p.districtId, crime.tier === 3 ? CONFIG.DOMINANCE_PER_TIER3 : CONFIG.DOMINANCE_PER_CRIME);
    if (p.familyId) {
      const fam = db.byId('families', p.familyId);
      if (fam) db.update('families', fam.id, { respect: fam.respect + respect });
    }
  } else {
    // A botched job is where most arrests come from.
    const caught = Math.random() < 0.35 + (district?.policing ?? 1) * 0.08;
    if (caught) {
      const law = lawFor(crime.lawSensitive || (crime.tier === 1 ? 'petty' : 'racketeering'), p.cityId);
      const secs = sentenceSeconds(crime, law.sentenceMultiplier ?? 1);
      changes.jailUntil = new Date(Date.now() + secs * 1000).toISOString();
      changes.jailCityId = p.cityId;
      changes.insidePropertyId = null;
      jailed = secs;
    }
  }

  // Every attempt leaves something behind for the police to find.
  db.insert('cases', {
    districtId: p.districtId, cityId: p.cityId, playerId: p.id,
    crimeId: crime.id, evidence: crime.evidence, solved: false, at: nowIso(),
  });

  setCooldown(p.id, `crime:${crime.id}`, crime.cooldownSec);
  const updated = db.update('players', p.id, changes);
  db.log(p.id, 'crime', success ? `Pulled off: ${crime.name}` : `Botched: ${crime.name}`, { payout, jailed });

  return {
    success, payout, respect, heat, jailedSeconds: jailed,
    chance,
    message: success
      ? `${crime.name} — clean. ${payout ? `$${payout.toLocaleString()} dirty.` : ''}`
      : jailed
        ? `${crime.name} went wrong and they had a car on the corner.`
        : `${crime.name} went wrong, but you walked.`,
    player: selfPlayer(updated),
  };
});

route('GET', '/crimes/history', ({ token }) => {
  const p = currentPlayer(token);
  return db.filter('logs', (l) => String(l.playerId) === String(p.id) && l.type === 'crime')
    .slice(-40).reverse();
});

// -------------------------------------------------------------------- bank --

route('GET', '/bank', ({ token }) => {
  const p = currentPlayer(token);
  const fronts = db.filter('fronts', (f) => String(f.ownerId) === String(p.id))
    .map((f) => ({ ...f, def: frontById(f.frontId) }));
  const capacity = fronts.length
    ? fronts.reduce((s, f) => s + (f.def?.weeklyCapacity ?? 0) - (f.usedThisWeek || 0), 0)
    : CONFIG.LAUNDER_NO_FRONT_CAP - (p.launderedThisWeek || 0);
  return {
    clean: p.clean, dirty: p.dirty,
    fronts,
    launderCapacity: Math.max(0, capacity),
    floorRate: CONFIG.LAUNDER_FLOOR_RATE,
  };
});

route('POST', '/bank/launder', ({ token, body }) => {
  const p = currentPlayer(token);
  const amount = Math.floor(body.amount || 0);
  if (amount <= 0) fail(400, 'Nothing to wash.');
  if (p.dirty < amount) fail(402, 'You do not have that much dirty money.');

  let front = null;
  let ownedFront = null;
  if (body.frontId) {
    ownedFront = db.filter('fronts', (f) => String(f.ownerId) === String(p.id))
      .find((f) => String(f.id) === String(body.frontId));
    if (!ownedFront) fail(403, 'You do not own that front.');
    front = frontById(ownedFront.frontId);
    const remaining = front.weeklyCapacity - (ownedFront.usedThisWeek || 0);
    if (amount > remaining) fail(429, `That front can only wash $${remaining.toLocaleString()} more this week.`);
    db.update('fronts', ownedFront.id, { usedThisWeek: (ownedFront.usedThisWeek || 0) + amount });
  } else {
    const used = p.launderedThisWeek || 0;
    if (amount + used > CONFIG.LAUNDER_NO_FRONT_CAP)
      fail(429, `Without a front you can only wash $${CONFIG.LAUNDER_NO_FRONT_CAP.toLocaleString()} a week.`);
    db.update('players', p.id, { launderedThisWeek: used + amount });
  }

  const out = launderOutput(amount, front);
  const updated = db.update('players', p.id, { dirty: p.dirty - amount, clean: p.clean + out });
  db.log(p.id, 'bank', `Washed $${amount.toLocaleString()} into $${out.toLocaleString()} clean.`);
  return { laundered: amount, received: out, rate: front ? front.rate : CONFIG.LAUNDER_FLOOR_RATE, player: selfPlayer(updated) };
});

route('POST', '/bank/transfer', ({ token, body }) => {
  const p = currentPlayer(token);
  const target = db.byId('players', body.toPlayerId);
  if (!target) fail(404, 'No such player.');
  if (String(target.id) === String(p.id)) fail(400, 'You cannot pay yourself.');
  const kind = body.kind === 'dirty' ? 'dirty' : 'clean';
  const amount = Math.floor(body.amount || 0);
  if (amount <= 0) fail(400, 'Amount must be positive.');
  spend(p, amount, kind);
  db.update('players', target.id, { [kind]: (target[kind] || 0) + amount });
  db.log(p.id, 'bank', `Sent $${amount.toLocaleString()} ${kind} to ${target.username}.`);
  return selfPlayer(db.byId('players', p.id));
});

// ------------------------------------------------------------------ market --

route('GET', '/market', ({ token }) => {
  const p = currentPlayer(token);
  return {
    guns: GUNS, armour: ARMOUR, vehicles: VEHICLES,
    propertyTypes: PROPERTY_TYPES.map((t) => ({ ...t, price: propertyPrice(t.id, districtById(p.districtId)) })),
    fronts: FRONTS.filter((f) => !f.cityId || f.cityId === p.cityId),
  };
});

route('POST', '/market/buy', ({ token, body }) => {
  const p = currentPlayer(token);
  const item = itemById(body.itemId);
  if (!item) fail(404, 'Not for sale.');
  const qty = Math.max(1, Math.floor(body.qty || 1));
  spend(p, item.price * qty, 'clean');
  const slot = GUNS.includes(item) ? 'gun' : ARMOUR.includes(item) ? 'armour' : 'vehicle';
  const existing = db.filter('inventory', (i) => String(i.playerId) === String(p.id) && i.itemId === item.id)[0];
  if (existing) db.update('inventory', existing.id, { qty: (existing.qty || 1) + qty });
  else db.insert('inventory', { playerId: p.id, itemId: item.id, qty, slot, equipped: false });
  db.log(p.id, 'market', `Bought ${item.name}.`);
  return { player: selfPlayer(db.byId('players', p.id)) };
});

route('POST', '/market/sell', ({ token, body }) => {
  const p = currentPlayer(token);
  const item = itemById(body.itemId);
  const row = db.filter('inventory', (i) => String(i.playerId) === String(p.id) && i.itemId === body.itemId)[0];
  if (!item || !row) fail(404, 'You do not own that.');
  const qty = Math.min(row.qty || 1, Math.max(1, Math.floor(body.qty || 1)));
  const refund = Math.round(item.price * 0.55) * qty; // the street pays badly
  if ((row.qty || 1) <= qty) db.remove('inventory', row.id);
  else db.update('inventory', row.id, { qty: row.qty - qty });
  db.update('players', p.id, { clean: p.clean + refund });
  return { refund, player: selfPlayer(db.byId('players', p.id)) };
});

route('POST', '/market/equip', ({ token, body }) => {
  const p = currentPlayer(token);
  const row = db.filter('inventory', (i) => String(i.playerId) === String(p.id) && i.itemId === body.itemId)[0];
  if (!row) fail(404, 'You do not own that.');
  db.filter('inventory', (i) => String(i.playerId) === String(p.id) && i.slot === row.slot)
    .forEach((i) => db.update('inventory', i.id, { equipped: false }));
  db.update('inventory', row.id, { equipped: true });
  return selfPlayer(db.byId('players', p.id));
});

// ---------------------------------------------------------------- property --

route('GET', '/property', ({ query }) => {
  const d = districtById(query.districtId);
  if (!d) fail(400, 'No such district.');
  return {
    district: d,
    types: PROPERTY_TYPES.map((t) => ({ ...t, price: propertyPrice(t.id, d) })),
    fronts: FRONTS.filter((f) => !f.cityId || f.cityId === d.cityId)
      .map((f) => ({ ...f, price: Math.round(f.basePrice * d.wealth) })),
  };
});

route('POST', '/property/buy', ({ token, body }) => {
  const p = currentPlayer(token);
  const d = districtById(body.districtId);
  const type = propertyTypeById(body.typeId);
  if (!d || !type) fail(400, 'No such property.');
  const price = propertyPrice(type.id, d);
  spend(p, price, 'clean');
  const prop = db.insert('properties', {
    ownerId: p.id, typeId: type.id, districtId: d.id, cityId: d.cityId,
    safety: type.safety, upkeep: type.upkeep, paidUntil: null,
  });
  db.log(p.id, 'property', `Bought a ${type.name} in ${d.name}.`);
  return { property: prop, player: selfPlayer(db.byId('players', p.id)) };
});

route('POST', '/property/sell', ({ token, body }) => {
  const p = currentPlayer(token);
  const prop = db.byId('properties', body.propertyId);
  if (!prop || String(prop.ownerId) !== String(p.id)) fail(403, 'Not yours to sell.');
  const refund = Math.round(propertyPrice(prop.typeId, districtById(prop.districtId)) * 0.8);
  db.remove('properties', prop.id);
  const changes = { clean: p.clean + refund };
  if (String(p.insidePropertyId) === String(prop.id)) changes.insidePropertyId = null;
  return { refund, player: selfPlayer(db.update('players', p.id, changes)) };
});

route('POST', '/property/front/buy', ({ token, body }) => {
  const p = currentPlayer(token);
  const d = districtById(body.districtId);
  const front = frontById(body.frontId);
  if (!d || !front) fail(400, 'No such business.');
  if (front.cityId && front.cityId !== d.cityId) fail(403, `${front.name} only exists in ${cityById(front.cityId).name}.`);
  const price = Math.round(front.basePrice * d.wealth);
  spend(p, price, 'clean');
  const row = db.insert('fronts', {
    ownerId: p.id, frontId: front.id, districtId: d.id, cityId: d.cityId, usedThisWeek: 0,
  });
  db.log(p.id, 'property', `Bought ${front.name} in ${d.name}.`);
  return { front: row, player: selfPlayer(db.byId('players', p.id)) };
});

// ---------------------------------------------------------------- families --

const familyPublic = (f) => ({
  ...f,
  boss: publicPlayer(db.byId('players', f.bossId)),
  memberCount: db.filter('players', (p) => String(p.familyId) === String(f.id)).length,
  crews: db.filter('crews', (c) => String(c.familyId) === String(f.id)).length,
});

route('GET', '/families', () => ({
  families: db.all('families').map(familyPublic),
  slotsRemaining: Math.max(0, CONFIG.MAX_FAMILIES - db.all('families').length),
  foundingCost: CONFIG.FAMILY_FOUNDING_COST,
}));

route('GET', '/families/:id', ({ params }) => {
  const f = db.byId('families', params.id);
  if (!f) fail(404, 'No such family.');
  return familyPublic(f);
});

route('GET', '/families/:id/members', ({ params }) =>
  db.filter('players', (p) => String(p.familyId) === String(params.id))
    .sort((a, b) => rank(b.rankId).level - rank(a.rankId).level)
    .map(publicPlayer));

route('GET', '/families/:id/crews', ({ params }) =>
  db.filter('crews', (c) => String(c.familyId) === String(params.id))
    .map((c) => ({
      ...c,
      captain: publicPlayer(db.byId('players', c.captainId)),
      size: db.filter('players', (p) => String(p.crewId) === String(c.id)).length,
    })));

route('GET', '/families/:id/treasury', ({ token, params }) => {
  const p = currentPlayer(token);
  const f = db.byId('families', params.id);
  if (!f) fail(404, 'No such family.');
  if (String(p.familyId) !== String(f.id)) fail(403, 'Family business.');
  return { clean: f.treasuryClean, dirty: f.treasuryDirty };
});

route('POST', '/families', ({ token, body }) => {
  const p = currentPlayer(token);
  if (p.path !== PATHS.MAFIA) fail(403, 'Only mafia can start a family.');
  if (p.familyId) fail(409, 'You are already in a family.');
  if (db.all('families').length >= CONFIG.MAX_FAMILIES)
    fail(409, 'All five seats are taken. Somebody has to fall first.');
  const name = (body.name || '').trim();
  if (name.length < 3 || name.length > CONFIG.FAMILY_NAME_MAX) fail(400, 'Family name must be 3–32 characters.');
  if (db.find('families', (f) => f.name.toLowerCase() === name.toLowerCase())) fail(409, 'That name is taken.');
  spend(p, CONFIG.FAMILY_FOUNDING_COST, 'clean');
  const fam = db.insert('families', {
    name, motto: body.motto || '', logo: body.logo || '♠', colour: body.colour || '#b4322c',
    cityId: p.cityId, bossId: p.id, treasuryClean: 0, treasuryDirty: 0, respect: 0,
  });
  const updated = db.update('players', p.id, { familyId: fam.id, rankId: 'boss', crewId: null });
  db.log(p.id, 'family', `Founded the ${name} family.`);
  return { family: familyPublic(fam), player: selfPlayer(updated) };
});

route('PATCH', '/families/:id', ({ token, params, body }) => {
  const p = currentPlayer(token);
  const f = db.byId('families', params.id);
  if (!f) fail(404, 'No such family.');
  if (String(f.bossId) !== String(p.id)) fail(403, 'Only the boss changes the family.');
  const changes = {};
  ['name', 'motto', 'logo', 'colour'].forEach((k) => { if (body[k] !== undefined) changes[k] = body[k]; });
  return familyPublic(db.update('families', f.id, changes));
});

route('DELETE', '/families/:id', ({ token, params }) => {
  const p = currentPlayer(token);
  const f = db.byId('families', params.id);
  if (!f) fail(404, 'No such family.');
  if (String(f.bossId) !== String(p.id)) fail(403, 'Only the boss can disband the family.');
  db.filter('players', (x) => String(x.familyId) === String(f.id))
    .forEach((x) => db.update('players', x.id, { familyId: null, crewId: null, rankId: 'hoodlum' }));
  db.filter('crews', (c) => String(c.familyId) === String(f.id)).forEach((c) => db.remove('crews', c.id));
  db.remove('families', f.id);
  return { ok: true, player: selfPlayer(db.byId('players', p.id)) };
});

route('POST', '/families/:id/join', ({ token, params }) => {
  const p = currentPlayer(token);
  if (p.path !== PATHS.MAFIA) fail(403, 'Wrong line of work.');
  if (p.familyId) fail(409, 'Leave your family first.');
  const f = db.byId('families', params.id);
  if (!f) fail(404, 'No such family.');
  const updated = db.update('players', p.id, { familyId: f.id, rankId: 'associate' });
  db.log(p.id, 'family', `Signed on with the ${f.name} family as an associate.`);
  return selfPlayer(updated);
});

route('POST', '/families/leave', ({ token }) => {
  const p = currentPlayer(token);
  if (!p.familyId) fail(409, 'You are not in a family.');
  const f = db.byId('families', p.familyId);
  if (f && String(f.bossId) === String(p.id)) fail(409, 'A boss does not walk away. Disband, or be voted out.');
  return selfPlayer(db.update('players', p.id, { familyId: null, crewId: null, rankId: 'hoodlum' }));
});

route('POST', '/families/make', ({ token, body }) => {
  const p = currentPlayer(token);
  const f = db.byId('families', p.familyId);
  if (!f || String(f.bossId) !== String(p.id)) fail(403, 'Only the boss makes people.');
  const t = db.byId('players', body.playerId);
  if (!t || String(t.familyId) !== String(f.id)) fail(404, 'Not one of yours.');
  if (t.rankId !== 'associate') fail(409, 'Only associates can be made.');
  if (t.respect < CONFIG.MADE_MIN_RESPECT) fail(403, `They need ${CONFIG.MADE_MIN_RESPECT} respect first. They have ${t.respect}.`);
  db.update('players', t.id, { rankId: 'soldier' });
  db.log(t.id, 'family', `Made a soldier of the ${f.name} family.`);
  return { ok: true };
});

route('POST', '/families/promote', ({ token, body }) => {
  const p = currentPlayer(token);
  const f = db.byId('families', p.familyId);
  if (!f || String(f.bossId) !== String(p.id)) fail(403, 'Only the boss promotes.');
  const t = db.byId('players', body.playerId);
  if (!t || String(t.familyId) !== String(f.id)) fail(404, 'Not one of yours.');
  if (body.rankId !== 'captain') fail(400, 'A boss can promote a soldier to captain.');
  if (t.rankId !== 'soldier') fail(409, 'Only soldiers become captains.');
  const crew = db.insert('crews', {
    name: crewName(t), captainId: t.id, familyId: f.id, cityId: t.cityId, districtId: t.districtId,
  });
  db.update('players', t.id, { rankId: 'captain', crewId: crew.id });
  db.log(t.id, 'family', `Promoted to captain. The ${crew.name} is yours.`);
  return { ok: true, crew };
});

route('POST', '/families/demote', ({ token, body }) => {
  const p = currentPlayer(token);
  const f = db.byId('families', p.familyId);
  if (!f || String(f.bossId) !== String(p.id)) fail(403, 'Only the boss demotes.');
  const t = db.byId('players', body.playerId);
  if (!t || String(t.familyId) !== String(f.id)) fail(404, 'Not one of yours.');
  if (t.rankId === 'captain') {
    const crew = db.find('crews', (c) => String(c.captainId) === String(t.id));
    if (crew) {
      db.filter('players', (x) => String(x.crewId) === String(crew.id))
        .forEach((x) => db.update('players', x.id, { crewId: null }));
      db.remove('crews', crew.id);
    }
    db.update('players', t.id, { rankId: 'soldier', crewId: null });
  } else if (t.rankId === 'soldier') {
    db.update('players', t.id, { rankId: 'associate' });
  } else fail(409, 'Nothing to demote them to.');
  return { ok: true };
});

route('POST', '/families/kick', ({ token, body }) => {
  const p = currentPlayer(token);
  const f = db.byId('families', p.familyId);
  if (!f || String(f.bossId) !== String(p.id)) fail(403, 'Only the boss throws people out.');
  const t = db.byId('players', body.playerId);
  if (!t || String(t.familyId) !== String(f.id)) fail(404, 'Not one of yours.');
  if (String(t.id) === String(p.id)) fail(400, 'You cannot kick yourself.');
  const crew = db.find('crews', (c) => String(c.captainId) === String(t.id));
  if (crew) {
    db.filter('players', (x) => String(x.crewId) === String(crew.id))
      .forEach((x) => db.update('players', x.id, { crewId: null }));
    db.remove('crews', crew.id);
  }
  db.update('players', t.id, { familyId: null, crewId: null, rankId: 'hoodlum' });
  return { ok: true };
});

/**
 * The boss can be voted down to soldier by a strict majority of the family.
 * One vote per member per cooldown window; the count is re-tallied on each vote.
 */
route('POST', '/families/vote-boss', ({ token }) => {
  const p = currentPlayer(token);
  const f = db.byId('families', p.familyId);
  if (!f) fail(409, 'You are not in a family.');
  if (String(f.bossId) === String(p.id)) fail(400, 'You cannot vote against yourself.');

  const key = `bossvote:${f.id}`;
  const existing = db.find('votes', (v) => v.key === key && String(v.playerId) === String(p.id));
  if (existing) fail(409, 'You have already voted.');
  db.insert('votes', { key, playerId: p.id, familyId: f.id, at: nowIso() });

  const members = db.filter('players', (x) => String(x.familyId) === String(f.id));
  const votes = db.filter('votes', (v) => v.key === key).length;
  const needed = Math.floor((members.length - 1) * CONFIG.BOSS_VOTE_OUT_QUORUM) + 1;

  if (votes >= needed) {
    const oldBoss = db.byId('players', f.bossId);
    if (oldBoss) db.update('players', oldBoss.id, { rankId: 'soldier', crewId: null });
    // The most respected captain steps up.
    const heir = members
      .filter((m) => m.rankId === 'captain')
      .sort((a, b) => b.respect - a.respect)[0];
    if (heir) {
      db.update('families', f.id, { bossId: heir.id });
      db.update('players', heir.id, { rankId: 'boss', crewId: null });
    } else {
      db.update('families', f.id, { bossId: null });
    }
    db.filter('votes', (v) => v.key === key).forEach((v) => db.remove('votes', v.id));
    return { ok: true, deposed: true, votes, needed };
  }
  return { ok: true, deposed: false, votes, needed };
});

// ------------------------------------------------------------------- crews --

route('GET', '/crews/:id', ({ params }) => {
  const c = db.byId('crews', params.id);
  if (!c) fail(404, 'No such crew.');
  return {
    ...c,
    captain: publicPlayer(db.byId('players', c.captainId)),
    members: db.filter('players', (p) => String(p.crewId) === String(c.id)).map(publicPlayer),
  };
});

route('POST', '/crews/:id/join', ({ token, params }) => {
  const p = currentPlayer(token);
  const c = db.byId('crews', params.id);
  if (!c) fail(404, 'No such crew.');
  if (String(c.familyId) !== String(p.familyId)) fail(403, 'That crew is not in your family.');
  if (!['soldier', 'associate'].includes(p.rankId)) fail(409, 'Your rank does not join crews.');
  return selfPlayer(db.update('players', p.id, { crewId: c.id }));
});

route('POST', '/crews/leave', ({ token }) => {
  const p = currentPlayer(token);
  if (!p.crewId) fail(409, 'You are not in a crew.');
  const c = db.byId('crews', p.crewId);
  if (c && String(c.captainId) === String(p.id)) fail(409, 'A captain cannot leave their own crew.');
  return selfPlayer(db.update('players', p.id, { crewId: null }));
});

route('POST', '/crews/kick', ({ token, body }) => {
  const p = currentPlayer(token);
  const c = db.find('crews', (x) => String(x.captainId) === String(p.id));
  if (!c) fail(403, 'You do not run a crew.');
  const t = db.byId('players', body.playerId);
  if (!t || String(t.crewId) !== String(c.id)) fail(404, 'Not in your crew.');
  db.update('players', t.id, { crewId: null });
  return { ok: true };
});

route('GET', '/crews/jobs', ({ token }) => {
  const p = currentPlayer(token);
  if (!p.crewId) return [];
  return db.filter('logs', (l) => l.type === 'crewjob' && String(l.meta?.crewId) === String(p.crewId))
    .slice(-20).reverse();
});

route('POST', '/crews/jobs', ({ token, body }) => {
  const p = currentPlayer(token);
  const c = db.find('crews', (x) => String(x.captainId) === String(p.id));
  if (!c) fail(403, 'Only a captain organises jobs.');
  const crime = crimeById(body.crimeId);
  if (!crime || crime.tier === 1) fail(400, 'Pick an organised job or a project.');
  db.log(p.id, 'crewjob', `${c.name}: ${crime.name} organised in ${districtById(p.districtId).name}.`, {
    crewId: c.id, crimeId: crime.id, districtId: p.districtId,
  });
  return { ok: true };
});

route('POST', '/crews/jobs/:id/join', ({ token }) => {
  currentPlayer(token);
  return { ok: true };
});

// -------------------------------------------------------------------- hits --

route('GET', '/hits', ({ token }) => {
  const p = currentPlayer(token);
  return db.filter('hits', (h) => String(h.familyId) === String(p.familyId) && !h.completedAt)
    .map((h) => ({
      ...h,
      target: publicPlayer(db.byId('players', h.targetPlayerId)),
      captain: publicPlayer(db.byId('players', h.captainId)),
      shooter: publicPlayer(db.byId('players', h.shooterId)),
    }));
});

route('POST', '/hits', ({ token, body }) => {
  const p = currentPlayer(token);
  const f = db.byId('families', p.familyId);
  if (!f || String(f.bossId) !== String(p.id)) fail(403, 'Only a boss orders a hit.');
  const target = db.byId('players', body.targetPlayerId);
  if (!target) fail(404, 'No such target.');
  if (String(target.familyId) === String(f.id)) fail(409, 'Not inside the family. Not like this.');
  const bounty = Math.max(CONFIG.ASSASSINATION_CONTRACT_MIN, Math.floor(body.bounty || 0));
  if (f.treasuryClean < bounty) fail(402, 'The treasury cannot cover that.');
  db.update('families', f.id, { treasuryClean: f.treasuryClean - bounty });
  const hit = db.insert('hits', {
    familyId: f.id, orderedBy: p.id, targetPlayerId: target.id,
    bounty, captainId: null, shooterId: null, completedAt: null, success: null,
  });
  db.log(p.id, 'hit', `Ordered a hit on ${target.username} for $${bounty.toLocaleString()}.`);
  return hit;
});

route('POST', '/hits/:id/assign', ({ token, params, body }) => {
  const p = currentPlayer(token);
  const hit = db.byId('hits', params.id);
  if (!hit) fail(404, 'No such contract.');
  const f = db.byId('families', hit.familyId);
  if (String(f.bossId) !== String(p.id)) fail(403, 'Only the boss assigns.');
  const cap = db.byId('players', body.captainId);
  if (!cap || cap.rankId !== 'captain' || String(cap.familyId) !== String(f.id))
    fail(400, 'That is not one of your captains.');
  return db.update('hits', hit.id, { captainId: cap.id });
});

route('POST', '/hits/:id/shooter', ({ token, params, body }) => {
  const p = currentPlayer(token);
  const hit = db.byId('hits', params.id);
  if (!hit) fail(404, 'No such contract.');
  if (String(hit.captainId) !== String(p.id)) fail(403, 'This is not your contract.');
  const shooter = db.byId('players', body.playerId);
  const crew = db.find('crews', (c) => String(c.captainId) === String(p.id));
  if (!shooter || !crew || String(shooter.crewId) !== String(crew.id))
    fail(400, 'Pick somebody from your own crew.');
  return db.update('hits', hit.id, { shooterId: shooter.id });
});

route('POST', '/hits/:id/execute', ({ token, params }) => {
  const p = currentPlayer(token);
  const hit = db.byId('hits', params.id);
  if (!hit) fail(404, 'No such contract.');
  if (String(hit.shooterId) !== String(p.id)) fail(403, 'You are not the shooter.');
  requireFree(p);
  const target = db.byId('players', hit.targetPlayerId);
  if (!target) fail(404, 'Target is gone.');
  if (target.cityId !== p.cityId) fail(409, 'They are in another city.');

  const gun = equippedGun(p);
  if (!gun) fail(403, 'You need a gun.');
  const prop = target.insidePropertyId ? db.byId('properties', target.insidePropertyId) : null;

  const atk = combatScore(p, { gunAttack: gun.attack, armourDefence: equippedArmour(p)?.defence ?? 0 });
  const def = combatScore(target, {
    gunAttack: 0,
    armourDefence: 0,
    propertySafety: prop?.safety ?? 0,
  });
  const success = atk > def;

  if (success) {
    db.update('players', target.id, {
      health: 10, dirty: 0, respect: Math.round(target.respect * (1 - CONFIG.DEATH_RESPECT_LOSS)),
      insidePropertyId: null, heat: 0,
    });
    db.update('players', p.id, {
      clean: p.clean + hit.bounty,
      respect: p.respect + 250,
      heat: clamp(p.heat + 30, 0, CONFIG.HEAT_MAX),
    });
    db.update('hits', hit.id, { completedAt: nowIso(), success: true });
    db.log(p.id, 'hit', `Fulfilled the contract on ${target.username}.`);
  } else {
    db.update('players', p.id, { health: Math.max(5, p.health - 45), heat: clamp(p.heat + 20, 0, CONFIG.HEAT_MAX) });
    db.update('hits', hit.id, { shooterId: null });
    db.log(p.id, 'hit', `The hit on ${target.username} went wrong.`);
  }
  return { success, player: selfPlayer(db.byId('players', p.id)) };
});

// ------------------------------------------------------------------ combat --

route('POST', '/combat/attack', ({ token, body }) => {
  const p = currentPlayer(token);
  requireFree(p);
  const t = db.byId('players', body.targetPlayerId);
  if (!t) fail(404, 'No such player.');
  if (t.cityId !== p.cityId || t.districtId !== p.districtId) fail(409, 'They are not in this district.');
  const gun = equippedGun(p);
  const prop = t.insidePropertyId ? db.byId('properties', t.insidePropertyId) : null;

  const atk = combatScore(p, { gunAttack: gun?.attack ?? 0, armourDefence: equippedArmour(p)?.defence ?? 0 });
  const def = combatScore(t, { armourDefence: 0, propertySafety: prop?.safety ?? 0 });
  const win = atk > def;

  const damage = Math.round(20 + Math.random() * 40);
  if (win) {
    const stolen = Math.round((t.dirty || 0) * 0.25);
    db.update('players', t.id, { health: Math.max(5, t.health - damage), dirty: (t.dirty || 0) - stolen });
    db.update('players', p.id, {
      dirty: p.dirty + stolen, respect: p.respect + 15,
      heat: clamp(p.heat + 8, 0, CONFIG.HEAT_MAX),
      skills: { ...p.skills, combat: Math.min(100, p.skills.combat + 1) },
    });
    db.log(p.id, 'combat', `Beat ${t.username} and took $${stolen.toLocaleString()}.`);
    return { win: true, damage, stolen, player: selfPlayer(db.byId('players', p.id)) };
  }
  db.update('players', p.id, { health: Math.max(5, p.health - damage), heat: clamp(p.heat + 4, 0, CONFIG.HEAT_MAX) });
  db.log(p.id, 'combat', `Came off worse against ${t.username}.`);
  return { win: false, damage, stolen: 0, player: selfPlayer(db.byId('players', p.id)) };
});

route('GET', '/combat/log', ({ token }) => {
  const p = currentPlayer(token);
  return db.filter('logs', (l) => String(l.playerId) === String(p.id) && ['combat', 'hit'].includes(l.type))
    .slice(-30).reverse();
});

// ---------------------------------------------------------------- politics --

const partyPublic = (p) => ({
  ...p,
  leader: publicPlayer(db.byId('players', p.leaderId)),
  memberCount: db.filter('players', (x) => String(x.partyId) === String(p.id)).length,
});

route('GET', '/parties', () => ({
  parties: db.all('parties').map(partyPublic),
  slotsRemaining: Math.max(0, CONFIG.MAX_PARTIES - db.all('parties').length),
  foundingCost: CONFIG.PARTY_FOUNDING_COST,
}));

route('GET', '/parties/:id', ({ params }) => {
  const p = db.byId('parties', params.id);
  if (!p) fail(404, 'No such party.');
  return {
    ...partyPublic(p),
    members: db.filter('players', (m) => String(m.partyId) === String(p.id)).map(publicPlayer),
  };
});

route('POST', '/parties', ({ token, body }) => {
  const p = currentPlayer(token);
  if (p.path !== PATHS.POLITICIAN) fail(403, 'Only politicians found parties.');
  if (p.partyId) fail(409, 'You are already in a party.');
  if (db.all('parties').length >= CONFIG.MAX_PARTIES) fail(409, 'All five party slots are taken.');
  const name = (body.name || '').trim();
  if (name.length < 3) fail(400, 'Party name is too short.');
  spend(p, CONFIG.PARTY_FOUNDING_COST, 'clean');
  const party = db.insert('parties', {
    name, motto: body.motto || '', logo: body.logo || '★', colour: body.colour || '#2f6f8f',
    leaderId: p.id, treasury: 0,
  });
  const updated = db.update('players', p.id, { partyId: party.id });
  return { party: partyPublic(party), player: selfPlayer(updated) };
});

route('PATCH', '/parties/:id', ({ token, params, body }) => {
  const p = currentPlayer(token);
  const party = db.byId('parties', params.id);
  if (!party) fail(404, 'No such party.');
  if (String(party.leaderId) !== String(p.id)) fail(403, 'Only the party leader can change this.');
  const changes = {};
  ['name', 'motto', 'logo', 'colour'].forEach((k) => { if (body[k] !== undefined) changes[k] = body[k]; });
  return partyPublic(db.update('parties', party.id, changes));
});

route('POST', '/parties/:id/join', ({ token, params }) => {
  const p = currentPlayer(token);
  if (p.path !== PATHS.POLITICIAN) fail(403, 'Only politicians join parties.');
  const party = db.byId('parties', params.id);
  if (!party) fail(404, 'No such party.');
  return selfPlayer(db.update('players', p.id, { partyId: party.id }));
});

route('POST', '/parties/leave', ({ token }) => {
  const p = currentPlayer(token);
  const party = p.partyId ? db.byId('parties', p.partyId) : null;
  if (party && String(party.leaderId) === String(p.id)) fail(409, 'A leader cannot abandon the party.');
  return selfPlayer(db.update('players', p.id, { partyId: null }));
});

/** Elections are always open; the cron closes and re-opens them on term end. */
route('GET', '/elections', ({ token }) => {
  const p = currentPlayer(token);
  ensureElections();
  return db.all('elections')
    .filter((e) => !e.closed)
    .map((e) => ({
      ...e,
      scopeName: e.seat === 'nation' ? 'The Nation'
        : e.seat === 'city' ? cityById(e.scopeId)?.name : districtById(e.scopeId)?.name,
      candidates: (e.candidates || []).map((c) => ({
        ...c,
        player: publicPlayer(db.byId('players', c.playerId)),
        party: c.partyId ? db.byId('parties', c.partyId) : null,
      })),
      youVoted: (e.voters || []).some((v) => String(v) === String(p.id)),
      youStand: (e.candidates || []).some((c) => String(c.playerId) === String(p.id)),
    }));
});

function ensureElections() {
  const want = [
    ...DISTRICTS.map((d) => ({ seat: 'district', scopeId: d.id, rankId: 'councilman' })),
    ...CITIES.map((c) => ({ seat: 'city', scopeId: c.id, rankId: 'mayor' })),
    { seat: 'nation', scopeId: 'nation', rankId: 'president' },
  ];
  want.forEach((w) => {
    const open = db.find('elections', (e) => e.seat === w.seat && e.scopeId === w.scopeId && !e.closed);
    if (open) return;
    const days = w.seat === 'district' ? CONFIG.TERM_DAYS.councilman
      : w.seat === 'city' ? CONFIG.TERM_DAYS.mayor : CONFIG.TERM_DAYS.president;
    db.insert('elections', {
      ...w, closed: false, candidates: [], voters: [],
      closesAt: new Date(Date.now() + days * 86400000).toISOString(),
    });
  });
}

route('POST', '/elections/stand', ({ token, body }) => {
  const p = currentPlayer(token);
  if (p.path !== PATHS.POLITICIAN) fail(403, 'Only politicians stand for office.');
  ensureElections();
  const e = db.find('elections', (x) => x.seat === body.seat && x.scopeId === body.scopeId && !x.closed);
  if (!e) fail(404, 'No open election for that seat.');
  if ((e.candidates || []).some((c) => String(c.playerId) === String(p.id))) fail(409, 'You are already standing.');
  const fee = CONFIG.CAMPAIGN_FEE[e.seat] ?? CONFIG.CAMPAIGN_FEE.district;
  spend(p, fee, 'clean');
  const candidates = [...(e.candidates || []), { playerId: p.id, partyId: p.partyId, votes: 0, spend: fee }];
  db.update('elections', e.id, { candidates });
  return { ok: true };
});

route('POST', '/elections/:id/campaign', ({ token, params, body }) => {
  const p = currentPlayer(token);
  const e = db.byId('elections', params.id);
  if (!e || e.closed) fail(404, 'No such election.');
  const cand = (e.candidates || []).find((c) => String(c.playerId) === String(p.id));
  if (!cand) fail(403, 'You are not standing in this election.');
  const spendAmt = Math.floor(body.spend || 0);
  if (spendAmt <= 0) fail(400, 'Spend something.');
  spend(p, spendAmt, 'clean');
  cand.spend = (cand.spend || 0) + spendAmt;
  db.update('elections', e.id, { candidates: e.candidates });
  return { ok: true, totalSpend: cand.spend };
});

route('POST', '/elections/:id/vote', ({ token, params, body }) => {
  const p = currentPlayer(token);
  const e = db.byId('elections', params.id);
  if (!e || e.closed) fail(404, 'No such election.');
  // Everybody votes for the president; only residents vote locally.
  if (e.seat === 'city' && e.scopeId !== p.cityId) fail(403, 'You do not live in that city.');
  if (e.seat === 'district' && e.scopeId !== p.districtId) fail(403, 'You do not live in that district.');
  if ((e.voters || []).some((v) => String(v) === String(p.id))) fail(409, 'You have already voted.');
  const cand = (e.candidates || []).find((c) => String(c.playerId) === String(body.candidateId));
  if (!cand) fail(404, 'No such candidate.');
  cand.votes = (cand.votes || 0) + 1;
  db.update('elections', e.id, { candidates: e.candidates, voters: [...(e.voters || []), p.id] });
  return { ok: true };
});

route('GET', '/offices', () =>
  db.all('offices').map((o) => ({
    ...o,
    holder: publicPlayer(db.byId('players', o.holderId)),
    scopeName: o.seat === 'nation' ? 'The Nation'
      : o.seat === 'city' ? cityById(o.scopeId)?.name : districtById(o.scopeId)?.name,
  })));

route('GET', '/laws', () => db.all('laws'));

route('POST', '/laws', ({ token, body }) => {
  const p = currentPlayer(token);
  const office = db.find('offices', (o) => String(o.holderId) === String(p.id));
  if (!office) fail(403, 'You hold no office.');
  if (office.seat === 'district') fail(403, 'Councilmen do not write law.');
  const scope = office.seat === 'nation' ? 'nation' : 'city';
  const scopeId = office.scopeId;
  const existing = db.find('laws', (l) => l.scope === scope && l.scopeId === scopeId && l.category === body.category);
  const changes = {
    sentenceMultiplier: clamp(Number(body.sentenceMultiplier ?? 1), 0.25, 4),
    legal: !!body.legal,
  };
  if (existing) db.update('laws', existing.id, changes);
  else db.insert('laws', { scope, scopeId, category: body.category, ...changes });
  db.log(p.id, 'law', `Set ${body.category} law (${scope}).`);
  return db.all('laws');
});

route('POST', '/pardons', ({ token, body }) => {
  const p = currentPlayer(token);
  const office = db.find('offices', (o) => String(o.holderId) === String(p.id));
  if (!office) fail(403, 'You hold no office.');
  if (office.seat === 'district') fail(403, 'Councilmen cannot pardon.');
  const t = db.byId('players', body.playerId);
  if (!t) fail(404, 'No such player.');
  if (office.seat === 'city' && t.jailCityId !== office.scopeId) fail(403, 'Not in your city.');
  db.update('players', t.id, { jailUntil: null, jailCityId: null, heat: Math.max(0, t.heat - 20) });
  db.log(p.id, 'pardon', `Pardoned ${t.username}.`);
  return { ok: true };
});

route('GET', '/contracts', () =>
  db.all('contracts').map((c) => ({
    ...c,
    family: c.awardedToFamilyId ? db.byId('families', c.awardedToFamilyId) : null,
    district: districtById(c.districtId),
    awardedBy: publicPlayer(db.byId('players', c.awardedByPlayerId)),
  })));

route('POST', '/contracts/award', ({ token, body }) => {
  const p = currentPlayer(token);
  const office = db.find('offices', (o) => String(o.holderId) === String(p.id));
  if (!office) fail(403, 'You hold no office.');
  const district = districtById(body.districtId);
  if (!district) fail(400, 'No such district.');
  // Reach: councilman = own district, mayor = own city, president = anywhere.
  if (office.seat === 'district' && office.scopeId !== district.id) fail(403, 'Outside your district.');
  if (office.seat === 'city' && office.scopeId !== district.cityId) fail(403, 'Outside your city.');
  const ceiling = office.seat === 'district' ? 60000 : office.seat === 'city' ? 400000 : 1500000;
  const value = clamp(Math.floor(body.value || 0), 1000, ceiling);
  const fam = db.byId('families', body.familyId);
  if (!fam) fail(404, 'No such family.');
  const contract = db.insert('contracts', {
    kind: body.kind, districtId: district.id, cityId: district.cityId,
    title: body.title || district.contracts, value,
    awardedByPlayerId: p.id, awardedToFamilyId: fam.id,
    expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
  });
  db.update('families', fam.id, { treasuryClean: fam.treasuryClean + Math.round(value * 0.2) });
  db.log(p.id, 'contract', `Awarded "${contract.title}" to the ${fam.name} family.`);
  return contract;
});

route('POST', '/police/directive', ({ token, body }) => {
  const p = currentPlayer(token);
  const office = db.find('offices', (o) => String(o.holderId) === String(p.id));
  const isChief = p.rankId === 'chief';
  if (!office && !isChief) fail(403, 'You cannot give the police orders.');
  // A president's directive outranks a mayor's, which outranks a chief's.
  const authority = office?.seat === 'nation' ? 3 : office?.seat === 'city' ? 2 : isChief ? 1 : 0;
  if (!authority) fail(403, 'You cannot give the police orders.');
  const scopeId = body.scopeId || office?.scopeId || p.cityId;
  const existing = db.find('directives', (d) => d.scopeId === scopeId);
  const row = { scopeId, familyId: body.familyId, authority, setBy: p.id, at: nowIso() };
  if (existing) {
    if (existing.authority > authority) fail(403, 'A higher office already set this directive.');
    db.update('directives', existing.id, row);
  } else db.insert('directives', row);
  return { ok: true };
});

// ------------------------------------------------------------------ police --

route('GET', '/departments', ({ query }) =>
  db.filter('departments', (d) => !query.cityId || d.cityId === query.cityId)
    .map((d) => ({
      ...d,
      district: districtById(d.districtId),
      lieutenant: publicPlayer(db.byId('players', d.lieutenantId)),
      size: db.filter('players', (p) => String(p.departmentId) === String(d.id)).length,
    })));

route('GET', '/departments/:id', ({ params }) => {
  const d = db.byId('departments', params.id);
  if (!d) fail(404, 'No such department.');
  return {
    ...d,
    district: districtById(d.districtId),
    lieutenant: publicPlayer(db.byId('players', d.lieutenantId)),
    officers: db.filter('players', (p) => String(p.departmentId) === String(d.id)).map(publicPlayer),
  };
});

route('POST', '/departments', ({ token, body }) => {
  const p = currentPlayer(token);
  if (p.path !== PATHS.POLICE) fail(403, 'Not your force.');
  if (!['lieutenant', 'chief'].includes(p.rankId)) fail(403, 'Only a lieutenant or chief creates a department.');
  const d = districtById(body.districtId);
  if (!d) fail(400, 'No such district.');
  const dept = db.insert('departments', {
    name: body.name || `${d.name} Precinct`, motto: body.motto || '',
    districtId: d.id, cityId: d.cityId, lieutenantId: p.id, targetFamilyId: null, budget: 50000,
  });
  db.update('players', p.id, { departmentId: dept.id });
  return dept;
});

route('PATCH', '/departments/:id', ({ token, params, body }) => {
  const p = currentPlayer(token);
  const dept = db.byId('departments', params.id);
  if (!dept) fail(404, 'No such department.');
  const isChief = p.rankId === 'chief' && p.cityId === dept.cityId;
  if (String(dept.lieutenantId) !== String(p.id) && !isChief) fail(403, 'Not your department.');
  const changes = {};
  ['name', 'motto', 'targetFamilyId'].forEach((k) => { if (body[k] !== undefined) changes[k] = body[k]; });
  return db.update('departments', dept.id, changes);
});

route('DELETE', '/departments/:id', ({ token, params }) => {
  const p = currentPlayer(token);
  const dept = db.byId('departments', params.id);
  if (!dept) fail(404, 'No such department.');
  if (String(dept.lieutenantId) !== String(p.id)) fail(403, 'Only its lieutenant can disband it.');
  db.filter('players', (x) => String(x.departmentId) === String(dept.id))
    .forEach((x) => db.update('players', x.id, { departmentId: null, rankId: x.rankId === 'lieutenant' ? 'cop' : x.rankId }));
  db.remove('departments', dept.id);
  return { ok: true };
});

route('POST', '/departments/:id/join', ({ token, params }) => {
  const p = currentPlayer(token);
  if (p.path !== PATHS.POLICE) fail(403, 'You are not a police officer.');
  const dept = db.byId('departments', params.id);
  if (!dept) fail(404, 'No such department.');
  const changes = { departmentId: dept.id };
  if (p.rankId === 'rookie') changes.rankId = 'cop';
  return selfPlayer(db.update('players', p.id, changes));
});

route('POST', '/departments/kick', ({ token, body }) => {
  const p = currentPlayer(token);
  const dept = db.find('departments', (d) => String(d.lieutenantId) === String(p.id));
  const isChief = p.rankId === 'chief';
  const t = db.byId('players', body.playerId);
  if (!t) fail(404, 'No such officer.');
  if (!dept && !isChief) fail(403, 'You do not run a department.');
  if (dept && String(t.departmentId) !== String(dept.id)) fail(404, 'Not in your department.');
  if (isChief && t.rankId === 'lieutenant' && t.cityId === p.cityId) {
    // A chief can strip a lieutenant of their command.
    const theirs = db.find('departments', (d) => String(d.lieutenantId) === String(t.id));
    if (theirs) db.update('departments', theirs.id, { lieutenantId: null });
    db.update('players', t.id, { rankId: 'cop' });
    return { ok: true };
  }
  db.update('players', t.id, { departmentId: null });
  return { ok: true };
});

route('POST', '/police/chief', ({ token, body }) => {
  const p = currentPlayer(token);
  const office = db.find('offices', (o) => String(o.holderId) === String(p.id));
  const cityId = body.cityId;
  const isMayorHere = office?.seat === 'city' && office.scopeId === cityId;
  const isPresident = office?.seat === 'nation';
  if (!isMayorHere && !isPresident) fail(403, 'Only the mayor of that city or the president appoints a chief.');
  const t = db.byId('players', body.playerId);
  if (!t || t.path !== PATHS.POLICE) fail(400, 'That person is not police.');
  db.filter('players', (x) => x.rankId === 'chief' && x.cityId === cityId)
    .forEach((x) => db.update('players', x.id, { rankId: 'lieutenant' }));
  db.update('players', t.id, { rankId: 'chief', cityId });
  db.log(p.id, 'appointment', `Appointed ${t.username} Chief of Police in ${cityById(cityId).name}.`);
  return { ok: true };
});

route('POST', '/police/action', ({ token, body }) => {
  const p = currentPlayer(token);
  requireFree(p);
  if (p.path !== PATHS.POLICE) fail(403, 'You are not police.');
  const action = policeActionById(body.actionId);
  if (!action) fail(404, 'No such action.');
  const cd = cooldownLeft(p.id, `police:${action.id}`);
  if (cd > 0) fail(429, `Too soon. Wait ${cd}s.`);
  if (p.nerve < action.nerve) fail(403, 'Not enough nerve.');

  const district = districtById(p.districtId);
  const changes = { nerve: p.nerve - action.nerve, nerveAt: nowIso() };
  const pay = Math.round(action.pay * (district?.wealth ?? 1));
  if (action.dirty) changes.dirty = p.dirty + pay;
  else changes.clean = p.clean + pay;
  changes.skills = { ...p.skills, investigation: Math.min(100, p.skills.investigation + 0.5) };

  // Investigative work turns open cases in this district into solved evidence.
  let found = [];
  if (['investigate', 'canvass', 'stakeout', 'raid'].includes(action.id)) {
    const open = db.filter('cases', (c) => c.districtId === p.districtId && !c.solved);
    const directive = db.find('directives', (d) => d.scopeId === p.cityId || d.scopeId === p.districtId);
    const dept = p.departmentId ? db.byId('departments', p.departmentId) : null;
    const targetFamilyId = directive?.familyId || dept?.targetFamilyId || null;

    const relevant = targetFamilyId
      ? open.filter((c) => {
        const suspect = db.byId('players', c.playerId);
        return suspect && String(suspect.familyId) === String(targetFamilyId);
      })
      : open;

    const pool = relevant.length ? relevant : open;
    const take = action.id === 'raid' ? 5 : action.id === 'stakeout' ? 3 : 1;
    found = pool.slice(0, take);
    found.forEach((c) => {
      db.update('cases', c.id, { solved: true, solvedBy: p.id });
      const suspect = db.byId('players', c.playerId);
      if (suspect) db.update('players', suspect.id, { heat: clamp(suspect.heat + c.evidence, 0, CONFIG.HEAT_MAX) });
    });
  }

  setCooldown(p.id, `police:${action.id}`, action.cooldownSec);
  const updated = db.update('players', p.id, changes);
  db.log(p.id, 'police', `${action.name} in ${district?.name}. ${found.length} lead(s).`);
  return {
    pay, dirty: !!action.dirty, leads: found.length,
    suspects: found.map((c) => publicPlayer(db.byId('players', c.playerId))).filter(Boolean),
    player: selfPlayer(updated),
  };
});

route('GET', '/police/cases', ({ token }) => {
  const p = currentPlayer(token);
  return db.filter('cases', (c) => String(c.solvedBy) === String(p.id) || (c.districtId === p.districtId && !c.solved))
    .slice(-40).reverse()
    .map((c) => ({ ...c, suspect: publicPlayer(db.byId('players', c.playerId)), crimeId: c.crimeId }));
});

route('GET', '/police/wanted', ({ query }) =>
  db.filter('players', (p) => p.districtId === query.districtId && p.heat >= CONFIG.HEAT_ARREST_THRESHOLD)
    .sort((a, b) => b.heat - a.heat)
    .map(publicPlayer));

route('POST', '/police/arrest', ({ token, body }) => {
  const p = currentPlayer(token);
  requireFree(p);
  if (p.path !== PATHS.POLICE) fail(403, 'You are not police.');
  const t = db.byId('players', body.targetPlayerId);
  if (!t) fail(404, 'No such player.');
  if (t.districtId !== p.districtId) fail(409, 'Not in your district.');
  if (t.heat < CONFIG.HEAT_ARREST_THRESHOLD)
    fail(403, `Not enough heat on them. You need ${CONFIG.HEAT_ARREST_THRESHOLD}, they have ${t.heat}.`);
  if (inJail(t)) fail(409, 'Already inside.');

  const district = districtById(p.districtId);
  const chance = arrestChance(p, t, district);
  const success = Math.random() < chance;

  if (success) {
    const law = lawFor('racketeering', t.cityId);
    const secs = clamp(
      Math.round(t.heat * 60 * (law.sentenceMultiplier ?? 1)),
      CONFIG.SENTENCE_MIN_SEC, CONFIG.SENTENCE_MAX_SEC
    );
    const bonus = arrestBonus(t);
    db.update('players', t.id, {
      jailUntil: new Date(Date.now() + secs * 1000).toISOString(),
      jailCityId: t.cityId, heat: Math.round(t.heat * 0.3), insidePropertyId: null,
    });
    db.update('players', p.id, {
      clean: p.clean + bonus, respect: p.respect + 20,
      skills: { ...p.skills, investigation: Math.min(100, p.skills.investigation + 2) },
    });
    db.log(p.id, 'arrest', `Arrested ${t.username}. Bonus $${bonus.toLocaleString()}.`);
    return { success: true, bonus, sentenceSeconds: secs, chance, player: selfPlayer(db.byId('players', p.id)) };
  }

  db.update('players', p.id, { health: Math.max(5, p.health - 15) });
  return { success: false, chance, player: selfPlayer(db.byId('players', p.id)) };
});

route('POST', '/police/bribe', ({ token, body }) => {
  const p = currentPlayer(token);
  const officer = db.byId('players', body.officerId);
  if (!officer || officer.path !== PATHS.POLICE) fail(400, 'That is not a police officer.');
  const amount = Math.floor(body.amount || 0);
  if (amount <= 0) fail(400, 'Offer something.');
  if (amount > CONFIG.MAX_BRIBE_PER_DAY) fail(400, 'That is more than anyone will take in a day.');
  spend(p, amount, 'dirty');
  db.update('players', officer.id, { dirty: (officer.dirty || 0) + amount });
  const heatOff = Math.round((amount / 1000) * CONFIG.BRIBE_HEAT_PER_1K);
  const updated = db.update('players', p.id, { heat: Math.max(0, p.heat - heatOff) });
  db.log(p.id, 'bribe', `Paid ${officer.username} $${amount.toLocaleString()}. Heat down ${heatOff}.`);
  return { heatRemoved: heatOff, player: selfPlayer(updated) };
});

// ------------------------------------------------------------------ prison --

const PRISON_ACTIVITIES = [
  { id: 'lift', name: 'Lift Weights', seconds: 60, effect: 'combat +1' },
  { id: 'library', name: 'Read in the Library', seconds: 60, effect: 'business +1' },
  { id: 'contacts', name: 'Work the Yard', seconds: 90, effect: 'crime +1' },
  { id: 'good_behaviour', name: 'Keep Your Head Down', seconds: 0, effect: '-60s from your sentence' },
];

route('GET', '/prison', ({ token }) => {
  const p = currentPlayer(token);
  return {
    inJail: inJail(p),
    secondsLeft: inJail(p) ? Math.round((new Date(p.jailUntil) - Date.now()) / 1000) : 0,
    cityId: p.jailCityId,
    bail: inJail(p) ? bailCost(Math.round((new Date(p.jailUntil) - Date.now()) / 1000)) : 0,
    activities: PRISON_ACTIVITIES,
  };
});

route('GET', '/prison/inmates', ({ query }) =>
  db.filter('players', (p) => inJail(p) && (!query.cityId || p.jailCityId === query.cityId))
    .map((p) => ({
      ...publicPlayer(p),
      secondsLeft: Math.round((new Date(p.jailUntil) - Date.now()) / 1000),
      bail: bailCost(Math.round((new Date(p.jailUntil) - Date.now()) / 1000)),
    })));

route('POST', '/prison/activity', ({ token, body }) => {
  const p = currentPlayer(token);
  if (!inJail(p)) fail(409, 'You are not inside.');
  const act = PRISON_ACTIVITIES.find((a) => a.id === body.activityId);
  if (!act) fail(404, 'No such activity.');
  const cd = cooldownLeft(p.id, `prison:${act.id}`);
  if (cd > 0) fail(429, `Too soon. Wait ${cd}s.`);
  const changes = {};
  if (act.id === 'lift') changes.skills = { ...p.skills, combat: Math.min(100, p.skills.combat + 1) };
  if (act.id === 'library') changes.skills = { ...p.skills, business: Math.min(100, p.skills.business + 1) };
  if (act.id === 'contacts') changes.skills = { ...p.skills, crime: Math.min(100, p.skills.crime + 1) };
  if (act.id === 'good_behaviour') {
    changes.jailUntil = new Date(new Date(p.jailUntil).getTime() - 60000).toISOString();
  }
  setCooldown(p.id, `prison:${act.id}`, 120);
  return { ok: true, effect: act.effect, player: selfPlayer(db.update('players', p.id, changes)) };
});

route('POST', '/prison/bust', ({ token, body }) => {
  const p = currentPlayer(token);
  requireFree(p);
  const t = db.byId('players', body.inmateId);
  if (!t || !inJail(t)) fail(404, 'They are not inside.');
  if (t.jailCityId !== p.cityId) fail(409, 'Wrong city.');
  const cd = cooldownLeft(p.id, 'prison:bust');
  if (cd > 0) fail(429, `Too soon. Wait ${cd}s.`);
  setCooldown(p.id, 'prison:bust', 300);

  const chance = clamp(CONFIG.BUST_BASE_CHANCE + (p.skills.crime / 100) * 0.3 - rank(t.rankId).level * 0.02, 0.05, 0.85);
  if (Math.random() < chance) {
    db.update('players', t.id, { jailUntil: null, jailCityId: null });
    const updated = db.update('players', p.id, {
      respect: p.respect + 40, heat: clamp(p.heat + 10, 0, CONFIG.HEAT_MAX),
    });
    db.log(p.id, 'prison', `Busted ${t.username} out.`);
    return { success: true, chance, player: selfPlayer(updated) };
  }
  const secs = CONFIG.BUST_FAIL_SENTENCE_ADD_SEC;
  const updated = db.update('players', p.id, {
    jailUntil: new Date(Date.now() + secs * 1000).toISOString(),
    jailCityId: p.cityId, insidePropertyId: null,
  });
  return { success: false, chance, jailedSeconds: secs, player: selfPlayer(updated) };
});

route('POST', '/prison/bail', ({ token, body }) => {
  const p = currentPlayer(token);
  const t = db.byId('players', body.inmateId || p.id);
  if (!t || !inJail(t)) fail(404, 'Nobody to bail.');
  const secs = Math.round((new Date(t.jailUntil) - Date.now()) / 1000);
  const cost = bailCost(secs);
  spend(p, cost, 'clean');
  db.update('players', t.id, { jailUntil: null, jailCityId: null });
  db.log(p.id, 'prison', `Paid $${cost.toLocaleString()} bail for ${t.username}.`);
  return { cost, player: selfPlayer(db.byId('players', p.id)) };
});

// -------------------------------------------------------------------- chat --

/**
 * Channel ids are structural, not rows: global, city:<id>, district:<id>,
 * family:<id>, crew:<id>, party:<id>, police:<cityId>, prison:<cityId>.
 * Access is derived from the player, so a channel cannot be joined by guessing.
 */
function visibleChannels(p) {
  const list = [
    { id: 'global', label: 'Global', kind: 'global' },
    { id: `city:${p.cityId}`, label: `${cityById(p.cityId)?.name}`, kind: 'city' },
    { id: `district:${p.districtId}`, label: districtById(p.districtId)?.name, kind: 'district' },
  ];
  if (p.familyId) {
    const f = db.byId('families', p.familyId);
    list.push({ id: `family:${p.familyId}`, label: `${f?.name} Family`, kind: 'family' });
  }
  if (p.crewId) {
    const c = db.byId('crews', p.crewId);
    list.push({ id: `crew:${p.crewId}`, label: c?.name || 'Crew', kind: 'crew' });
  }
  if (p.partyId) {
    const party = db.byId('parties', p.partyId);
    list.push({ id: `party:${p.partyId}`, label: party?.name || 'Party', kind: 'party' });
  }
  if (p.path === PATHS.POLICE) {
    list.push({ id: `police:${p.cityId}`, label: `${cityById(p.cityId)?.short} Police`, kind: 'police' });
    if (p.departmentId) {
      const d = db.byId('departments', p.departmentId);
      list.push({ id: `dept:${p.departmentId}`, label: d?.name || 'Department', kind: 'dept' });
    }
  }
  if (inJail(p)) {
    list.push({ id: `prison:${p.jailCityId}`, label: `${cityById(p.jailCityId)?.short} Prison`, kind: 'prison' });
  }
  return list;
}

function canSee(p, channelId) {
  return visibleChannels(p).some((c) => c.id === channelId);
}

route('GET', '/chat/channels', ({ token }) => visibleChannels(currentPlayer(token)));

route('GET', '/chat/:channelId/messages', ({ token, params, query }) => {
  const p = currentPlayer(token);
  if (!canSee(p, params.channelId)) fail(403, 'You are not in that room.');
  let msgs = db.filter('messages', (m) => m.channelId === params.channelId);
  if (query.since) msgs = msgs.filter((m) => m.at > query.since);
  return msgs.slice(-100).map((m) => ({
    ...m,
    author: publicPlayer(db.byId('players', m.playerId)),
  }));
});

route('POST', '/chat/:channelId/messages', ({ token, params, body }) => {
  const p = currentPlayer(token);
  if (!canSee(p, params.channelId)) fail(403, 'You are not in that room.');
  const text = (body.text || '').trim().slice(0, 500);
  if (!text) fail(400, 'Say something.');
  const msg = db.insert('messages', { channelId: params.channelId, playerId: p.id, text, at: nowIso() });
  return { ...msg, author: publicPlayer(p) };
});

// --------------------------------------------------------------- territory --

route('GET', '/districts/:id', ({ params }) => {
  const d = districtById(params.id);
  if (!d) fail(404, 'No such district.');
  const councilOffice = db.find('offices', (o) => o.seat === 'district' && o.scopeId === d.id);
  return {
    ...d,
    city: cityById(d.cityId),
    councilman: publicPlayer(db.byId('players', councilOffice?.holderId)),
    department: db.find('departments', (x) => x.districtId === d.id) || null,
    dominance: db.filter('dominance', (x) => x.districtId === d.id)
      .map((x) => ({ ...x, family: db.byId('families', x.familyId) }))
      .sort((a, b) => b.points - a.points),
    playersHere: db.filter('players', (p) => p.districtId === d.id && !inJail(p)).map(publicPlayer),
    openCases: db.filter('cases', (c) => c.districtId === d.id && !c.solved).length,
  };
});

route('GET', '/districts/:id/dominance', ({ params }) =>
  db.filter('dominance', (x) => x.districtId === params.id)
    .map((x) => ({ ...x, family: db.byId('families', x.familyId) }))
    .sort((a, b) => b.points - a.points));

route('GET', '/cities/:id', ({ params }) => {
  const c = cityById(params.id);
  if (!c) fail(404, 'No such city.');
  const mayorOffice = db.find('offices', (o) => o.seat === 'city' && o.scopeId === c.id);
  return {
    ...c,
    districts: DISTRICTS.filter((d) => d.cityId === c.id),
    mayor: publicPlayer(db.byId('players', mayorOffice?.holderId)),
    chief: publicPlayer(db.filter('players', (p) => p.rankId === 'chief' && p.cityId === c.id)[0]),
    population: db.filter('players', (p) => p.cityId === c.id).length,
  };
});

// -------------------------------------------------------------- weekly run --

/**
 * The weekly economy tick. In production this is a Xano background task on a
 * cron; here it is a route so you can fire it from the UI and watch it work.
 *
 * Order matters. Everything is calculated from one snapshot taken before any
 * money moves, so that who-gets-processed-first cannot change the outcome.
 */
route('POST', '/dev/run-weekly', ({ token }) => {
  currentPlayer(token);
  const players = db.all('players');
  const snapshot = new Map(players.map((p) => [String(p.id), { clean: p.clean, dirty: p.dirty }]));
  const summary = { salaries: 0, kickUps: 0, upkeep: 0, interest: 0 };

  // 1. Salaries, paid clean.
  players.forEach((p) => {
    const s = rank(p.rankId).salary || 0;
    if (s) {
      db.update('players', p.id, { clean: p.clean + s });
      summary.salaries += s;
    }
  });

  // 2. Kick-ups, calculated from the snapshot.
  const owed = [];
  players.forEach((p) => {
    const r = rank(p.rankId);
    if (!r.kickUpPct) return;
    if (r.id === 'associate' && !CONFIG.ASSOCIATES_KICK_UP) return;
    if (!p.familyId) return;

    const snap = snapshot.get(String(p.id));
    const pool = snap.clean + snap.dirty;
    const amount = Math.round(pool * (r.kickUpPct / 100));
    if (amount <= 0) return;

    let recipientId = null;
    if (r.id === 'captain') {
      recipientId = db.byId('families', p.familyId)?.bossId ?? null;
    } else if (p.crewId) {
      recipientId = db.byId('crews', p.crewId)?.captainId ?? null;
    } else {
      // A made guy with no crew kicks straight up to the boss.
      recipientId = db.byId('families', p.familyId)?.bossId ?? null;
    }
    if (recipientId && String(recipientId) !== String(p.id)) owed.push({ from: p.id, to: recipientId, amount });
  });

  owed.forEach(({ from, to, amount }) => {
    const payer = db.byId('players', from);
    const payee = db.byId('players', to);
    if (!payer || !payee) return;
    // Dirty money first, then clean, per CONFIG.KICK_UP_SOURCE.
    let left = amount;
    const takeDirty = Math.min(payer.dirty, left);
    left -= takeDirty;
    const takeClean = Math.min(payer.clean, left);
    const paid = takeDirty + takeClean;
    db.update('players', payer.id, { dirty: payer.dirty - takeDirty, clean: payer.clean - takeClean });
    db.update('players', payee.id, { dirty: payee.dirty + takeDirty, clean: payee.clean + takeClean });
    summary.kickUps += paid;
    db.log(payer.id, 'kickup', `Kicked $${paid.toLocaleString()} up to ${payee.username}.`);
    db.log(payee.id, 'kickup', `Received $${paid.toLocaleString()} from ${payer.username}.`);
  });

  // 3. Property and front upkeep, and laundering capacity reset.
  db.all('properties').forEach((prop) => {
    const owner = db.byId('players', prop.ownerId);
    if (!owner) return;
    const cost = Math.min(owner.clean, prop.upkeep || 0);
    db.update('players', owner.id, { clean: owner.clean - cost });
    summary.upkeep += cost;
  });
  db.all('fronts').forEach((f) => {
    const def = frontById(f.frontId);
    const owner = db.byId('players', f.ownerId);
    if (owner && def) {
      const cost = Math.min(owner.clean, def.upkeep);
      db.update('players', owner.id, { clean: owner.clean - cost });
      summary.upkeep += cost;
    }
    db.update('fronts', f.id, { usedThisWeek: 0 });
  });
  db.all('players').forEach((p) => {
    if (p.launderedThisWeek) db.update('players', p.id, { launderedThisWeek: 0 });
  });

  // 4. Interest on banked clean money.
  db.all('players').forEach((p) => {
    const i = Math.round(p.clean * CONFIG.BANK_INTEREST_WEEKLY);
    if (i > 0) {
      db.update('players', p.id, { clean: p.clean + i });
      summary.interest += i;
    }
  });

  // 5. Territory decays if nobody works it.
  db.all('dominance').forEach((d) => {
    const decayed = Math.max(0, d.points - CONFIG.DOMINANCE_DECAY_PER_DAY * 7);
    db.update('dominance', d.id, { points: decayed });
  });

  return { ok: true, summary, player: selfPlayer(db.byId('players', currentPlayer(token).id)) };
});

route('POST', '/dev/reset', () => {
  db.reset();
  return { ok: true };
});

export default mockRequest;
