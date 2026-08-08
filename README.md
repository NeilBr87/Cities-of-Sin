# Cities of Sin

A multiplayer browser RPG. Four cities, three ways up, and one economy all three fight
over.

You arrive as nobody. You pick a life — **mafia**, **politician**, or **police** — and
from there the game is about the other two. The mafia cannot reach its biggest scores
without a politician awarding contracts. Politicians cannot fund campaigns without
somebody dirty. Police get paid either way, by the city or by whoever is buying.

Every district is a list of **rackets**, and whoever holds the most of them owns the
place. There are **five family seats per city** and never a sixth.

And death is permanent. If you are assassinated, that character is finished — you build
a new one, and the only thing you keep is whatever you put in the **Quantum Bank**.

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
| **[docs/GAME_DESIGN.md](docs/GAME_DESIGN.md)** | The full ruleset: paths, ranks, crime tiers, rackets and territory, diplomacy, the money model, kick-ups, elections, prison, permadeath. Also lists what is deliberately not built yet |
| **[docs/XANO_SETUP.md](docs/XANO_SETUP.md)** | Step-by-step backend build: 25 table schemas, every endpoint's function stack, background tasks, realtime, and a security checklist. Written to be handed to a browser agent |

---

## How it is put together

```
src/
  game/          Static game data and every formula. No React, no network.
    era.js         The setting — 1979 / 1994 / 2026, switchable
    world.js       4 cities, 24 districts, travel costs
    ranks.js       The three paths and their ranks
    crimes.js      3 tiers of crime + police actions
    rackets.js     96 regionalised rackets and the takeover formula
    diplomacy.js   Neutral / pact / war / allies and what each permits
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

**War is declared, not requested.** Pacts and alliances need the other boss to agree.
War does not — the other boss is notified rather than asked, because a war you need
permission to start is not a war. One flag in `diplomacy.js` reverses this.

**Solo racket takeovers carry an 18% flat penalty.** That single number is what makes
crews matter. Without it, one rich player takes the whole map alone.

**Racket income is paid dirty.** A family that takes a lot of ground immediately has a
laundering problem, which turns wash capacity into the next thing worth fighting over.

**Associates do not kick up.** The brief said captains collect from "soldiers and
associates" but also that associates "don't kick up". The more specific rule won.
`CONFIG.ASSOCIATES_KICK_UP` flips it.

**All of your money dies with you** — clean and dirty alike. The Quantum Bank is the
only exception, and it charges 10% on the way in. That fee is the design: without it the
vault is free insurance and nobody ever carries anything worth stealing.

**Sentences are capped at 24 hours** regardless of what a President legislates.
Otherwise the first hostile administration benches the whole mafia for a week.

**Chat channels are derived from who you are**, never stored as memberships — so
`family:3` cannot be read by guessing the number.

---

## Developer tools

When running on the mock backend, the dashboard has two buttons:

- **Run the weekly tick** — fires the whole weekly economy immediately (salaries,
  kick-ups, racket income, upkeep, laundering resets, interest) so you can watch a
  week of money movement in a second instead of waiting for a cron.
- **Reset the world** — wipes `localStorage` and re-seeds.

---

## Status

The frontend is complete and playable end to end against the mock backend — including a
public landing page, the full racket and diplomacy systems, and the permadeath and
respawn cycle. The Xano backend is specified in full but not built; `docs/XANO_SETUP.md`
§12 has the build order that gets you to a playable server fastest.

Known gaps are listed honestly at the end of `docs/GAME_DESIGN.md`.
