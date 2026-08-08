# Cities of Sin — Game Design

A multiplayer browser RPG. Three cities, three paths, one economy that all three
fight over. This document is the ruleset; `docs/XANO_SETUP.md` is how to build the
server that enforces it.

---

## 1. Setting

The brief said "somewhere from 1970 to modern" and left it open, so the era is a
**configuration value, not a hard-coded assumption**. `src/game/era.js` defines three
eras and the game re-skins itself when you change one line:

| Era | Year | What changes mechanically |
|---|---|---|
| `seventies` *(default)* | 1979 | Low surveillance, no wiretaps, weak forensics, no wire transfers — laundering must happen physically at a front |
| `nineties` | 1994 | RICO era. Wiretaps on, forensics up, wire transfers available |
| `modern` | 2026 | Cameras everywhere, high forensics, digital money, faster travel |

The default is 1979 because it supports the gameplay best: strong unions, cash
economy, and no CCTV to explain away. Switch with `REACT_APP_ERA=modern`.

**Note on the brief:** it mentioned "Hollywood in LA" as a regional variant, but the
three cities listed are New York, Chicago and Las Vegas. LA is not in the game. The
Las Vegas equivalent of that idea is **The Strip**, and each city has a signature
system instead:

- **New York** — Union Halls. Locals control the docks, sanitation and concrete.
- **Chicago** — The Ward Machine. Elections here are the cheapest to rig.
- **Las Vegas** — The Casinos. The only place dirty money washes at scale.

If you do want LA as a fourth city, it is one entry in `src/game/world.js` plus its
districts. Nothing else needs to change.

---

## 2. The world

Three cities, six districts each (18 total). The **district** is the atomic unit —
crimes, property, police departments, councilman seats, chat rooms and family
dominance all hang off it.

Each district has two numbers that drive everything:

- **wealth** (0.7–1.6) — multiplies crime payouts and property prices
- **policing** (0.6–1.5) — multiplies heat gained and arrest odds

So Midtown pays 1.5× but is policed at 1.4×; Boulder Highway pays 0.8× and is barely
watched at 0.6×. That tension is the whole map design: *where you work is a bet.*

You move between districts freely inside a city. **You can only reach another city by
plane**, and the ticket is paid in clean money.

---

## 3. The three paths

Every player picks one at character creation. Ranks and weekly salaries:

### Mafia
| Rank | Kicks up | How you get there |
|---|---|---|
| Hoodlum | — | Default. On the path, unattached |
| Associate | — | Joined a family, not made |
| Soldier | 10% | Made by the boss (needs 500 respect) |
| Captain | 10% | Promoted by the boss; gets a crew named after their surname |
| Boss | — | Founded a family, or inherited one after a vote |

Mafia earn **no salary**. Everything comes from crime, and all of it is dirty.

### Politician
| Rank | Salary/week | Term | Elected by |
|---|---|---|---|
| Staffer | $900 | — | Nobody. Default rank |
| Councilman | $6,500 | 7 days | Residents of one district |
| Mayor | $24,000 | 30 days | Everyone in the city |
| President | $60,000 | 60 days | Every player in every city |

### Police
| Rank | Salary/week | How you get there |
|---|---|---|
| Rookie | $1,200 | Default. No department |
| Officer | $4,500 | Joined a department |
| Lieutenant | $12,000 | Runs a district department |
| Chief | $30,000 | Appointed by the mayor or president; by seniority if no politician exists |

---

## 4. Crime

Three tiers, exactly as briefed.

**Tier 1 — Street.** Pickpocketing, shoplifting, shakedowns, mugging, numbers, car
theft, burglary, loan collection. $120–$900. Low heat, short cooldowns, always
available. This is the grind that funds everything else.

**Tier 2 — Organised.** Protection rackets, fencing, chop shops, armed robbery, bank
jobs, hijacking, moving product, plus one city-exclusive each: casino skimming
(Vegas), squeezing the local (New York), fixing a ward (Chicago). $2,600–$11,000.
Requires rank, sometimes a gun, a vehicle, or a crew of three.

**Tier 3 — Projects.** Concrete cartel, carting monopoly, pension raids, gaming
licences, no-bid public works. $48,000–$120,000. **These do not exist until a
politician awards your family a contract.** That is the hinge the whole game turns on:
the mafia cannot reach its top earnings without politicians, and politicians cannot
fund campaigns without the mafia.

### Resolution
```
chance = base
       + (skill / 10) × 2%
       + rank level × 1.2%
       − district policing × 5%
       + 6% if armed and the job wants a gun
       + 2% per crew member (max 5)
       − (your heat / 100) × 15%
       − era forensics adjustment
       clamped to 5%–95%
```
Success pays `base × district wealth × skill bonus × 0.85–1.15 random`, adds respect
and heat. Failure adds **1.6× heat** and carries a ~35–50% chance of arrest.

Every attempt — success or failure — writes a **case record** into the district with an
evidence value. That is what gives police something to find.

---

## 5. Family structure

**Five families. Ever.** First come, first served, $2,500,000 clean to found one. When
all five slots are full, the only way in is for a boss to fall.

- **Boss** — runs the family; collects 10% from every captain weekly; edits the family
  name, motto, logo and colour; orders assassinations and assigns them to a captain;
  makes associates into soldiers; promotes and demotes; kicks anyone out; can disband.
  **Can be voted down to soldier by a strict majority of the family** — at which point
  the most-respected captain inherits.
- **Captain** — runs a crew named after their surname (Genovese → *Genovese Crew*);
  collects 10% weekly from their crew; pays 10% of their own total to the boss;
  organises crew jobs; kicks from their crew; picks the shooter when handed a hit.
- **Soldier** — made. Kicks 10% weekly to their captain, or straight to the boss if
  they are not in a crew. Access to crew jobs.
- **Associate** — signed on but not made. **Does not kick up, and is owed nothing.**
- **Hoodlum** — on the mafia path, no family.

> **Ambiguity in the brief, and how it was resolved:** the Captain section says captains
> collect "from all soldiers and associates", but the Associate section says associates
> "don't kick up". The associate rule is the more specific statement, so it wins —
> associates pay nothing. Flip `CONFIG.ASSOCIATES_KICK_UP` to `true` in
> `src/game/economy.js` if you want them taxed instead.

### The weekly kick-up
Runs on a cron. All amounts are calculated from **one snapshot taken before any money
moves**, so processing order cannot change the result. Taken from dirty money first,
then clean.

---

## 6. Political structure

**President** (every 2 months, elected by everyone): sets federal law — sentence
multipliers per crime category, and which drugs are legal; awards the biggest
contracts; pardons anyone anywhere; points the police at any family; $60k/week.

**Mayor** (monthly, per city): sets city law unless the President overrides;
appoints the Chief of Police; awards big contracts in their city; pardons within the
city; $24k/week.

**Councilman** (weekly, per district): awards small contracts (≤$60k); $6.5k/week.

**Parties**: up to five, $750,000 to found, founder is leader, customisable name,
logo, motto and colour. Parties compete for districts, cities and the presidency.

Contracts pay the receiving family 20% of the value into their treasury immediately,
and unlock the matching tier-3 crime for a week.

---

## 7. Police

**Activities**: patrol, canvass, open an investigation, stake out a front, raid a
property, and shake down a citizen (the only one that pays dirty).

Investigative actions consume **open cases** in the district and convert them into heat
on the suspect. If a directive or department target is set, cases belonging to that
family are worked first.

**Arrests**: only possible at **45+ heat**. Odds scale with the target's heat, the
officer's rank and investigation skill, minus the target's rank and defence. The bonus
paid scales with both the target's heat and their rank — arresting a boss is worth far
more than arresting a hoodlum.

**Bribes**: any player can pay an officer dirty money to burn heat, at 1.5 heat per
$1,000, capped at $250k/day. The money lands in the officer's dirty balance, which is
its own kind of leverage later.

**Structure**: Chief per city (appointed by the ranking politician, or by seniority if
the seat is vacant) → Lieutenant per district, who names, staffs, targets and can
disband their department → Officers → Rookies (unassigned).

---

## 8. Money

Two balances, and the difference between them is the entire mid-game.

- **Dirty** — everything crime pays. Buys guns, bribes and tribute. **Lost entirely if
  you are killed.** Cannot buy property, plane tickets, or a family.
- **Clean** — salaries, laundered money, arrest bonuses. Buys everything. Earns 1%
  weekly interest. Survives death.

**Laundering**: without a front you are capped at $5,000/week at a punishing 60%. Own a
front and both numbers improve sharply:

| Front | Price | Weekly capacity | Rate |
|---|---|---|---|
| Laundromat | $30k | $12k | 72% |
| Social Club | $55k | $26k | 75% |
| Restaurant | $120k | $60k | 78% |
| Construction Co. | $260k | $140k | 80% |
| **Casino Floor** *(Vegas only)* | $900k | $500k | **86%** |

That Vegas-only row is why Vegas matters. It is the best wash rate in the game.

---

## 9. Guns, vehicles, property

**Guns** (Saturday Night Special → Assault Rifle) give attack and defence in
player-vs-player combat, and gate some crimes. **Armour** adds defence. **Vehicles**
move you around a city and gate hijacking work; the Private Plane halves inter-city
flight time.

**Property** is bought per district. Its **safety rating** is your defence *if you are
inside it* when someone comes for you — from a Rented Room (5) up to a Penthouse (88).
Going inside is an explicit action, and so is stepping out. That makes hiding a real
decision with a real cost: you cannot earn from inside your own front door.

---

## 10. Prison

Sentences are clamped to **5 minutes minimum, 24 hours maximum**, whatever the law
says. Nobody logs in to wait.

Inside you can lift weights (+combat), read (+business), work the yard (+crime), or
keep your head down (−60s). The prison block has its own chat room, per city. Outside,
anyone can **bail** you (clean money, $8/second remaining) or **bust** you out (~30%
base, and failing puts them inside for 10 minutes).

---

## 11. Chat

Rooms are **derived from who you are**, never stored as memberships — so a channel
cannot be joined by guessing its ID:

`global` · `city:<id>` · `district:<id>` · `family:<id>` · `crew:<id>` ·
`party:<id>` · `police:<cityId>` · `dept:<id>` · `prison:<cityId>`

Join a family and the family room appears. Get made into a crew and the crew room
appears. Get arrested and the block starts talking to you.

---

## 12. Assassination

The boss orders a hit and funds the bounty from the family treasury. The boss assigns a
**captain**; the captain picks a **shooter from their own crew**. The shooter must be in
the same city, must be armed, and resolves against the target's combat score — including
their property's safety rating if they are indoors.

Success: the target loses all dirty money, 35% of their respect, and drops to 10 health.
The shooter takes the bounty and 250 respect. Failure: the shooter takes 45 damage and
the contract goes back to needing a shooter.

---

## 13. What is deliberately not built yet

Called out honestly rather than left as a surprise:

- **Elections do not auto-close.** The endpoints to stand, campaign and vote all work,
  and terms have end dates, but the cron that closes a race and seats the winner is
  specified in `XANO_SETUP.md` §7 and not implemented in the mock.
- **Crew jobs are announcements, not multi-player instances.** `POST /crews/jobs` records
  the job and the crew can see it; a real "everyone joins, then it resolves together"
  flow needs a job state machine.
- **Chat polls every 5 seconds.** Swap for Xano Realtime — §8 of the setup guide is a
  drop-in replacement.
- **Chief-by-seniority fallback** is specified but only the appointment path is coded.
- **NPCs do not act.** The seed populates the world so it is not empty, but the NPCs
  never commit crimes or make arrests on their own.
