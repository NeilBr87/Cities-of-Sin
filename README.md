# Cities of Sin

A multiplayer browser crime RPG. Four cities, twenty-four districts, three
career paths that need each other, and one character per account.

**Stack:** Vite · React 18 · TypeScript · Supabase (Postgres, Auth, Realtime, RLS)

---

## The one architectural rule

> **The client never writes to a gameplay table.**

Row Level Security grants scoped `SELECT` and nothing else — there is not a
single `INSERT`, `UPDATE` or `DELETE` policy anywhere in
[`supabase/migrations/`](supabase/migrations/), and table-level write privileges
are revoked from `anon` and `authenticated` on top of that. Every mutation goes
through a `SECURITY DEFINER` Postgres function called via `supabase.rpc()`.

Three reasons it works this way:

| | |
|---|---|
| **Atomicity** | A crime pays out, adds heat, spends nerve, writes a log row and may jail you. That is one transaction or it is a duplication bug. |
| **Latency** | An RPC round-trip is ~30ms. An Edge Function cold start is 200–500ms, and this game is click-heavy. |
| **Tamper-proofing** | The rules live where the data lives. Nothing that decides an outcome ships to the browser. |

Edge Functions stay available for anything needing secrets or outbound calls
(email, image processing, payments). Nothing in the game loop needs one.

---

## Getting it running

### 1. Create the Supabase project

At [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**.

- Pick the region closest to **your players**, not to you.
- **Save the database password** — it is shown once and you need it for migrations.
- Free tier is fine. Note it pauses after 7 days of inactivity.

### 2. Wire up the environment

Project Settings → API. Copy the **Project URL** and the **anon / publishable key**.

```bash
cp .env.example .env.local
```

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

> ⚠️ The **`service_role`** key must never appear in the frontend, in a committed
> file, or in `.env.local`. It bypasses RLS completely. It belongs only in
> Supabase Edge Function secrets.
>
> The anon key *is* safe in the browser. RLS is what protects the data — that is
> the entire point of the architecture above.

### 3. Configure Auth

Authentication → Providers → **Email**, enabled.

- Turn **on** "Confirm email". It is the cheapest anti-alt measure available, and
  this game lives or dies on alt control.
- URL Configuration → Site URL: `http://localhost:5173` while developing; add
  your production domain when you deploy.

### 4. Push the schema

```bash
npm install
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push
```

`db push` applies everything in `supabase/migrations/` in order and records what
it ran. **Never edit the schema in the dashboard SQL editor** — migrations are in
git so the schema is reviewable, reproducible, and identical between your machine
and production.

### 5. Run it

```bash
npm run dev          # http://localhost:5173
```

Sign up, confirm the email, create a character, and commit a crime.

### Optional: the local stack

With Docker Desktop installed you get a full local Postgres + Auth + Realtime,
so you can break the schema without touching the hosted project:

```bash
npx supabase start   # Studio on :54323, mail catcher on :54324
npm run db:reset     # re-run every migration from scratch
```

Local email confirmation is off (see `supabase/config.toml`) so playtesting
needs no mail round-trip. Keep it **on** in the hosted project.

---

## Layout

```
supabase/migrations/
  ..._schema.sql       Tables, indexes, constraints
  ..._rls.sql          Row Level Security — reads only, plus policy helpers
  ..._functions.sql    The game server: every mutation, as an RPC
  ..._seed.sql         Cities, districts, crimes, and every balance number

src/
  lib/
    supabase.ts        Client, and the "is this configured yet" check
    api.ts             The whole API surface. RPC in, typed data out
    types.ts           Shared shapes
    ranks.ts           Display metadata only — no rules live here
    format.ts          Money, durations, names
  state/
    SessionProvider    Auth session, the `me` payload, toasts, the act() wrapper
  components/          Layout, chat panel, and the UI kit
  routes/              One file per screen
  styles/              Tokens, components, landing page
```

### Where the numbers live

Every tunable is a row in `game_config`, so rebalancing is an `UPDATE` and not a
migration:

```sql
update game_config set value = 0.55 where key = 'launder_rate';
```

A handful of them are duplicated as display constants in the UI (marked in
comments). The server is always the authority; if the two disagree, the client
is the bug.

---

## Commands

| | |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Typecheck, then production build |
| `npm run typecheck` | Types only |
| `npm run db:push` | Apply migrations to the linked project |
| `npm run db:reset` | Rebuild the local database from migrations |
| `npm run db:types` | Regenerate DB types from the local stack |

---

## Roadmap

**M1 — the loop** *(built)*
Accounts, character creation, the four cities, crimes, nerve/heat/money, prison
and bail, laundering, the vault, realtime chat, activity feed, leaderboards,
profiles.

**M2 — the hierarchy** *(built)*
Five families per city, first come first served. Boss, captains, soldiers,
associates. One crew per district, named for its captain. Making, promoting,
demoting, kicking. Family treasury and expansion into other cities. Voting a boss
down to soldier. The weekly ten-percent kick-up, on pg_cron.

**M3 — territory** *(built)*
Six regionalised rackets per city, instantiated into all twenty-four districts.
Buy them with family money or take them by force — the odds are driven by how
many of your people are standing in the district against how many of theirs.
Whoever holds the most controls it; a tie reads as contested. Weekly income
splits between the holding crew's captain and the family treasury.

**M4** combat, ordered hits, permadeath · **M5** police work · **M6** parties,
elections, laws, contracts · **M7** property, guns, vehicles, fronts, diplomacy.

### The weekly economy needs pg_cron

Two jobs drive all recurring money: `run_weekly_rackets()` (Mondays 02:55 UTC)
and `run_weekly_kickup()` (03:00 UTC, five minutes later so racket income is
taxed in the week it was earned). Both are idempotent per ISO week, so a retry
or a manual trigger cannot double-charge anyone.

They are scheduled by `20261003000003_schedule_crons.sql`, which **fails on
purpose** if pg_cron is missing rather than being marked applied and leaving the
economy silently frozen. Enable it under **Database → Extensions → pg_cron**,
then `npm run db:push`.

See [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md) for the full design, and its
final section for what is deliberately not built yet.

---

## Testing

[docs/BROWSER_TESTS.md](docs/BROWSER_TESTS.md) is a 15-minute click-through pass
for M1 — browser only, no terminal or database access needed. It carries the exact
expected figure for every crime's odds, payout, heat and respect (computed from the
seeded data), so a tester compares digits rather than eyeballing, plus a **"don't
report these"** list of everything M1 deliberately omits.

```bash
npx vitest run      # unit tests — display helpers only; the rules live in SQL
```

---

## Open design questions

Flagged because they change the shape of later milestones and are cheaper to
settle now:

1. **Does expanding into a city consume one of that city's five family seats?**
   If yes, expansion starves new bosses. If no, a city hosts more than five
   families' operations.
2. **What are the real Quantum Bank numbers?** Currently a 10% deposit fee and a
   $1,000 minimum — a placeholder. It is the single number that decides whether
   permadeath costs anything.
3. **Uncontested elections.** With a small player base, three friends can take
   the presidency. Needs turnout rules and a fallback, the way police chief
   already has one.
4. **Day-one activity for police and politicians.** Both paths currently earn
   nothing and can do nothing until M5/M6. Until then, steer signups to mafia.
