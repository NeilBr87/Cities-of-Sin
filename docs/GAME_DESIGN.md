# Cities of Sin — Game Design

A multiplayer browser RPG. Four cities, three paths, one economy that all three
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

Each city has exactly one signature system:

- **New York** — Union Halls. Locals control the docks, sanitation and concrete.
- **Chicago** — The Ward Machine. Elections here are the cheapest to rig.
- **Las Vegas** — The Casinos. The only place dirty money washes at scale.
- **Los Angeles** — The Studios. Studio payroll, teamster crews and production loans.

---

## 2. The world

Four cities, six districts each (24 total). The **district** is the atomic unit —
crimes, rackets, property, police departments, councilman seats, chat rooms and
crews all hang off it.

Each district has two numbers that drive everything:

- **wealth** (0.7–1.6) — multiplies crime payouts and property prices
- **policing** (0.6–1.5) — multiplies heat gained and arrest odds

So Midtown pays 1.5× but is policed at 1.4×; Boulder Highway pays 0.8× and is barely
watched at 0.6×. That tension is the whole map design: *where you work is a bet.*

Hollywood is the second-richest district in the game at 1.55× — LA money is soft, slow
and enormous, and it is policed far more lightly than Midtown.

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

**Five families per city — twenty in the world.** First come, first served,
$2,500,000 clean to found one, and you pick which city's seat you are taking. When a
city's five are full, either take a seat somewhere else or wait for a boss to fall.

A family starts in one city and **expands** into the others for
$1,200,000 from the treasury per city. Until it has expanded, it cannot plant crews or
take rackets there.

- **Boss** — runs the family; collects 10% from every captain weekly; edits the family
  name, motto, logo and colour; orders assassinations and assigns them to a captain;
  makes associates into soldiers; promotes and demotes; kicks anyone out; can disband.
  **Can be voted down to soldier by a strict majority of the family** — at which point
  the most-respected captain inherits.
- **Captain** — runs a crew named after their surname (Genovese → *Genovese Crew*);
  collects 10% weekly from their crew; pays 10% of their own total to the boss;
  organises crew jobs; kicks from their crew; picks the shooter when handed a hit.
  A crew is **planted in a district**, and a family may hold only **one crew per
  district** — so promoting somebody is also a decision about where you are expanding.
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

## 5a. Rackets and territory

A district is not an abstract score. It is a list of **rackets** — four per district,
96 in the world — and **whoever holds the most of them controls the district**. A tie
leaves it *contested* and under nobody, which is what a stalemate should look like.

Every racket is regional. The archetype carries the numbers; the name carries the
place. The same "union" archetype is *Longshoremen Local 1814* in Red Hook, *Meatpackers
Local 25* in the Stockyards, and *Studio Teamsters Local 399* in Hollywood.

| Archetype | Weekly income | Defence | Price |
|---|---|---|---|
| Numbers | $2,200 | 18 | $45,000 |
| Protection | $3,000 | 26 | $62,000 |
| Vice | $3,800 | 30 | $78,000 |
| Transport | $4,600 | 34 | $96,000 |
| Union | $5,600 | 42 | $128,000 |
| Narcotics | $6,800 | 46 | $155,000 |
| High End | $8,200 | 52 | $210,000 |

All of it scaled by district wealth, and all of it paid **dirty** — which is why
laundering capacity starts to matter the moment a family actually holds ground.

**Buying** an unclaimed racket costs clean money and is safe. **Taking** one that
somebody holds is the crew system's reason to exist:

```
chance = 50%
       + 5.5% per crew member (max 8)
       + (combat skill / 100) × 18%
       + rank level × 2%
       − racket defence / 100
       − 1.2% per defender standing behind it
       − 18% flat if you bring no crew at all
       clamped to 3%–90%
```

You must be **standing in the district**, be **made**, and your family must **operate in
that city**. A racket that has just changed hands is untouchable for 30 minutes, so two
crews cannot ping-pong the same racket all evening.

Racket income pays the **crew's captain** where a crew holds it, and the **family
treasury** where it does not.

---

## 5b. Diplomacy

Every pair of families is Neutral until a boss changes it. Proposals arrive in the other
boss's **inbox**.

| State | Partners | Effect |
|---|---|---|
| **Neutral** | any number | The default. Everybody can rob everybody |
| **Non-Aggression Pact** | one | Members of both families cannot attack or mug each other. Either boss can tear it up |
| **To the Mattresses** | one | Soldiers and above on both sides can assassinate each other freely — no contract, no bounty, no orders |
| **Allies** | one | When your ally goes to the mattresses, your soldiers inherit the war. Either boss can walk away |

> **A decision worth flagging:** the brief described all four as requests landing in the
> other boss's inbox. Pacts and alliances work exactly that way — they need consent. War
> does **not**: it is declared, and the other boss is *notified* rather than asked,
> because a war you need permission to start is not a war. Change
> `requiresConsent` in `src/game/diplomacy.js` if you would rather it be symmetrical.

A pact or alliance can be ended with a button (after a one-hour minimum, so nothing is
signed and torn up in the same breath). **A war cannot.** Ending a war means opening the
**peace offering menu** — money from your treasury, rackets off your map, or both — and
sending terms the other boss has to accept. On acceptance the transfers happen
immediately and both families return to Neutral.

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

- **Dirty** — crime and racket income. Buys guns, bribes and tribute. Cannot buy
  property, plane tickets, or a family.
- **Clean** — salaries, laundered money, arrest bonuses. Buys everything. Earns 1%
  weekly interest.

**Both die with you.** See §12.

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

## 12. Violence, death, and the Quantum Bank

### Anyone can rob anyone
Any player may attack any other in the same district and take **25% of the dirty money**
on them. The defender's property safety counts only if they are *inside* it. The single
exception is a **non-aggression pact** — members of two families bound by one cannot
touch each other at all.

### Only a boss can order a killing
The boss funds the bounty from the family treasury, assigns a **captain**, and the
captain picks a **shooter from their own crew**. The shooter must be in the same city,
must be armed, and resolves against the target's combat score — including their
property's safety rating if they are indoors.

### Unless you are at war
Under **To the Mattresses**, soldiers and above on both sides can kill each other with no
contract, no bounty and no orders — but only made men, on both ends. An ally inherits the
war and the licence with it.

### Death is permanent
There is no revive. When a character is killed:

- the character is finished — **cash, rank, family, crew, property, all gone**
- the account creates a **new character**, and may take a completely different path
- a boss's death triggers succession (the most-respected captain inherits); a captain's
  death leaves their crew standing but leaderless
- the family **keeps its rackets** — territory belongs to the family, not the man

### The Quantum Bank
The one account that outlives you. It belongs to the **account, not the character**.

- Deposits cost a **10% fee**, minimum $1,000
- It pays **no interest** — it is a vault, not an investment
- Withdrawals are free and instant
- It is untouched by death

The fee is the whole design. Without it the vault is free insurance against every risk
in the game and nobody ever carries anything worth stealing; with it, hoarding is a real
cost and the decision of *how much* to protect is the interesting one.

---

## 13. What is deliberately not built yet

Called out honestly rather than left as a surprise:

- **Elections do not auto-close.** The endpoints to stand, campaign and vote all work,
  and terms have end dates, but the cron that closes a race and seats the winner is
  specified in `XANO_SETUP.md` §7 and not implemented in the mock.
- **Peace offers do not expire.** `PEACE_OFFER_EXPIRY_HOURS` exists in config and is not
  yet enforced by a cron.
- **Rackets have no active defence.** Defenders raise the difficulty by existing, but a
  defending crew cannot be alerted or choose to reinforce.
- **Crew jobs are announcements, not multi-player instances.** `POST /crews/jobs` records
  the job and the crew can see it; a real "everyone joins, then it resolves together"
  flow needs a job state machine.
- **Chat polls every 5 seconds.** Swap for Xano Realtime — §8 of the setup guide is a
  drop-in replacement.
- **Chief-by-seniority fallback** is specified but only the appointment path is coded.
- **NPCs do not act.** The seed populates the world so it is not empty, but the NPCs
  never commit crimes or make arrests on their own.
