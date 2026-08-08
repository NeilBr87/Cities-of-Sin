/**
 * A tiny localStorage-backed database for the mock backend.
 *
 * Table names and record shapes match the Xano tables described in
 * docs/XANO_SETUP.md one-for-one, so reading this file is a fast way to see
 * what the real database needs to hold.
 */

import { seed } from './seed';

const KEY = 'cos.db.v1';

export const TABLES = [
  'users', 'players', 'families', 'crews', 'parties', 'departments',
  'properties', 'fronts', 'inventory', 'elections', 'votes', 'offices',
  'laws', 'contracts', 'hits', 'cases', 'messages', 'logs', 'dominance',
  'cooldowns', 'directives',
];

let db = null;

function emptyDb() {
  const d = { _seq: 1 };
  TABLES.forEach((t) => { d[t] = []; });
  return d;
}

export function load() {
  if (db) return db;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      db = JSON.parse(raw);
      TABLES.forEach((t) => { if (!db[t]) db[t] = []; });
      return db;
    }
  } catch {
    /* corrupt or unavailable — fall through to a fresh seed */
  }
  db = emptyDb();
  seed(db, nextId);
  save();
  return db;
}

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    /* quota or private mode — the session still works in memory */
  }
}

export function reset() {
  db = emptyDb();
  seed(db, nextId);
  save();
  return db;
}

export function nextId() {
  const d = db || load();
  return d._seq++;
}

// ---- Tiny query helpers -----------------------------------------------------

export const all = (table) => load()[table];
export const find = (table, fn) => load()[table].find(fn);
export const byId = (table, id) => load()[table].find((r) => String(r.id) === String(id));
export const filter = (table, fn) => load()[table].filter(fn);

export function insert(table, record) {
  const row = { id: nextId(), createdAt: new Date().toISOString(), ...record };
  load()[table].push(row);
  save();
  return row;
}

export function update(table, id, changes) {
  const row = byId(table, id);
  if (!row) return null;
  Object.assign(row, changes);
  save();
  return row;
}

export function remove(table, id) {
  const t = load()[table];
  const i = t.findIndex((r) => String(r.id) === String(id));
  if (i >= 0) t.splice(i, 1);
  save();
}

export function log(playerId, type, text, meta = {}) {
  insert('logs', { playerId, type, text, meta, at: new Date().toISOString() });
}
