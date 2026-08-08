# Xano Backend Setup — Cities of Sin

**These instructions are written to be handed to a browser-driving agent (Claude in
Chrome) with a Xano workspace open.** Each step is atomic and has a stated
verification. Work top to bottom; later steps depend on earlier ones.

The contract this builds is defined by `src/api/index.js` (the exact routes) and
`src/api/mock/adapter.js` (the exact rules each route enforces). When something here is
ambiguous, the mock adapter is the reference implementation — it is executable
documentation of the server.

---

## Before you start

**Read this first, agent:**

1. Do **not** create anything until you have read §1 and confirmed which workspace you
   are in. Creating tables in the wrong workspace is tedious to undo.
2. Xano's UI changes. If a menu name here does not match what you see, find the nearest
   equivalent rather than stopping — the concepts (Database, API, Tasks, Realtime,
   Environment Variables) are stable even when the labels move.
3. After each numbered section, state what you created and what you verified before
   moving on.
4. If a step fails twice, stop and report which step, with the exact error. Do not
   improvise schema changes to route around an error.

**What you need:** a Xano account with a workspace. The free tier is enough to build
and test all of this.

---

## 1. Workspace and API groups

1. Open your Xano workspace. Note its name and instance URL (looks like
   `https://x8ki-abcd-1234.n7.xano.io`). You will need the URL at the very end.
2. Go to **API** and create one API group named **`cos_core`**.
   - Set its **Swagger/Docs** to *Private*.
   - Note the base URL it gives you — it will look like
     `https://x8ki-abcd-1234.n7.xano.io/api:aBcD1234`.

Everything in this build lives in `cos_core`. A single group keeps the auth token and
CORS configuration in one place.

**Verify:** the API group exists and shows an empty endpoint list.

---

## 2. Database tables

Create these in **Database → Add Table**. Field types are Xano's own.

Conventions used throughout:
- Every table gets Xano's default `id` (int, auto-increment) and `created_at`
  (timestamp). Do not remove them.
- `*_id` fields are **Table Reference** type pointing at the named table, except
  `district_id` / `city_id` / `crime_id` / `item_id`, which are **text** — those are
  static game data defined in the frontend (`src/game/world.js`, `crimes.js`,
  `items.js`), not database rows. Keeping them as text means you never have to seed or
  migrate the map.

### 2.1 `users`
Xano may create this for you when you add authentication. If so, extend it.

| Field | Type | Notes |
|---|---|---|
| `username` | text | **Unique index.** Min 3 chars |
| `password` | password | Xano hashes this automatically. Never store plaintext |
| `email` | email | Nullable |
| `quantum` | integer | Default 0. **The Quantum Bank.** It lives on the user, not the player, because that is precisely what makes it survive death |

### 2.2 `players`
The heart of the schema. One row per character; one character per user.

| Field | Type | Default | Notes |
|---|---|---|---|
| `user_id` | table ref → users | | Nullable — NPC seed rows have no user |
| `username` | text | | Denormalised copy, for cheap display |
| `first_name` | text | | |
| `last_name` | text | | |
| `nickname` | text | null | Renders as Johnny 'The Boy' Smith |
| `bio` | text | `""` | |
| `avatar` | text | null | URL |
| `path` | enum | `civilian` | `mafia` `politician` `police` `civilian` |
| `rank_id` | text | `civilian` | Must match an id in `src/game/ranks.js` |
| `city_id` | text | `ny` | |
| `district_id` | text | | |
| `clean` | integer | `2000` | Clean money |
| `dirty` | integer | `0` | Dirty money |
| `respect` | integer | `0` | |
| `heat` | integer | `0` | 0–100 |
| `health` | integer | `100` | |
| `nerve` | integer | `10` | |
| `nerve_max` | integer | `10` | |
| `nerve_at` | timestamp | now | Last time nerve was recalculated |
| `skills` | json | `{"crime":5,"combat":5,"investigation":5,"business":5}` | |
| `family_id` | table ref → families | null | |
| `crew_id` | table ref → crews | null | |
| `party_id` | table ref → parties | null | |
| `department_id` | table ref → departments | null | |
| `jail_until` | timestamp | null | |
| `jail_city_id` | text | null | |
| `inside_property_id` | table ref → properties | null | |
| `laundered_this_week` | integer | `0` | |
| `is_npc` | boolean | `false` | |
| `dead_at` | timestamp | null | **Set once, never cleared.** A dead row is a headstone |
| `last_seen` | timestamp | now | |

**Indexes:** `user_id` (NOT unique — see below), `district_id`, `city_id`, `family_id`,
`heat`, `jail_until`, `dead_at`.

> **`user_id` must not be unique.** Death is permanent, so a user accumulates one player
> row per life. The rule the server enforces is *at most one row per user with
> `dead_at IS NULL`* — a partial/filtered unique index if your database supports one,
> and a precondition in `POST /me/character` regardless.

### 2.3 `families`
| Field | Type | Notes |
|---|---|---|
| `name` | text | **Unique index.** 3–32 chars |
| `motto` | text | |
| `logo` | text | A character or emoji |
| `colour` | text | Hex |
| `city_id` | text | The **home** city. Five families per city, counted on this column |
| `boss_id` | table ref → players | Nullable — a family can be headless after a vote or a death |
| `treasury_clean` | integer | |
| `treasury_dirty` | integer | |
| `respect` | integer | |

### 2.4 `crews`
| Field | Type | Notes |
|---|---|---|
| `name` | text | Always `"<captain surname> Crew"` |
| `captain_id` | table ref → players | |
| `family_id` | table ref → families | |
| `city_id` | text | |
| `district_id` | text | |

### 2.4a `expansions`
A family operates in its home city plus every city it has bought into.

| Field | Type | Notes |
|---|---|---|
| `family_id` | table ref → families | |
| `city_id` | text | |

**Unique compound index on `(family_id, city_id)`.**

### 2.5 `parties`
| Field | Type |
|---|---|
| `name` | text (unique) |
| `motto` | text |
| `logo` | text |
| `colour` | text |
| `leader_id` | table ref → players |
| `treasury` | integer |

### 2.6 `departments`
| Field | Type |
|---|---|
| `name` | text |
| `motto` | text |
| `district_id` | text |
| `city_id` | text |
| `lieutenant_id` | table ref → players (nullable) |
| `target_family_id` | table ref → families (nullable) |
| `budget` | integer |

### 2.7 `properties`
| Field | Type | Notes |
|---|---|---|
| `owner_id` | table ref → players | |
| `type_id` | text | Matches `PROPERTY_TYPES` in `items.js` |
| `district_id` | text | |
| `city_id` | text | |
| `safety` | integer | Copied from the type at purchase |
| `upkeep` | integer | Weekly, clean money |

### 2.8 `fronts`
| Field | Type | Notes |
|---|---|---|
| `owner_id` | table ref → players | |
| `front_id` | text | Matches `FRONTS` in `items.js` |
| `district_id` | text | |
| `city_id` | text | |
| `used_this_week` | integer | Reset by the weekly cron |

### 2.9 `inventory`
| Field | Type | Notes |
|---|---|---|
| `player_id` | table ref → players | Index this |
| `item_id` | text | Matches `items.js` |
| `qty` | integer | |
| `slot` | enum | `gun` `armour` `vehicle` |
| `equipped` | boolean | At most one `true` per player per slot — enforce in the endpoint |

### 2.10 `elections`
| Field | Type | Notes |
|---|---|---|
| `seat` | enum | `district` `city` `nation` |
| `scope_id` | text | District id, city id, or the literal `nation` |
| `rank_id` | text | `councilman` `mayor` `president` |
| `closed` | boolean | |
| `candidates` | json | `[{playerId, partyId, votes, spend}]` |
| `voters` | json | Array of player ids that have voted |
| `closes_at` | timestamp | |

> Candidates and voters are JSON rather than join tables on purpose. An election is
> read as a whole every single time and written rarely; keeping it in one row makes the
> read a single query and makes the "have I already voted" check trivial.

### 2.11 `offices`
| Field | Type | Notes |
|---|---|---|
| `seat` | enum | `district` `city` `nation` |
| `scope_id` | text | |
| `holder_id` | table ref → players (nullable) | |
| `term_ends_at` | timestamp | |

Seed one row per district (18), one per city (3), and one for `nation` — 22 rows.

### 2.12 `laws`
| Field | Type | Notes |
|---|---|---|
| `scope` | enum | `nation` `city` |
| `scope_id` | text | |
| `category` | enum | `petty` `violent` `narcotics` `racketeering` `gambling` |
| `sentence_multiplier` | decimal | 0.25 – 4.0 |
| `legal` | boolean | |

**Federal law overrides city law.** That is a lookup-order rule, not a schema rule —
see §5.9.

### 2.13 `contracts`
| Field | Type | Notes |
|---|---|---|
| `kind` | enum | `construction` `sanitation` `union` `gaming` `publicworks` |
| `district_id` | text | |
| `city_id` | text | |
| `title` | text | |
| `value` | integer | |
| `awarded_by_player_id` | table ref → players | |
| `awarded_to_family_id` | table ref → families | |
| `expires_at` | timestamp | Contracts run one week |

### 2.14 `hits`
| Field | Type |
|---|---|
| `family_id` | table ref → families |
| `ordered_by` | table ref → players |
| `target_player_id` | table ref → players |
| `bounty` | integer |
| `captain_id` | table ref → players (nullable) |
| `shooter_id` | table ref → players (nullable) |
| `completed_at` | timestamp (nullable) |
| `success` | boolean (nullable) |

### 2.15 `cases`
Written on **every** crime attempt. This is what gives police something to work.

| Field | Type | Notes |
|---|---|---|
| `district_id` | text | Index this |
| `city_id` | text | |
| `player_id` | table ref → players | The suspect |
| `crime_id` | text | |
| `evidence` | integer | |
| `solved` | boolean | Index this |
| `solved_by` | table ref → players (nullable) | |

**Index `(district_id, solved)` together** — the police investigate endpoint queries on
exactly that pair and it will be your hottest read.

### 2.16 `messages`
| Field | Type | Notes |
|---|---|---|
| `channel_id` | text | e.g. `city:ny`, `family:12`. **Index this** |
| `player_id` | table ref → players | |
| `text` | text | Max 500 chars |
| `at` | timestamp | Index descending |

### 2.17 `logs`
| Field | Type |
|---|---|
| `player_id` | table ref → players (indexed) |
| `type` | text |
| `text` | text |
| `meta` | json |
| `at` | timestamp |

### 2.18 `rackets`
Territory. One row per racket **that has been touched** — rows are created lazily the
first time anybody looks at a racket, so you never have to seed 96 of them.

| Field | Type | Notes |
|---|---|---|
| `racket_id` | text | **Unique index.** Matches an id in `src/game/rackets.js` |
| `district_id` | text | Index this |
| `owner_family_id` | table ref → families (nullable) | Null means unclaimed |
| `owner_crew_id` | table ref → crews (nullable) | Null means the family holds it directly |
| `taken_at` | timestamp (nullable) | Drives the 30-minute grace window |

District control is **computed, never stored**: count rows per `owner_family_id` in the
district, highest count wins, a tie means contested and nobody controls it.

### 2.18a `diplomacy`
One row per *pair* of families. Neutral is the **absence** of a row.

| Field | Type | Notes |
|---|---|---|
| `family_a` | table ref → families | Always the **lower** id of the pair |
| `family_b` | table ref → families | Always the **higher** id |
| `state` | enum | `nap` `war` `allied` |
| `since` | timestamp | Enforces the one-hour minimum before it can be ended |

**Unique compound index on `(family_a, family_b)`.** Normalising the pair order is what
makes that index work — without it you get two rows for the same relationship and the
two families disagree about whether they are at war.

### 2.18b `inbox`
Boss-to-boss messages: proposals, declarations, peace terms and notices.

| Field | Type | Notes |
|---|---|---|
| `to_family_id` | table ref → families | Index this |
| `from_family_id` | table ref → families | |
| `from_player_id` | table ref → players | |
| `type` | enum | `proposal` `declaration` `peace` `notice` |
| `payload` | json | `{state}` for proposals, `{money, racketIds}` for peace |
| `status` | enum | `pending` `accepted` `declined` |

### 2.18c `graves`
The permanent record of a killed character. Read-only after insert.

| Field | Type |
|---|---|
| `player_id` | table ref → players |
| `username` | text |
| `name` | text |
| `rank_id` | text |
| `family_id` | table ref → families (nullable) |
| `killed_by` | table ref → players (nullable) |
| `killed_by_name` | text |
| `cause` | enum (`contract`, `war`) |
| `respect` | integer |

### 2.19 `cooldowns`
| Field | Type | Notes |
|---|---|---|
| `player_id` | table ref → players | |
| `key` | text | e.g. `crime:bank_job` |
| `until` | timestamp | |

**Unique compound index on `(player_id, key)`.**

### 2.20 `votes`
Used for boss no-confidence votes.

| Field | Type | Notes |
|---|---|---|
| `key` | text | e.g. `bossvote:12` |
| `player_id` | table ref → players | |
| `family_id` | table ref → families | |

**Unique compound index on `(key, player_id)`** — this is what stops double voting.

### 2.21 `directives`
| Field | Type | Notes |
|---|---|---|
| `scope_id` | text | City or district id |
| `family_id` | table ref → families (nullable) | |
| `authority` | integer | 3 president, 2 mayor, 1 chief |
| `set_by` | table ref → players | |

**Verify §2:** 25 tables exist, every index listed above is present, and
`players.user_id` is **not** unique (see the note in §2.2).

---

## 3. Authentication

1. **Database → users table → Authentication**: enable it, so Xano can issue tokens
   against this table.
2. Create these three endpoints in `cos_core`:

**`POST /auth/signup`** — input `username`, `password`, `email`.
```
1. Precondition: username length >= 3        → error "Username must be at least 3 characters."
2. Precondition: password length >= 6        → error "Password must be at least 6 characters."
3. Query users where username = input (case-insensitive)
4. Precondition: result is empty              → error "That username is taken."
5. Add Record → users (password field hashes automatically)
6. Create Authentication Token (table: users, id: new record id, expiry: 86400 × 30)
7. Return { authToken, user: { id, username } }
```

**`POST /auth/login`** — input `username`, `password`.
```
1. Get Record from users where username = input (case-insensitive)
2. Precondition: record exists                → error "Wrong username or password."
3. Validate Password (input password vs record password)
4. Precondition: valid                        → error "Wrong username or password."
5. Create Authentication Token
6. Return { authToken, user: { id, username } }
```
> Return the **same** message for "no such user" and "wrong password". Different
> messages let anyone enumerate your usernames.

**`GET /auth/me`** — requires auth.
```
1. Get authenticated user id
2. Query players where user_id = auth id
3. Return { user: {id, username}, hasCharacter: <bool> }
```

3. For **every** endpoint from §4 onward, set **Authentication: Required** on the
   endpoint settings. The only exceptions are `/auth/signup` and `/auth/login`.

**Verify §3:** signup returns a token; calling `/auth/me` with that token as
`Authorization: Bearer <token>` returns `hasCharacter: false`.

---

## 4. The shared helper functions

Build these **first**, as reusable **Custom Functions** (API → Functions). Almost every
endpoint calls them, and duplicating this logic 40 times is how the server and the
client drift apart.

### 4.1 `fn_current_player`
Input: none (reads the auth token).
```
1. Get authenticated user id
2. Get Record from players where user_id = auth id AND dead_at IS NULL
3. If none, check whether a dead row exists for this user:
     dead row exists → 410 "Your character is dead. Create a new one."
     otherwise       → 409 "No character yet."
4. Call fn_tick_player(player)                 (see 4.2)
5. Return the refreshed player record
```
> **410 is load-bearing.** The frontend routes 409 to character creation and 410 to the
> death screen. Returning 409 for a dead character silently skips the death screen and
> the player never learns what happened to them.

### 4.2 `fn_tick_player`
Input: `player`. This is **lazy regeneration** — nothing is on a timer, everything
catches up when the player is read. It is the single most important function here.
```
elapsed = now - player.nerve_at   (in seconds)

nerve:   regen = floor(elapsed / 300)
         if regen > 0 and nerve < nerve_max:
             nerve = min(nerve_max, nerve + regen); nerve_at = now
         else if nerve >= nerve_max:
             nerve_at = now          ← important: stops elapsed growing unbounded

health:  healed = floor(elapsed / 120)
         health = min(100, health + healed)

heat:    cooled = floor((elapsed / 3600) × 3)
         heat = max(0, heat - cooled)

jail:    if jail_until is set and jail_until <= now:
             jail_until = null; jail_city_id = null

last_seen = now
Edit Record, return it
```

### 4.3 `fn_cooldown_check`
Input: `player_id`, `key`. Returns seconds remaining (0 if free).
```
Get Record from cooldowns where player_id = X and key = Y
if none → return 0
return max(0, (until - now) in seconds)
```

### 4.4 `fn_cooldown_set`
Input: `player_id`, `key`, `seconds`. Upsert `cooldowns` with `until = now + seconds`.

### 4.5 `fn_spend`
Input: `player`, `amount`, `kind` (`clean` | `dirty`).
```
Precondition: player[kind] >= amount          → 402 "Not enough <kind> money."
Edit Record: player[kind] -= amount
```

### 4.6 `fn_public_player`
Input: `player`. Returns **only** these fields:
```
id, username, first_name, last_name, nickname, bio, avatar, path, rank_id,
city_id, district_id, respect, heat, family_id, crew_id, party_id,
department_id, jail_until, health, is_npc, last_seen
```
**Never** `clean`, `dirty`, `skills`, `user_id`, or `nerve`. Any endpoint returning
another player must pipe through this. Leaking balances lets players see exactly who is
worth robbing and exactly when.

### 4.7 `fn_self_player`
Input: `player`. Returns the full record **plus** joined `family`, `crew`, `party`,
`department`, the `equipped` gun/armour from inventory, an array of the family's
active contract `kind`s, and `jail_seconds_left`.

### 4.8 `fn_law_for`
Input: `category`, `city_id`.
```
national = laws where scope='nation' and category = X
city     = laws where scope='city' and scope_id = city_id and category = X
return national if it exists, else city, else { sentence_multiplier: 1, legal: false }
```
> Federal beats city. That is the President's whole leverage over Mayors — build it as
> a lookup precedence, not a data migration.

### 4.9 `fn_racket_row`
Input: `racket_id`. Get the row; if it does not exist, create it unclaimed from the
static definition. Lazy creation means no seeding step and no migration when you add
rackets later.

### 4.10 `fn_diplo_state`
Input: `family_a`, `family_b`. Normalise so the lower id is first, look up `diplomacy`,
return `state` or `neutral`. **Every attack, mugging and killing goes through this.**

### 4.11 `fn_may_attack`
Input: two players. Returns true unless both are in families bound by a `nap`.
Same family, or either player unaffiliated, is always true.

### 4.12 `fn_war_targets`
Input: `family_id`. Returns the family it is at war with, **plus** any war inherited
from its ally. Allies fight each other's wars — that inheritance is the entire point of
the alliance state.

### 4.13 `fn_family_operates_in`
Input: `family_id`, `city_id`. True when it is the family's home city, or an
`expansions` row exists. Gate crew creation and racket purchases on this.

### 4.14 `fn_kill_player`
Input: `target`, `killer`, `cause`. **The most consequential function in the build.**
```
1. If the target is a boss:
     heir = highest-respect living captain in the family
     if heir: family.boss_id = heir; heir.rank = 'boss'; heir.crew_id = null
     else:    family.boss_id = null
2. If the target captains a crew: crew.captain_id = null (the crew survives, leaderless)
3. Insert a graves row
4. Edit the player: dead_at = now, clean = 0, dirty = 0, health = 0, heat = 0,
   family_id/crew_id/party_id/department_id = null, inside_property_id = null,
   jail_until = null
```
> **Do not touch `users.quantum` here.** That omission *is* the Quantum Bank feature.
> Also do not reassign the family's rackets — territory belongs to the family, not to
> the man who was holding it.

**Verify §4:** each function runs standalone in Xano's **Run & Debug** without error.

---

## 5. Endpoints

Every path below matches `src/api/index.js` exactly. **The frontend will not work if a
path differs by even a character.**

All of these are `Authentication: Required`. Every one starts by calling
`fn_current_player`.

### 5.1 Self

| Method | Path | Function stack summary |
|---|---|---|
| GET | `/me` | `fn_current_player` → `fn_self_player` |
| POST | `/me/character` | See below |
| PATCH | `/me/profile` | Whitelist `bio, avatar, nickname, first_name, last_name`. Ignore anything else in the body |
| POST | `/me/path` | Only allowed while `path = civilian`. Sets entry rank: mafia→`hoodlum`, police→`rookie`, politician→`staffer` |
| POST | `/me/travel` | See below |
| POST | `/me/district` | Precondition: target district's city == player's city → 409 "That district is in another city." Clears `inside_property_id` |
| POST | `/me/enter-property` | Precondition: property.owner == player **and** property.district == player.district |
| POST | `/me/leave-property` | Sets `inside_property_id = null` |
| GET | `/me/inventory` | Inventory rows for the player |
| GET | `/me/property` | `{ properties: [...], fronts: [...] }` |
| GET | `/me/crew` | Crew with captain and members, or `null` |

**`POST /me/character`**
```
1. fn_current_player will fail with 409 here — instead, get the auth user id directly
2. Query players where user_id = auth id
3. Precondition: empty                        → 409 "You already have a character."
4. Precondition: first_name and last_name present → 400
5. Precondition: city_id is one of ny/chi/lv  → 400
6. district_id = the first district of that city
7. rank_id = entry rank for the chosen path
8. Add Record with the defaults from §2.2
9. Return fn_self_player
```

**`POST /me/travel`**
```
1. fn_current_player
2. Precondition: not in jail                  → 403 "You are in a cell."
3. Precondition: target city != current city  → 409
4. cost = the travelCostFrom table in src/game/world.js
5. fn_spend(player, cost, 'clean')
6. Edit: city_id = target, district_id = first district of target, inside_property_id = null
7. Return { player, cost, minutes }
```

### 5.2 Players

| Method | Path | Notes |
|---|---|---|
| GET | `/players/{id}` | `fn_public_player` + family/crew/party |
| GET | `/players?search=` | Match username, full name or nickname. **Cap at 50 results** |
| GET | `/leaderboard?metric=` | Whitelist metric to `respect` or `heat` only. Never allow `clean` — it is a robbery target list |

### 5.3 Crimes

**`GET /crimes`** returns every crime with per-player state computed: `success_chance`,
`estimated_payout`, `cooldown_left`, `locked`, `lock_reasons[]`, `affordable_nerve`.
The client renders exactly what this returns; it does no rule evaluation of its own.

**`POST /crimes/commit`** — the most important endpoint in the game. Build it in this
order and do not reorder:
```
 1. fn_current_player
 2. Precondition: path = 'mafia'              → 403
 3. Precondition: not in jail                 → 403
 4. Look up the crime definition (see §6 on where crime data lives)
 5. Check every requirement — rank level, city, gun equipped, vehicle owned,
    crew size, family contract → 403 with the specific reason
 6. fn_cooldown_check → if > 0, 429 "Too soon. Wait Ns."
 7. Precondition: nerve >= crime.nerve        → 403
 8. chance  = the formula in §4 of GAME_DESIGN.md
 9. success = random() < chance                ← server-side random ONLY
10. heat    = crime.heat × district.policing × era.surveillance
              × 1.6 if failed
11. If success:
      payout = crime.payout × district.wealth × skill bonus × random(0.85,1.15)
      dirty += payout; respect += 2/12/60 by tier; skills.crime += 0.3 or 1
      family.respect += respect
12. If failed:
      caught = random() < 0.35 + district.policing × 0.08
      if caught:
        law = fn_law_for(category, city)
        seconds = clamp(crime.sentence_sec × law.multiplier, 300, 86400)
        jail_until = now + seconds; jail_city_id = city; inside_property_id = null
13. ALWAYS Add Record to cases (district, city, player, crime, evidence, solved:false)
14. fn_cooldown_set(player, 'crime:<id>', crime.cooldown_sec)
15. Edit player with all accumulated changes in ONE update
16. Add Record to logs
17. Return { success, payout, respect, heat, jailed_seconds, chance, message, player }
```
> **Step 9 is a security boundary.** The client shows predicted odds from
> `src/game/economy.js` so the UI can grey things out, but it must never send an
> outcome. If the roll happens anywhere but here, the game is trivially cheatable.
>
> **Step 15 matters too.** One Edit Record, not eight. Two crimes committed in the same
> second otherwise interleave and one silently overwrites the other's payout.

### 5.4 Bank

| Method | Path | Rules |
|---|---|---|
| GET | `/bank` | Balances, owned fronts with remaining capacity, wash capacity, and `users.quantum` |
| POST | `/bank/launder` | With a front: check `weekly_capacity - used_this_week`, then increment `used_this_week`. Without: cap at $5,000/week via `players.laundered_this_week`. Output = `amount × rate` |
| POST | `/bank/transfer` | Precondition: target exists, amount > 0, not self. `fn_spend` then credit |
| POST | `/bank/quantum/deposit` | Min $1,000. `fn_spend(amount, clean)`, then credit `users.quantum` with **90%** of it. The 10% is burned, not banked |
| POST | `/bank/quantum/withdraw` | No fee. Debit `users.quantum`, credit player clean |

> Quantum reads and writes target **`users`**, never `players`. If you find yourself
> writing to a player row in these two endpoints, the vault will die with the character
> and the feature is gone.

### 5.5 Market and property

| Method | Path | Rules |
|---|---|---|
| GET | `/market` | Catalogue with district-adjusted property prices |
| POST | `/market/buy` | `fn_spend` clean, then upsert inventory |
| POST | `/market/sell` | Refund **55%** of price. The street pays badly on purpose |
| POST | `/market/equip` | Un-equip everything in that slot first, then equip. One statement, or you get two equipped guns |
| GET | `/property?districtId=` | Types and fronts with `× district.wealth` prices |
| POST | `/property/buy` | `fn_spend` clean; copy `safety` and `upkeep` onto the row at purchase time |
| POST | `/property/sell` | Refund **80%**. Clear `inside_property_id` if the player is standing in it |
| POST | `/property/front/buy` | Precondition: `front.city_id` is null or matches the district's city (this is what makes the Casino Vegas-only) |

### 5.6 Families

| Method | Path | Authorisation rule |
|---|---|---|
| GET | `/families` | Public. Also returns `slots_remaining` and `founding_cost` |
| GET | `/families/{id}` | Public |
| GET | `/families/{id}/members` | Public, sorted by rank level descending |
| GET | `/families/{id}/crews` | Public |
| GET | `/families/{id}/treasury` | **Members only** → 403 "Family business." |
| POST | `/families` | path=mafia, no current family, **fewer than 5 families whose `city_id` is the chosen city**, name unique, `fn_spend(2,500,000, clean)`. Founder becomes `boss` |
| POST | `/families/expand` | Boss only. $1,200,000 from `treasury_clean`, insert an `expansions` row. Required before the family can plant crews or take rackets in that city |
| PATCH | `/families/{id}` | Boss only |
| DELETE | `/families/{id}` | Boss only. Resets every member to `hoodlum` and deletes all crews |
| POST | `/families/{id}/join` | path=mafia, no current family. Joins as `associate` |
| POST | `/families/leave` | **A boss cannot leave** → 409. Disband or be voted out |
| POST | `/families/make` | Boss only. Target must be `associate` **with ≥500 respect** |
| POST | `/families/promote` | Boss only. `soldier` → `captain`, **and create their crew named `"<surname> Crew"`** in a chosen `district_id`. Preconditions: `fn_family_operates_in(family, district.city)` and **no existing crew for this family in that district** |
| POST | `/families/demote` | Boss only. Demoting a captain **deletes their crew and orphans its members** |
| POST | `/families/kick` | Boss only. Same crew cleanup as demote |
| POST | `/families/vote-boss` | See below |

**The five-per-city cap (`POST /families`) is a race condition.** Two players founding
in the same city simultaneously can both read "4 families" and both insert. Xano does not
give you a transaction here, so use a **unique index on `families.name`** plus this
pattern: insert first, then re-count that city, and if the count now exceeds 5 delete
your own row and refund. Alternatively keep a `city_family_count` row per city and use
an atomic increment as the lock. The unique-name index at minimum stops the
duplicate-name case.

The same race applies to **one crew per district** — re-count after insert and roll back
if a second crew appeared.

**`POST /families/vote-boss`**
```
1. fn_current_player; must be in a family; must not be the boss
2. Add Record to votes (key: 'bossvote:<familyId>', player, family)
   — the unique index on (key, player_id) rejects a second vote automatically
3. members = count of players in the family
4. votes   = count of votes with that key
5. needed  = floor((members - 1) × 0.5) + 1
6. If votes >= needed:
     old boss → rank 'soldier', crew_id null
     heir = highest-respect captain in the family
     if heir: family.boss_id = heir; heir.rank = 'boss'; heir.crew_id = null
     else:    family.boss_id = null
     delete all votes with that key
7. Return { deposed, votes, needed }
```

### 5.7 Crews and hits

| Method | Path | Rule |
|---|---|---|
| GET/POST | `/crews/{id}`, `/crews/{id}/join` | Join requires same family and rank `soldier` or `associate` |
| POST | `/crews/leave` | **A captain cannot leave their own crew** → 409 |
| POST | `/crews/kick` | Captain of that crew only |
| POST | `/crews/jobs` | Captain only. Tier 2 or 3 crimes only |
| POST | `/hits` | **Boss only.** Bounty ≥ $50,000, deducted from `treasury_clean`. Target must not be in the same family |
| POST | `/hits/{id}/assign` | Boss only. Target must be one of their captains |
| POST | `/hits/{id}/shooter` | **The assigned captain only.** Shooter must be in that captain's crew |
| POST | `/hits/{id}/execute` | **The assigned shooter only.** Must be armed, same city, not in jail |

**Hit resolution** — attacker and defender each roll `combatScore` (see
`src/game/economy.js`); higher wins. The defender adds their property's `safety × 0.8`
**only if `inside_property_id` is set.** On success call **`fn_kill_player`** — the
target is dead permanently — and pay the shooter the bounty plus 250 respect. On failure
the shooter takes 45 damage and the contract goes back to needing a shooter.

---

### 5.7a Rackets

| Method | Path | Rule |
|---|---|---|
| GET | `/districts/{id}/rackets` | Every racket in the district with owner, income, price, defender count, computed takeover odds and grace-window remaining |
| GET | `/me/rackets` | Everything the player's family holds, across all cities |
| POST | `/rackets/buy` | Must be **made**, in a family, and the family must operate in that city. Racket must be unclaimed. `fn_spend(price, clean)` |
| POST | `/rackets/takeover` | See below |

**`POST /rackets/takeover`**
```
 1. fn_current_player; not in jail; in a family; rank >= soldier
 2. Precondition: racket is owned, and NOT by your own family     → 409
 3. Precondition: you are standing in that district               → 409
 4. Precondition: taken_at is null or older than 30 minutes       → 429
 5. fn_cooldown_check('racket:takeover') → if > 0, 429
 6. Precondition: nerve >= 6                                      → 403
 7. defenders = members of the owning crew, or of the owning family if no crew
 8. chance = takeoverChance() from src/game/rackets.js
 9. success = random() < chance                    ← server-side ONLY
10. On success: owner_family_id = yours, owner_crew_id = your crew, taken_at = now,
                +120 respect, +2 combat skill
    On failure: −35 health
11. Always: −6 nerve, +14 heat, set the cooldown
```
> The **−18% solo penalty** in that formula is the whole design of the crew system.
> Do not soften it: without it, crews are decoration and one rich player takes the map.

---

### 5.7b Diplomacy

| Method | Path | Rule |
|---|---|---|
| GET | `/diplomacy` | The whole board: current relations, inherited war targets, every other family with its state, plus the boss's pending inbox and sent offers |
| POST | `/diplomacy/propose` | **Boss only.** See below |
| POST | `/diplomacy/respond` | **Boss only**, and only for messages addressed to their family. Accept/decline |
| POST | `/diplomacy/end` | **Boss only.** Pacts and alliances only — **a war cannot be ended this way** → 409. Minimum one hour since `since` |
| POST | `/diplomacy/peace` | **Boss only**, must be at war with the target. Sends `{money, racketIds}` as a `peace` inbox message |

**`POST /diplomacy/propose`**
```
1. Boss only; target family exists and is not your own
2. Precondition: not already in that state
3. If the state is exclusive (all three are):
     you must not already hold it with anyone      → 409
     they must not already hold it with anyone     → 409
4. Precondition: not going to war while bound by a pact with them → 409
5. If state = war:
     set it IMMEDIATELY and send a 'declaration' message
     (war is declared, not requested — nobody has to agree to be shot at)
   Otherwise:
     send a 'proposal' message and change nothing yet
```

**Accepting a `peace` message** transfers `money` from the offering family's
`treasury_clean` and reassigns every listed racket, then sets the pair back to
**neutral**. Re-validate both — the treasury may have been spent and the rackets may
have been lost since the offer was made.

---

### 5.7c Death

| Method | Path | Rule |
|---|---|---|
| POST | `/combat/assassinate` | Wartime killing. See below |
| GET | `/graves` | Public. The last 50 killed characters |

**`POST /combat/assassinate`**
```
1. Both players in the same district; target alive; not yourself
2. Precondition: YOU are rank >= soldier                     → 403
3. Precondition: TARGET is rank >= soldier                   → 403
   (killing an unmade man is a contract job, not a war job)
4. Precondition: fn_war_targets(your family) includes theirs → 403
5. 12-hour cooldown per killer
6. Resolve exactly as a contract hit; on success fn_kill_player(target, you, 'war')
```

### 5.8 Elections and offices

| Method | Path | Rule |
|---|---|---|
| GET | `/elections` | Ensure an open election exists for every seat (see §7), then return with candidates, `you_voted`, `you_stand` |
| POST | `/elections/stand` | path=politician. Filing fee scales with the seat: **$1,500 district / $15,000 city / $50,000 nation** (`CONFIG.CAMPAIGN_FEE`). The district fee is deliberately below a new staffer's $2,000 starting money, so the bottom rung is reachable on day one |
| POST | `/elections/{id}/campaign` | Candidates only. Adds to their `spend` |
| POST | `/elections/{id}/vote` | **City races: voter must live in that city. District races: voter must live in that district. The presidency: everyone votes.** One vote per player per election |
| GET | `/offices` | Public |

### 5.9 Law, pardons, contracts, directives

| Method | Path | Rule |
|---|---|---|
| GET | `/laws` | Public |
| POST | `/laws` | Must hold an office. **Councilmen cannot write law** → 403. President writes `scope='nation'`, mayor writes `scope='city'`. Multiplier clamped 0.25–4.0 |
| POST | `/pardons` | Must hold an office. Councilmen cannot pardon. A mayor can only pardon someone whose `jail_city_id` matches their city; the President can pardon anyone |
| GET | `/contracts` | Public |
| POST | `/contracts/award` | Reach: councilman → own district, mayor → own city, president → anywhere. **Value ceilings: $60k / $400k / $1.5M.** Credits 20% of value to the family treasury and sets `expires_at = now + 7 days` |
| POST | `/police/directive` | Authority 3 president / 2 mayor / 1 chief. **A lower authority cannot overwrite a higher one** → 403 |

### 5.10 Police

| Method | Path | Rule |
|---|---|---|
| GET | `/departments?cityId=` | Public |
| POST | `/departments` | Lieutenant or chief only |
| PATCH/DELETE | `/departments/{id}` | Its lieutenant, or the chief of that city |
| POST | `/departments/{id}/join` | path=police. A `rookie` becomes a `cop` on joining |
| POST | `/departments/kick` | Lieutenant of that department, or the city chief |
| POST | `/police/chief` | **Only the mayor of that city or the president.** Demotes the incumbent chief to lieutenant first |
| POST | `/police/action` | See below |
| GET | `/police/wanted?districtId=` | Players in the district with `heat >= 45` |
| POST | `/police/arrest` | See below |
| POST | `/police/bribe` | Any player. Deducts **dirty**, credits the officer's dirty, removes `amount/1000 × 1.5` heat. Cap $250k/day |

**`POST /police/action`** — investigative actions (`investigate`, `canvass`,
`stakeout`, `raid`) consume open cases:
```
1. Determine the target family: directive for this city/district first,
   else the department's target_family_id, else none
2. Query cases where district_id = player.district and solved = false
3. If a target family is set, prefer cases whose suspect belongs to that family;
   fall back to all open cases if none match
4. Take 1 (canvass/investigate), 3 (stakeout) or 5 (raid)
5. Mark them solved, solved_by = officer
6. Add each case's evidence value to the suspect's heat (clamped to 100)
7. Pay the officer: action.pay × district.wealth — CLEAN, except
   'shakedown_citizen' which pays DIRTY
```

**`POST /police/arrest`**
```
1. Precondition: path = 'police', not in jail
2. Precondition: target in the same district         → 409
3. Precondition: target.heat >= 45                   → 403 with the actual numbers
4. Precondition: target not already in jail          → 409
5. chance = arrestChance() from economy.js
6. If success:
     seconds = clamp(target.heat × 60 × law.multiplier, 300, 86400)
     jail the target; target.heat × 0.3; clear inside_property_id
     bonus = 1200 × (1 + heat/100) × (1 + rank level × 0.45)  → officer CLEAN
     officer respect += 20, investigation skill += 2
7. If failed: officer loses 15 health
```

### 5.11 Prison

| Method | Path | Rule |
|---|---|---|
| GET | `/prison` | Own status, bail cost, activity list |
| GET | `/prison/inmates?cityId=` | Everyone currently jailed in that city |
| POST | `/prison/activity` | Must be in jail. 120s cooldown per activity |
| POST | `/prison/bust` | Must be free, same city as the prison. ~30% base; **failing jails the rescuer for 10 minutes** |
| POST | `/prison/bail` | Costs `$8 × seconds remaining`, clean. Anyone can bail anyone |

### 5.12 Chat

**Channel access is derived, never stored.** Build `fn_visible_channels(player)`
returning: `global`, `city:<player.city>`, `district:<player.district>`, plus
`family:`/`crew:`/`party:`/`dept:` for whatever they belong to, `police:<city>` if
path=police, and `prison:<jailCity>` if currently jailed.

| Method | Path | Rule |
|---|---|---|
| GET | `/chat/channels` | `fn_visible_channels` |
| GET | `/chat/{channelId}/messages` | **Precondition: channel is in `fn_visible_channels`** → 403. Last 100, optional `?since=` |
| POST | `/chat/{channelId}/messages` | Same precondition. Trim to 500 chars |

> The 403 check is not optional. Without it, anyone can read `family:3` by guessing the
> number — which is every rival family's private planning channel.

### 5.13 Territory

| Method | Path | Notes |
|---|---|---|
| GET | `/districts/{id}` | Wealth, policing, councilman, department, **computed racket control**, the racket list, crews planted here, living players present, open case count |
| GET | `/cities/{id}` | Districts, mayor, chief, population |

Exclude players with `dead_at` set from `playersHere` and from every listing. A corpse
should not be standing on a street corner.

**Verify §5:** hit `/me` and `/crimes` from Xano's Run & Debug with a real token and
confirm the JSON shape matches what `src/api/index.js` expects.

---

## 6. Where the game data lives

Crimes, districts, items, ranks and **rackets** are **static definitions in the
frontend** (`src/game/`). Xano needs the same numbers to enforce rules server-side. You
have two options — pick one and be consistent:

**Option A — Environment Variables (recommended to start).** Paste the contents of
`crimes.js`, `world.js`, `items.js`, `ranks.js` and `rackets.js` as JSON into five Xano
environment variables (`GAME_CRIMES`, `GAME_DISTRICTS`, `GAME_ITEMS`, `GAME_RANKS`,
`GAME_RACKETS`). Endpoints parse and filter them. Zero extra tables, and balance changes
are a one-field edit.

**Option B — Reference tables.** Create `def_crimes`, `def_districts`, `def_items`,
`def_ranks` tables and seed them. Better if you eventually want to tune balance from an
admin UI rather than a text field.

Either way, **the numbers must match the frontend exactly** or players will see odds and
payouts that do not match what they get. If you change a number, change it in both
places in the same commit.

---

## 7. Background tasks

Xano **Tasks** (the cron system). Create four.

### 7.1 `weekly_economy` — every Monday 00:00 UTC
This is the single most consequential piece of server code in the game. Order matters,
and it is the order the mock implements in `POST /dev/run-weekly`:

```
1. SNAPSHOT every player's clean and dirty balances into a variable FIRST.
   All kick-ups are computed from this snapshot.

2. SALARIES — pay each player their rank's salary in CLEAN money.

3. KICK-UPS — for each player with a kick-up percentage:
     associates:  skip (unless you flipped CONFIG.ASSOCIATES_KICK_UP)
     captains:    recipient = their family's boss
     soldiers:    recipient = their crew's captain, or the boss if no crew
     amount = (snapshot.clean + snapshot.dirty) × 10%
     Take DIRTY first, then CLEAN if dirty is short.
     Credit the recipient in the same split. Log both sides.

4. UPKEEP — deduct each property's and front's weekly upkeep from clean money.

5. RESET — fronts.used_this_week = 0, players.laundered_this_week = 0.

6. INTEREST — clean += clean × 1%.

7. RACKET INCOME — for every racket with an owner:
     income = archetype income × district wealth
     if a crew holds it and its captain is alive → pay the CAPTAIN, dirty
     otherwise                                    → pay the family TREASURY, dirty
```
> Racket income is paid **dirty**, which is deliberate: a family that takes a lot of
> ground suddenly has a laundering problem, and laundering capacity becomes the next
> thing worth fighting over.

> **Step 1 is not a style preference.** If you compute each player's 10% as you go,
> a soldier who pays their captain early makes the captain's own kick-up larger, and
> the boss's take depends on the arbitrary order rows come back from the database.
> Snapshot first and the week is deterministic.

### 7.2 `close_elections` — hourly
```
For each election where closed = false and closes_at <= now:
  winner = candidate with the most votes; tie → the one who spent more; still tied → random
  If there are no candidates, extend closes_at by one term and continue
  Set the office holder_id = winner, term_ends_at = now + term days
  Set the winner's rank_id to the seat's rank (councilman/mayor/president)
  Demote the outgoing holder to 'staffer' unless they hold another seat
  Mark the election closed, and open a fresh one for the same seat
```
Terms: councilman 7 days, mayor 30 days, president 60 days.

### 7.3 `heat_decay` — hourly
A safety net for players who never log in: `heat = max(0, heat - 3)` for anyone whose
`last_seen` is over an hour old. Active players are handled by `fn_tick_player`.

### 7.4 `expire_contracts` — hourly
Delete or flag `contracts` past `expires_at`. This is what makes tier-3 crimes lock
again and forces families back to the negotiating table.

### 7.5 `expire_peace_offers` — hourly
Mark `inbox` rows of type `peace` older than 24 hours as `declined`. Terms should not sit
on a desk indefinitely while the war continues around them.

**Verify §7:** run `weekly_economy` manually once against seed data and confirm a
captain's balance rises by roughly 10% of their crew's combined holdings.

---

## 8. Realtime chat (optional but recommended)

The frontend currently polls `GET /chat/{channel}/messages` every 5 seconds. That is
fine to launch and terrible at scale.

1. In Xano, enable **Realtime** on the workspace and note the realtime connection hash.
2. Create a channel pattern `chat/{channel_id}` with **permissions: authenticated only**.
3. In `POST /chat/{channelId}/messages`, add a **Realtime Event** step after the insert
   that publishes the new message to `chat/<channel_id>`.
4. On the client, replace the `setInterval` in `src/components/Chat.js` with a Xano
   realtime subscription. The component is written so this is the only change needed —
   `poll()` becomes the initial history fetch and the subscription appends.

**The channel authorisation from §5.12 still applies.** Realtime permissions are a
second gate, not a replacement for the visibility check.

---

## 9. Connect the frontend

1. In the project root, create `.env`:
   ```
   REACT_APP_XANO_BASE=https://x8ki-abcd-1234.n7.xano.io/api:aBcD1234
   ```
   Use the **API group** base URL from §1, not the bare instance URL.
2. Optionally set the era: `REACT_APP_ERA=seventies` (or `nineties` / `modern`).
3. Restart the dev server — Create React App only reads `.env` at startup.
4. The sidebar's "Mock backend" notice disappears when `REACT_APP_XANO_BASE` is set.
   That is your confirmation the switch took.

**In Xano, set CORS** for the `cos_core` API group to allow your frontend origin
(`http://localhost:3000` during development, plus your production domain).

---

## 10. Seeding

`src/api/mock/seed.js` is the reference seed and is worth reproducing, because an empty
world is a bad first impression — a new player should walk into a city that already has
families, cops and a sitting mayor.

Create a one-off Xano task, run it once, then disable it:

- **12 families** — three per city, leaving two of the five seats open in every city so
  a real player can always found one somewhere on day one
- **3 parties**
- **24 departments**, one per district
- **~180 NPC players**: bosses, captains with crews (one crew per district), soldiers,
  associates, loose hoodlums, 4 chiefs, 24 lieutenants, 48 officers, 24 councilmen,
  4 mayors, 1 president
- **29 offices** (24 district + 4 city + 1 nation) with the NPC holders seated
- **Rackets**: leave roughly a third unclaimed so there is always something to buy into
- **A little diplomacy already in play** — one war, one pact, one alliance — so the board
  is not blank when the first real player arrives
- **5 law rows** at `scope='nation'`, multiplier 1.0, all illegal except gambling
- **2 open contracts** so tier-3 work is reachable immediately
- **A handful of chat messages** in `global` and the city channels

Set `is_npc = true` on all seeded players. It costs nothing now and means you can
exclude them from leaderboards later without a migration.

---

## 11. Security checklist

Go through this before you let anyone else in. Every item is something the mock
adapter already does.

- [ ] **All randomness is server-side.** The client sends an intent (`crimeId`), never
      an outcome. Search your endpoints for any input named `success`, `payout` or
      `damage` — there should be none.
- [ ] **`fn_public_player` is the only path by which one player sees another.** No
      endpoint returns another player's `clean`, `dirty`, `skills` or `user_id`.
- [ ] **Chat channels are authorised on every read and every write**, not just on the
      channel list.
- [ ] **Money changes go through `fn_spend`**, which checks the balance in the same step
      that deducts it.
- [ ] **Every mutating endpoint re-reads the player from the database.** Never trust a
      `player_id`, `family_id` or balance from the request body.
- [ ] **Rank checks are on the server.** The UI hides the Kick button from non-bosses;
      the endpoint must reject it anyway.
- [ ] **Cooldowns are enforced server-side** via the `cooldowns` table, not by the
      client's countdown timer.
- [ ] **Sentences are clamped to 24 hours** no matter what multiplier a President sets.
      A hostile President should not be able to bench the entire mafia for a week.
- [ ] **`/leaderboard` never exposes a money metric.**
- [ ] **`fn_kill_player` never touches `users.quantum`.** Test it: deposit, die, respawn,
      and confirm the balance is still there. This is the one feature players will be
      angriest about if it breaks.
- [ ] **A dead character cannot act.** Every mutating endpoint rejects a player with
      `dead_at` set — `fn_current_player` returning 410 handles this centrally, so do not
      bypass it anywhere.
- [ ] **Attack and kill endpoints check diplomacy server-side.** The UI hides the
      Assassinate button when you are not at war; the endpoint must reject it anyway.
- [ ] **Diplomacy pairs are normalised** (lower family id first) on every read and write,
      or two families will disagree about whether they are at war.
- [ ] **Racket takeover rolls on the server** and re-reads ownership inside the same
      request. A client that sends `success: true` must be ignored.
- [ ] Rate-limit `/crimes/commit`, `/police/action` and `/chat/*` at the API group
      level. The per-crime cooldowns are game balance, not abuse protection.

---

## 12. Build order

If you are working through this in one sitting, this order gets you something testable
soonest:

1. §1 API group, §2 tables `users` + `players` only
2. §3 auth, §4.1/4.2/4.5/4.6/4.7 helpers
3. `GET /me` and `POST /me/character` — **the frontend now loads and shows a dashboard**
4. Remaining tables from §2
5. `GET /crimes` and `POST /crimes/commit` — **the game is now playable**
6. Bank (including the Quantum Bank), market, property
7. Families, crews, expansion
8. **Rackets** — `fn_racket_row`, buy, takeover, district control
9. Hits, `fn_kill_player`, `/combat/assassinate`, `/graves`
10. **Diplomacy** — `fn_diplo_state`, `fn_may_attack`, `fn_war_targets`, the inbox
11. Politics and police
12. Prison and chat
13. §7 background tasks
14. §10 seed, §11 security pass

Steps 1–5 are roughly a third of the work and produce a game you can actually play.
Steps 8–10 are what make it a *multiplayer* game rather than a solo grind — if you have
to cut scope, cut politics before you cut rackets.
