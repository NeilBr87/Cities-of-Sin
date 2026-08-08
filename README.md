# Cities of Sin

A multiplayer browser RPG. Three cities, three ways up, and one economy all three fight
over.

You arrive as nobody. You pick a life — **mafia**, **politician**, or **police** — and
from there the game is about the other two. The mafia cannot reach its biggest scores
without a politician awarding contracts. Politicians cannot fund campaigns without
somebody dirty. Police get paid either way, by the city or by whoever is buying.

There are only ever **five families**, and somebody already has four of them.

---

## Running it

```bash
npm install
npm start
```

Open http://localhost:3000, sign up, name yourself, and pick a path.

**It works with no backend.** The app ships with a complete in-browser mock server
(`src/api/mock/`) that implements every rule and persists to `localStorage`. You can
commit crimes, found a family, run for office, get arrested, bribe your way out and run
the weekly economy without setting up anything.

To point it at a real backend, create `.env`:

```
REACT_APP_XANO_BASE=https://your-instance.xano.io/api:your_group
REACT_APP_ERA=seventies        # or nineties, or modern
```

Nothing else changes. The mock and the real backend implement the same routes, and
`src/api/client.js` picks between them on that one variable.

---

## Documentation

| Document | What is in it |
|---|---|
| **[docs/GAME_DESIGN.md](docs/GAME_DESIGN.md)** | The full ruleset: paths, ranks, crime tiers, the money model, kick-ups, elections, prison. Also lists what is deliberately not built yet |
| **[docs/XANO_SETUP.md](docs/XANO_SETUP.md)** | Step-by-step backend build: 21 table schemas, every endpoint's function stack, background tasks, realtime, and a security checklist. Written to be handed to a browser agent |

---

## How it is put together

```
src/
  game/          Static game data and every formula. No React, no network.
    era.js         The setting — 1979 / 1994 / 2026, switchable
    world.js       3 cities, 18 districts, travel costs
    ranks.js       The three paths and their ranks
    crimes.js      3 tiers of crime + police actions
    items.js       Guns, armour, vehicles, property, laundering fronts
    economy.js     Every tunable number and every outcome formula
  api/
    index.js       The complete API surface — one function per endpoint
    client.js      Picks mock or Xano based on one env variable
    mock/          A full working backend in the browser
  state/           Auth and player state
  components/      Layout, chat, shared UI
  pages/           One file per screen
```

**`src/game/economy.js` is the specification.** The client uses it to predict outcomes
so the UI can show real odds and grey out what you cannot afford. The server uses the
same formulas to decide what actually happens. The server always wins — if they
disagree, the client is the bug.

**The mock backend is executable documentation.** Every authorisation rule in
`src/api/mock/adapter.js` is a rule the real backend has to enforce too. When
`XANO_SETUP.md` is ambiguous, that file is the answer.

---

## A few decisions worth knowing about

**The era is configurable, not fixed.** The brief left the setting open between 1970 and
modern, so it is one switch. It changes surveillance, forensics, whether wire transfers
exist, and which items are on sale.

**Associates do not kick up.** The brief said captains collect from "soldiers and
associates" but also that associates "don't kick up". The more specific rule won.
`CONFIG.ASSOCIATES_KICK_UP` flips it.

**Dirty money dies with you.** Clean money survives. That is the entire reason to
launder, and the entire reason a boss with $2M dirty in a rented room is a target.

**Sentences are capped at 24 hours** regardless of what a President legislates.
Otherwise the first hostile administration benches the whole mafia for a week.

**Chat channels are derived from who you are**, never stored as memberships — so
`family:3` cannot be read by guessing the number.

---

## Developer tools

When running on the mock backend, the dashboard has two buttons:

- **Run the weekly tick** — fires the whole weekly economy immediately (salaries,
  kick-ups, upkeep, laundering resets, interest, territory decay) so you can watch a
  week of money movement in a second instead of waiting for a cron.
- **Reset the world** — wipes `localStorage` and re-seeds.

---

## Status

The frontend is complete and playable end to end against the mock backend. The Xano
backend is specified in full but not built — that is the next step, and
`docs/XANO_SETUP.md` §12 has the build order that gets you to a playable server fastest.

Known gaps are listed honestly at the end of `docs/GAME_DESIGN.md`.
