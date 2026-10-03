# Browser test pass — Cities of Sin (M1)

A click-through check that the numbers are right: money, heat, nerve, respect,
cooldowns, arrest and bail. Everything here is done in the browser. No terminal,
no database, no developer tools.

**Start at:** `http://localhost:5173`
**Time:** about 15 minutes solo, 20 with a second account for chat.
**You need:** one account. A second one (different email, private window) for the
chat tests at the end.

Work through it in order — later steps depend on money and respect earned earlier.
Tick each box, and note the actual number whenever it disagrees with the expected one.

---

## 1. Sign up and create a character

- [ ] Landing page loads signed out, and shows **four city cards**
- [ ] Sign up, confirm the email, sign in
- [ ] Character creation appears
- [ ] Type `Johnny` / `The Boy` / `Smith` → preview reads exactly **Johnny 'The Boy' Smith**
- [ ] Clear the nickname → preview reads **Johnny Smith**, with no stray quote marks
- [ ] "Start living" stays **disabled** until you have a name, a path and a city
- [ ] Choose **Mafia** and **New York**, submit

**The dashboard should now read exactly:**

| | |
|---|---|
| Clean | **$2,000** |
| Dirty | $0 |
| Respect | 0 |
| Heat | 0 |
| Nerve | 10/10 |
| Health | 100 |
| Rank | **Hoodlum** (because you picked Mafia) |
| District | **Red Hook Docks** |

- [ ] All of the above match
- [ ] A yellow "new-arrival protection" banner is showing

> **Start from a brand-new Mafia character.** Every number in this document
> assumes it. The starting rank is set by the path you choose — Mafia gives
> Hoodlum, Politician gives Staffer, Police gives Rookie — so a character on
> another path will read differently and is not a bug. Reusing an existing
> character also breaks the heat and respect baselines that steps 2, 3 and 8
> depend on.

---

## 2. Check the odds before doing anything

Go to **Work**. You are in Red Hook Docks with 0 heat and 0 respect, so every
number on this screen is predictable. It should read exactly this:

| Crime | Odds | Payout shown |
|---|---|---|
| Pickpocket | **78%** | ~$138 |
| Boost from a Store | **74%** | ~$207 |
| Mugging | **68%** | ~$299 |
| Shake Down a Storefront | **66%** | ~$368 |
| Skim a Card Reader | **64%** | ~$437 |
| Run the Numbers | **71%** | ~$460 |
| Collect on a Loan | **70%** | ~$863 |
| Boost a Car | **60%** | ~$748 |
| Burglary | **56%** | ~$1,035 |

- [ ] All nine match
- [ ] **Collect on a Loan** and **Boost a Car** are dimmed, showing "Needs 20 respect"
- [ ] **Burglary** is dimmed, showing "Needs 40 respect"
- [ ] The **Organised** tab shows crimes, all of them locked

---

## 3. A successful job

Write down your Dirty, Nerve, Heat and Respect. Run **Pickpocket** until it works.

- [ ] Result card says **"It worked"**
- [ ] Dirty went up by somewhere between **$117 and $159** — never outside that range
- [ ] **Clean did not change.** Crime never pays clean money
- [ ] Nerve went down by exactly **1**
- [ ] Respect went up by exactly **2**
- [ ] The card shows **Heat +0.8**
- [ ] "Odds were" on the card matches the 78% the button showed

> Read heat from the **result card**, not the dashboard. The dashboard rounds to a
> whole number, so 0.8 shows there as 1. The card is the precise figure.

- [ ] Go to **Profile** → the job appears in the Rap sheet with the same amount

---

## 4. A failed job

Keep going until one fails.

- [ ] Result card says **"It went wrong"**
- [ ] Dirty did **not** change
- [ ] Nerve was **still spent** — failing costs you the same nerve
- [ ] Respect did **not** change
- [ ] The card shows **Heat +1.28** — exactly 1.6× the 0.8 a success gives

That multiplier is the point: a botched job is louder than a clean one.

---

## 5. Cooldowns

Straight after any Pickpocket:

- [ ] Its button is disabled with a countdown starting at **90s**
- [ ] The countdown ticks down every second on its own
- [ ] **Other crimes are still available** — cooldowns are per-job, not global
- [ ] Reload the page mid-countdown → the remaining time is still right
- [ ] When it reaches zero the button comes back without a reload

---

## 6. Running out of nerve

- [ ] Spend all 10 nerve. Every button now reads **"Not enough nerve"**
- [ ] Nothing can be clicked through anyway
- [ ] Nerve comes back **1 point at a time**, roughly every 5 minutes

Don't sit and wait for a full refill — carry on with the money tests below and
come back.

---

## 7. Heat changes the odds

Once you have some heat built up:

- [ ] Odds on every crime are **lower** than the table in step 2
- [ ] At 20 heat, Pickpocket reads **75%** instead of 78%
- [ ] Above 45 heat, a red **"Wanted"** badge appears on the dashboard

---

## 8. Moving district

Go to **District**.

- [ ] Six New York districts listed, with **"You are here"** on Red Hook Docks
- [ ] Click **Go** on **Midtown** — free and instant
- [ ] The dashboard now shows Midtown, wealth **1.50×**, policing **1.40×**
- [ ] Back on **Work**: Pickpocket pays **~$180**
- [ ] Pickpocket's odds have **dropped** relative to Red Hook

> The payout figure is exact. The odds are **not** a fixed number here, because
> by this point you are carrying heat from steps 3–7. Midtown alone costs you 3
> points versus Red Hook (78% → 75%); your heat takes off a further
> `heat ÷ 100 × 15`. At 20 heat you should see **72%**. Check the direction and
> the size of the drop, not an absolute figure.

Richer district, better money, worse odds, more heat. That's the trade.

- [ ] Go back to Red Hook Docks

---

## 9. Money

Go to **Money**. You should have a decent pile of dirty by now.

- [ ] Clean, Dirty and Vault match what the dashboard says
- [ ] Launder **$1,000** → Dirty drops 1,000, Clean rises by exactly **$600**
- [ ] Try to launder more than you have → refused, with a readable message
- [ ] The **"All of it"** button fills in your exact dirty balance
- [ ] Deposit **$1,000** into the vault → Clean drops 1,000, Vault rises **$900**
- [ ] Try to deposit **$999** → refused, under the minimum
- [ ] Withdraw **$500** → Vault drops 500, Clean rises **$500** (no fee coming out)
- [ ] Try to withdraw more than the vault holds → refused

60% on the way in to laundering, 10% on the way in to the vault. Those are the
two taxes in the game right now.

---

## 10. Travel

Go to **Travel**. You need $1,500 clean — launder some if you're short.

- [ ] Four cities listed, **"You are here"** on New York
- [ ] With less than $1,500 clean, the Fly buttons are **disabled** and say why
- [ ] **Dirty money does not help.** Only clean counts — this is the whole point of clean vs dirty
- [ ] Fly to Chicago → Clean drops exactly **$1,500**
- [ ] You land in **Cicero**
- [ ] On **Work**, the New York job "Squeeze the Local" is gone, replaced by Chicago's "Fix a Ward"
- [ ] Fly back to New York

---

## 11. Getting arrested

**Do this in Midtown, not Red Hook.** District policing multiplies both the heat
you gain and your odds of being taken in, so where you stand matters more than
how long you play:

| At 20 heat, a failed job | Chance of arrest |
|---|---|
| in Red Hook Docks (policing 0.80) | ~23% |
| in **Midtown** (policing 1.40) | **~41%** |

Move to Midtown and repeat **Skim a Card Reader** (2 nerve, high heat, middling
odds). It snowballs on purpose: heat lowers your odds, more failures mean more
heat, and every failure rolls for arrest. One full nerve bar in Midtown is worth
roughly 30–40 heat, so you should be arrested inside one or two bars — no need
to grind for an hour.

That same run also gets you past 45 heat, which is the **"Wanted"** badge from
step 7. Tick that off here if you did not reach it earlier.

Then keep failing jobs until you get caught.

- [ ] Result card says you were arrested, and gives a sentence length
- [ ] Dashboard shows a **red cell banner** with a ticking countdown
- [ ] **Work**: every crime is blocked
- [ ] **Travel** and **District**: both refuse to move you
- [ ] **Chat**: your district room is replaced by **"The Block"**
- [ ] **Prison**: bail equals the seconds remaining **× 8**. Check it against the countdown
- [ ] Watch for a moment — **bail falls** as the sentence runs down
- [ ] Post bail → Clean drops by exactly the quoted amount, and you're out immediately
- [ ] The cell banner clears

Alternatively let a sentence run out on its own and confirm you're released
without having to do anything.

---

## 12. Chat (needs the second account)

Open a private window, sign up a second account, put it in the **same district**.

- [ ] Message from one window appears in the other **within a second, without refreshing**
- [ ] Move one character to a different district → they stop seeing the district room
- [ ] **Global** still reaches both
- [ ] Send 6 messages in under 10 seconds → the 6th is refused with "Slow down"
- [ ] An empty message can't be sent
- [ ] Scroll up to read back, then receive a message → the view does **not** jump to the bottom
- [ ] Scroll to the bottom, receive a message → it follows

---

## 13. Standing and profile

- [ ] **Standing** lists both accounts, with your own row highlighted
- [ ] The **Respect**, **Money** and **Most wanted** tabs each re-sort correctly
- [ ] The money column shows **clean only** — dirty and vault are never shown to other players
- [ ] **Profile**: edit your bio, save, reload → it persists
- [ ] The Rap sheet matches the jobs you actually ran, newest first
- [ ] **District**: the other account shows up when you're both in the same place

---

## Don't report these

All intended at this stage:

- **Rackets, Politics, Police** in the sidebar are greyed out and do nothing
- **Politician** and **Police** paths give you a rank and no income — there's no
  salary system yet, so those two genuinely have nothing to do
- No combat, no mugging other players, no assassination, no death
- Nobody can own a district or a racket (families exist, but hold no territory yet)
- The **Projects** crime tier doesn't exist yet
- Laundering is a flat 60% because there are no fronts to improve it
- The new-arrival protection banner counts down but protects against nothing yet
- Prison has nothing to do but chat and pay bail

---

## Reporting

For anything that fails, give:

1. **The step number**
2. **Expected vs actual, as numbers** — "heat went up 2.1, expected 0.8", not "heat looked wrong"
3. **Which district you were in**, and your **heat and respect** at the time — both change the maths
4. A screenshot if it's a visual problem

Money and heat moving by the wrong amount matters most. Layout issues matter least.
