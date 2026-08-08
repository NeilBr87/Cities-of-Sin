/**
 * Seeds the mock world with enough NPCs, families, parties and departments that
 * a single developer logging in alone still sees a populated city.
 *
 * The same data set is used by docs/XANO_SETUP.md as the suggested launch seed.
 */

import { DISTRICTS, CITIES } from '../../game/world';
import { CONFIG } from '../../game/economy';

const FIRST = ['Vito', 'Sal', 'Frankie', 'Angelo', 'Carmine', 'Rosa', 'Nadia', 'Gio', 'Marco', 'Dom',
  'Lena', 'Bobby', 'Tommy', 'Rita', 'Sonny', 'Vera', 'Nico', 'Joey', 'Gina', 'Paulie'];
const LAST = ['Genovese', 'Marchetti', 'Rossi', 'Barzini', 'Colombo', 'Falcone', 'Moretti', 'Russo',
  'Bruno', 'Vitale', 'Caruso', 'Esposito', 'Lombardi', 'Ricci', 'Greco'];
const NICKS = ['The Boy', 'Two Fingers', 'Ice', 'The Ledger', 'Half-Moon', 'Sunday', 'The Doctor',
  'Lucky', 'Whisper', 'The Nose', null, null, null];

const pick = (arr, i) => arr[i % arr.length];

export function seed(db, nextId) {
  const now = new Date().toISOString();
  const mk = (table, row) => {
    const r = { id: nextId(), createdAt: now, ...row };
    db[table].push(r);
    return r;
  };

  // ---- Families (all five slots filled but two are weak, leaving room for drama) ----
  const familySpecs = [
    { name: 'Marchetti', motto: 'Debts are memories.', logo: '🜏', cityId: 'ny', colour: '#b4322c' },
    { name: 'Barzini', motto: 'Quiet men, loud results.', logo: '⚜', cityId: 'ny', colour: '#c9a227' },
    { name: 'Falcone', motto: 'The lake keeps secrets.', logo: '☠', cityId: 'chi', colour: '#2f6f8f' },
    { name: 'Moretti', motto: 'Everything is negotiable.', logo: '♠', cityId: 'lv', colour: '#6b4a9a' },
  ];

  const families = familySpecs.map((f) =>
    mk('families', {
      ...f,
      treasuryClean: 400000 + Math.floor(Math.random() * 900000),
      treasuryDirty: 120000 + Math.floor(Math.random() * 400000),
      bossId: null,
      respect: 1000 + Math.floor(Math.random() * 4000),
    })
  );

  // ---- Parties ----
  const partySpecs = [
    { name: 'Civic Union Party', motto: 'Work, wages, order.', logo: '⚒', colour: '#2f6f8f' },
    { name: 'Reform Ticket', motto: 'Clean streets, clean books.', logo: '⚖', colour: '#3f8f5f' },
    { name: 'Independence Bloc', motto: 'Nobody owns this seat.', logo: '★', colour: '#c9a227' },
  ];
  const parties = partySpecs.map((p) => mk('parties', { ...p, leaderId: null, treasury: 250000 }));

  // ---- Police departments, one per district in each city ----
  const deptNames = ['Precinct', 'Vice Division', 'Organised Crime Unit', 'Robbery Detail', 'Task Force'];
  const departments = DISTRICTS.map((d, i) =>
    mk('departments', {
      name: `${d.name} ${pick(deptNames, i)}`,
      districtId: d.id,
      cityId: d.cityId,
      lieutenantId: null,
      motto: 'Serve. Protect. Collect.',
      targetFamilyId: null,
      budget: 80000,
    })
  );

  // ---- NPC players ----
  let n = 0;
  const npc = (over) => {
    const i = n++;
    const d = DISTRICTS[i % DISTRICTS.length];
    return mk('players', {
      userId: null,
      username: `${pick(FIRST, i).toLowerCase()}${i}`,
      firstName: pick(FIRST, i),
      lastName: pick(LAST, i),
      nickname: pick(NICKS, i),
      bio: '',
      avatar: null,
      path: 'mafia',
      rankId: 'hoodlum',
      cityId: d.cityId,
      districtId: d.id,
      clean: 5000 + Math.floor(Math.random() * 60000),
      dirty: Math.floor(Math.random() * 40000),
      respect: Math.floor(Math.random() * 900),
      heat: Math.floor(Math.random() * 40),
      health: 100,
      nerve: CONFIG.NERVE_MAX_BASE,
      nerveMax: CONFIG.NERVE_MAX_BASE,
      nerveAt: now,
      skills: { crime: 10 + Math.floor(Math.random() * 50), combat: 10 + Math.floor(Math.random() * 50), investigation: 5, business: 5 },
      familyId: null,
      crewId: null,
      partyId: null,
      departmentId: null,
      jailUntil: null,
      jailCityId: null,
      insidePropertyId: null,
      isNpc: true,
      lastSeen: now,
      ...over,
    });
  };

  // Bosses and captains for each family.
  families.forEach((fam, fi) => {
    const boss = npc({ rankId: 'boss', familyId: fam.id, cityId: fam.cityId, respect: 8000 + fi * 400, clean: 900000 });
    fam.bossId = boss.id;
    for (let c = 0; c < 2; c++) {
      const cap = npc({ rankId: 'captain', familyId: fam.id, cityId: fam.cityId, respect: 3000 });
      const crew = mk('crews', {
        name: `${cap.lastName} Crew`,
        captainId: cap.id,
        familyId: fam.id,
        cityId: fam.cityId,
        districtId: cap.districtId,
      });
      cap.crewId = crew.id;
      for (let s = 0; s < 3; s++) {
        npc({ rankId: 'soldier', familyId: fam.id, crewId: crew.id, cityId: fam.cityId, respect: 900 });
      }
      npc({ rankId: 'associate', familyId: fam.id, crewId: crew.id, cityId: fam.cityId, respect: 300 });
    }
  });

  // Unaffiliated hoodlums.
  for (let i = 0; i < 12; i++) npc({});

  // Police staffing: a chief per city, a lieutenant per department, cops beneath.
  CITIES.forEach((c) => {
    npc({ path: 'police', rankId: 'chief', cityId: c.id, familyId: null, clean: 200000 });
  });
  departments.forEach((dept) => {
    const lt = npc({ path: 'police', rankId: 'lieutenant', cityId: dept.cityId, districtId: dept.districtId, departmentId: dept.id });
    dept.lieutenantId = lt.id;
    for (let i = 0; i < 2; i++) {
      npc({ path: 'police', rankId: 'cop', cityId: dept.cityId, districtId: dept.districtId, departmentId: dept.id });
    }
  });

  // Politicians: a sitting councilman per district, a mayor per city, one president.
  DISTRICTS.forEach((d, i) => {
    const p = npc({ path: 'politician', rankId: 'councilman', cityId: d.cityId, districtId: d.id, partyId: parties[i % parties.length].id });
    mk('offices', { seat: 'district', scopeId: d.id, holderId: p.id, termEndsAt: inDays(CONFIG.TERM_DAYS.councilman) });
  });
  CITIES.forEach((c, i) => {
    const p = npc({ path: 'politician', rankId: 'mayor', cityId: c.id, partyId: parties[i % parties.length].id, clean: 400000 });
    mk('offices', { seat: 'city', scopeId: c.id, holderId: p.id, termEndsAt: inDays(CONFIG.TERM_DAYS.mayor) });
  });
  const prez = npc({ path: 'politician', rankId: 'president', cityId: 'ny', partyId: parties[0].id, clean: 1500000 });
  mk('offices', { seat: 'nation', scopeId: 'nation', holderId: prez.id, termEndsAt: inDays(CONFIG.TERM_DAYS.president) });

  parties.forEach((p, i) => { p.leaderId = db.players.filter((x) => x.partyId === p.id)[0]?.id ?? null; });

  // ---- Law table: one row per crime-ish category, federal scope by default ----
  ['petty', 'violent', 'narcotics', 'racketeering', 'gambling'].forEach((cat) => {
    mk('laws', { scope: 'nation', scopeId: 'nation', category: cat, sentenceMultiplier: 1, legal: cat === 'gambling' });
  });

  // ---- District dominance starts neutral with a light family presence ----
  DISTRICTS.forEach((d) => {
    families.forEach((f) => {
      if (f.cityId !== d.cityId) return;
      mk('dominance', { districtId: d.id, familyId: f.id, points: Math.floor(Math.random() * 35) });
    });
  });

  // ---- A couple of open contracts so tier-3 crimes are reachable on day one ----
  mk('contracts', {
    kind: 'construction', districtId: 'ny_midtown', cityId: 'ny',
    title: 'Esplanade waterfront project', value: 400000,
    awardedByPlayerId: prez.id, awardedToFamilyId: families[0].id,
    expiresAt: inDays(7),
  });
  mk('contracts', {
    kind: 'gaming', districtId: 'lv_strip', cityId: 'lv',
    title: 'Resort licence and gaming board', value: 750000,
    awardedByPlayerId: prez.id, awardedToFamilyId: families[3].id,
    expiresAt: inDays(7),
  });

  // ---- A little ambient chat so the rooms are not empty ----
  const chatter = [
    ['city:ny', 'Anybody seen the docks lately? Barzini crew all over it.'],
    ['city:ny', 'Midtown is crawling. Do not work it tonight.'],
    ['global', 'Five families, four bosses. One slot open. Somebody get rich.'],
    ['global', 'New president, new laws. Check the statute board before you move product.'],
    ['city:chi', 'Cicero is wide open. Policing is a joke out there.'],
    ['city:lv', 'Count room is printing. Somebody is going to get caught eventually.'],
  ];
  const speakers = db.players.filter((p) => p.isNpc).slice(0, 6);
  chatter.forEach(([channelId, text], i) => {
    mk('messages', {
      channelId,
      playerId: speakers[i % speakers.length]?.id ?? null,
      text,
      at: new Date(Date.now() - (chatter.length - i) * 90000).toISOString(),
    });
  });

  return db;
}

function inDays(d) {
  return new Date(Date.now() + d * 86400000).toISOString();
}
