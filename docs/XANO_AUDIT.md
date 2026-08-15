# Xano Audit Brief

**For the agent working inside the Xano dashboard.**

The `cos_core` group shows **153 endpoints, 3 drafts**. Before anyone connects the
frontend, we need to know what those 153 actually are. Work through this in order and
report back using the format in §6.

**Context you need:**
- `src/api/index.js` in the repo is the contract — every exported function is one exact
  route the frontend will call.
- `src/api/mock/adapter.js` is the reference implementation of the rules each route must
  enforce.
- `docs/XANO_SETUP.md` is the full build guide.

---

## 1. The question this audit answers

25 game tables × 6 auto-generated CRUD operations (list, get, add, edit, patch, delete)
= **150**. Plus 3 drafts = **153**.

That arithmetic matches the screenshot exactly, which suggests `cos_core` currently holds
150 auto-generated table endpoints plus 3 custom auth endpoints — **not** the game API.

That is a hypothesis, not a finding. Confirm or kill it in §2.

---

## 2. Inventory (do this first)

Open **API → cos_core** and look at the endpoint list.

### 2a. Classify what you see

Auto-generated table CRUD looks like this — the same path repeated with different verbs,
one set per table name:

```
GET     /players          POST   /players
GET     /players/{id}     POST   /players/{id}
DELETE  /players/{id}     PATCH  /players/{id}
```

The real game API looks like this — paths that are **not** table names:

```
GET  /me                 POST /me/character      POST /me/travel
GET  /crimes             POST /crimes/commit
POST /bank/launder       POST /bank/quantum/deposit
POST /families/promote   POST /families/expand   POST /families/vote-boss
POST /rackets/takeover   POST /diplomacy/propose
POST /police/arrest      POST /prison/bust
```

### 2b. Check these twelve paths specifically

For each, record **exists / does not exist**. These are the load-bearing ones, and none
of them is a table name — so they can only exist if somebody built them deliberately.

| # | Method | Path |
|---|---|---|
| 1 | GET | `/me` |
| 2 | POST | `/me/character` |
| 3 | GET | `/crimes` |
| 4 | POST | `/crimes/commit` |
| 5 | GET | `/bank` |
| 6 | POST | `/bank/launder` |
| 7 | POST | `/bank/quantum/deposit` |
| 8 | GET | `/districts/{id}/rackets` |
| 9 | POST | `/rackets/takeover` |
| 10 | GET | `/diplomacy` |
| 11 | POST | `/police/arrest` |
| 12 | GET | `/chat/channels` |

### 2c. Confirm from outside

Xano's own UI can be misleading about what is live. Hit the API directly — browser tab or
curl, no auth header:

```
https://x8ki-letl-twmt.n7.xano.io/api:FVd6QdN7/me
https://x8ki-letl-twmt.n7.xano.io/api:FVd6QdN7/crimes
```

- **404 / "not found"** → not built
- **401 / "unauthorized"** → built and live (auth is working, which is correct)
- **200 with data** → built but **not requiring authentication** — that is a bug, flag it

---

## 3. The 3 drafts

Find them (`cos_core` → the 3 Drafts filter). They are almost certainly `auth/signup`,
`auth/login` and `auth/me`.

**Draft endpoints do not serve live traffic.** Publish them, then re-run §2c against
`/auth/login` and confirm you get a real response rather than a 404.

Report which three were in draft.

---

## 4. Generic CRUD that is actively dangerous

Four auto-generated routes sit at the **same URL** the frontend will call, so they return
`200 OK` while silently skipping every rule. That is worse than a 404 — a 404 is honest,
these look like they worked.

| Route | What the rules require | What generic CRUD does |
|---|---|---|
| `POST /families` | max 5 per city, name unique, deduct $2,500,000, set founder as boss | Inserts a row. No cap, no cost, no boss |
| `POST /laws` | must hold office, councilmen barred, multiplier clamped 0.25–4.0 | Anyone writes any law |
| `POST /hits` | boss only, bounty ≥ $50,000 taken from family treasury | Anyone opens a contract, free |
| `GET /players/{id}` | must return only the public fields | **Leaks `clean`, `dirty`, `skills`, `user_id`** |

**Action:** delete or disable these four now, before anyone tests against them. The last
one is the priority — it hands every player a list of exactly who is worth robbing and how
much they are carrying.

Leave the rest of the generic CRUD alone for now; it is harmless as long as nothing calls
it, and it is useful for inspecting data while you build.

---

## 5. CORS

**API → cos_core → settings → CORS.** Allow:

- `http://localhost:3000` (dev)
- the production domain, when there is one

Without this the browser blocks every call regardless of whether the endpoints exist.

---

## 6. Report back in this format

```
INVENTORY
  Total endpoints in cos_core: ___
  Auto-generated table CRUD:   ___
  Custom endpoints:            ___  (list their paths)

THE TWELVE (§2b)
  1  GET  /me                       exists / missing
  2  POST /me/character             exists / missing
  ... through 12

EXTERNAL CHECK (§2c)
  GET /me       → HTTP ___
  GET /crimes   → HTTP ___

DRAFTS (§3)
  Which three: ___
  Published:   yes / no

DANGEROUS CRUD (§4)
  POST /families    deleted / disabled / still live
  POST /laws        deleted / disabled / still live
  POST /hits        deleted / disabled / still live
  GET  /players/{id} deleted / disabled / still live

CORS (§5)
  localhost:3000 allowed: yes / no
```

---

## 7. What happens next, depending on the answer

**If the twelve exist and return 401** — the game API is built. Say so and stop; the
frontend gets connected and tested against it, and this brief is finished.

**If they return 404** — the game API is not built yet. Do not connect the frontend:
you would get a working login screen followed by a wall of 404s, which is worse than the
current mock. Build in this order (this is `XANO_SETUP.md` §12, condensed):

1. §4 helper functions — `fn_current_player`, `fn_tick_player`, `fn_spend`,
   `fn_public_player`, `fn_self_player`. Almost every endpoint depends on these, so
   nothing else can be honestly tested until they exist.
2. `GET /me` and `POST /me/character` — **the frontend loads and shows a dashboard**
3. `GET /crimes` and `POST /crimes/commit` — **the game is playable**
4. Bank, market, property
5. Families, crews, expansion
6. Rackets, then hits and `fn_kill_player`, then diplomacy
7. Politics, police, prison, chat
8. Background tasks (§7), then the security checklist (§11)

Steps 1–3 are the whole unblock. Everything after that can be built while people are
already playing.

**Two rules that hold regardless of what you find:**

- **Every random roll happens on the server.** The client sends an intent (`crimeId`),
  never an outcome. If any endpoint accepts a `success`, `payout` or `damage` input, that
  is a cheat vector — flag it.
- **Seed institutions, not people.** Departments, election seats and law rows, all
  created empty. No NPC families, bosses or players — every family and every name in one
  should belong to a real player. See `XANO_SETUP.md` §10.
