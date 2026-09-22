# Mobile build plan — EloState Sales Coach, 2026-09-19 revision

**Written 2026-09-22.** Source: every file in `source-files/`, all fourteen opened and read
(see `EVIDENCE.md` beside this document). Target repo: `C:\Users\johns\IOS-APP\Elostate-Sales-coach`
— Expo / React Native / expo-router / TypeScript.

Governing rule, carried over from the web build and set by the founder:

> **Build the system logically, so contradiction is not applied but noted.**

---

## 0a. RULINGS TAKEN 2026-09-22 — this plan is amended, not merely annotated

Two questions this plan left open were put to the founder after an independent re-inspection of
`source-files/` (see `EVIDENCE-INSPECTION-2026-09-22.md`). Both were answered. The sections they
touch are rewritten below rather than footnoted, because a plan that records a decision in one
place and contradicts it in another is the drift this build exists to avoid.

| Ruling | Effect |
|---|---|
| **R-A. The boards live under Today's Metrics, not Pitch Performance.** The mockup's own bottom bar highlights **Today's Metrics** on p1 — amber icon, amber label — and the canvas JPEG agrees. This plan had placed them in Pitch Performance. | §1, §5.1, §5.2 rewritten. **DECISION 2 is dissolved**, not answered: a "Metrics" segment inside the Today's Metrics tab is that tab's own page, so the duplicate-name problem does not arise. §7, §9 and MB4 updated. |
| **R-B. A presentation is a recorded pitch, on Pitch Score surfaces.** The new design wins, per the founder's standing amendment. This reverses, for these boards only, the 2026-09-11 production decision recorded in `LOGIC-AND-CONTRADICTIONS.md` §B3. | New **MB7** in §10. Nothing in M1-M8 computes presentations, so no task changes — but any board that prints the figure must name its source. |
| **R-C. The competition card keeps its own window and captions it.** The toggle governs the gauge, the chips and Breakdown; the card reads the competition week and says so. | New **MB8** in §10; §5.1 element 3 rewritten. No server change. |
| **R-D. Pitch Score takes the "Progress" segment; the Arena becomes "Points".** Both survive, each saying what it counts. The Arena keeps its own route at `/(app)/progress`. | §3 and §5 rewritten; **DECISION 1 is answered**. The control becomes four segments: Progress · Breakdown · Metrics · Points. |

**Why R-B does not reintroduce the 333% close rate.** §B3's impossibility came from MIXING sources:
sold counted from `door_knocks`, presentations from `pitches`, so sold could exceed presentations.
The guide's KPI block (page 3) defines the new system from one table — *"Presentations: recorded
pitches"* **and** *"Sold: pitches with outcome = sold"*. Sold is then a subset of presentations by
construction and the ratio cannot pass 100%. [OBSERVED — guide p3, read 2026-09-22]

**What R-B does cost, stated so it is not discovered later.** The Door Log's KPI bubbles count
presentations as `doors_knocked − no_answer`; these boards will count recorded pitches. **The same
rep on the same day will see two different presentation counts in one product.** That is survivable
only if each surface says which it counts, and every task below that prints the figure must.

---

## 0. The one-paragraph version

The revision gives the phone **two boards and a sheet**: a rebuilt **Progress** board, a new
**Breakdown** board, and the **Scoring rubric** opening over both. Pitch detail is a *web* screen,
not a mobile one. The backing API is already built and deployed — the phone calls the same
`/api/coach/sales-session/pitch-score/*` routes the web does, and today it calls none of them.
The hard part of this build is not the two boards. It is that the phone **already has** a screen
called Progress, a milestone strip, a points total and a rank, all from the gamification system,
and the revision introduces a second of each. Section 3 is that collision and it is the section to
read first.

---

## 1. What the sources actually assign to the phone

Two documents disagree, and the disagreement is already settled on the record.

| Source | Says |
|---|---|
| `EloState Coaching Build Plan  Engineering Guide.pdf`, Step 2 | "Build the rep dashboard (**mobile**) — Match the mockup boards Progress, Breakdown, **Pitch detail** and Scoring rubric." |
| `WHATSAPP.txt` (whole file, verbatim) | "Pages 1-2 will one on the app. **Page 3 will be on the web version.** Page 4 will be the 'score rubric' button that is on page 1 and 2 (on the app)" |

`LOGIC-AND-CONTRADICTIONS.md` §B1 resolves it **in favour of the note**: the newer, more specific
instruction wins, and page 4 "is not a screen — it is what opens behind the *View scoring rubric*
button on pages 1 and 2."

**So the mobile scope is:**

| Mockup page | Mobile? | What it becomes |
|---|---|---|
| p1 Progress | **yes** | A board inside **Today's Metrics** (R-A) |
| p2 Breakdown | **yes** | A board inside **Today's Metrics** (R-A) |
| p3 Pitch detail | **no — web** | Already shipped on web this session |
| p4 Scoring rubric | **yes, as a sheet** | Opens over p1/p2, not a fourth destination |

**One correction to the record, found while reading for this plan.** `LOGIC-AND-CONTRADICTIONS.md`
§H marks B1 "unconfirmed" because it says B1 rests on an instruction image the API rejected and
never displayed. It does not. B1's own source table cites `WHATSAPP.txt`, which is plain text, 143
bytes, present in the folder and quoted above in full. Only **B2** (the navigation restructure)
leaned on that image. B1 is settled by text and needs nothing further. [OBSERVED — both files
opened 2026-09-22; neither JPEG in the folder is the banner image §H describes.]

---

## 2. What the phone already has

Read from the repo, not assumed. [OBSERVED 2026-09-22]

| Route | Lines | What it is today |
|---|---|---|
| `(tabs)/index.tsx` | — | Home |
| `(tabs)/pitches.tsx` | 360 | **Pitch Performance** — a list of recorded pitches mirroring the web's Door Log *report card*. Its own docblock says the period tabs "deliberately do NOT live here". |
| `(tabs)/metrics.tsx` | 62 | **Today's Metrics** — a two-page pager: page 0 = the Arena, page 1 = door field metrics |
| `(tabs)/roleplay.tsx` | — | Role Play |
| `(app)/progress.tsx` | 27 | **Your Progress** — the Arena on its own route, sharing `components/arena-page.tsx` with the pager |
| `(app)/scoreboard.tsx` | 324 | Scoreboard, reading `gamification_leaderboard` directly |
| `(app)/pitch/[pitchId].tsx` | 318 | Pitch detail — **the Door Log report card**, not the Pitch Score detail |
| `src/lib/gamification/arena.ts`, `milestone-dates.ts` | — | The gamification milestone strip, built and live |

Three facts that shape everything below:

1. **The bottom tab bar already matches the mockup exactly** — Home · Pitch Performance ·
   Today's Metrics · Role Play. Nothing to add; the design was drawn from the shipped app.
2. **The app calls zero Pitch Score endpoints.** `grep -rn "api/coach/sales-session/pitch-score"
   src/` returns nothing. (A looser `grep -rn "pitch-score" src/` returns one line —
   `after-pitch-card.tsx` importing `@/lib/after-pitch-scores`, a different module that shares a
   substring. Worth knowing before someone re-runs the search and concludes otherwise.)
   Project 1's entire API is unused here.
3. **`coachGet(path)` hits `ENV.API_BASE + path`**, so every route built on web this session is
   already reachable from the phone with no backend work.

---

## 3. The collision — read this before writing any code

The revision introduces a second of four things the phone already shows. Each is individually
survivable; together they ask a rep to hold two of everything.

| The rep already sees | The revision adds | Same? |
|---|---|---|
| **Your Progress** — the Arena: points, sessions, trend | **Progress** — the Pitch Score board: 80.3 gauge, base/bonus/violations | **No.** Different scale, different source, same word. |
| Milestones `spark · flame · deal · century · closer` | Milestones `First pitch · Triple digits · In the door · Full bundle · Clean sweep · Century` | **Two overlap.** `spark` is "First pitch scored"; `century` is "100 sessions" vs "100 scored pitches". |
| Points from `agent_point_ledger`, 0–100 per session | Points from `pitch_scores`, 0–130 per pitch | **No.** Not comparable. |
| Scoreboard rank from `gamification_leaderboard` | "#2 on your team this week", "rank #2" | **No** — and see §4, the rank is forbidden anyway. |

`TWO-SCORING-SYSTEMS.md` states the milestone row precisely: *"UNBUILT, AND TWO ALREADY OVERLAP.
Built fresh, a rep earns two First-pitch badges and two Centuries under different names."*

On web this was resolved by naming both and letting each say what it counts.
`LOGIC-AND-CONTRADICTIONS.md` §M records the cost of doing that twice in one day:

> *"The product now asks a rep to hold two scoring systems, two leaderboards and two milestone
> sets in their head, each individually correct. That is … a founder decision — which system is
> THE system — that has never been asked, because every individual collision looked survivable on
> its own."*

**On a phone this is worse than on web**, for a reason the web build did not face: the web puts
the Arena and the Pitch Score boards on *different pages*. The phone's design puts the new
Progress board one tab away from the Arena, and `metrics.tsx` page 0 *is* the Arena. A rep
swiping between two tabs sees two totals, two milestone strips and two "progress" screens.

**This plan does not resolve it.** It is flagged as **DECISION 1** in §9 and every task below is
written so the choice is a switch, not a fork.

---

## 4. The rep-visibility ruling, which changes the drawn board

Founder ruling, 2026-09-22, recorded in `LOGIC-AND-CONTRADICTIONS.md` § "L (resolved)":

> **When the rubric sheet and `SalesCoach-KPI-System.md` conflict on anything a REP sees, the KPI
> document wins.** The test is: *is this a target or a position?* A distance you can close by
> pitching better is a goal and survives. A rank, and a cushion you can lose, are positions and do
> not.

The Progress board as drawn (mockup p1) shows four affected things:

| Drawn on p1 | Under the ruling | Build |
|---|---|---|
| "#2 on your team this week" | a **position** | **omit** |
| "62 pts behind #1" | a **distance you can close** | **keep** |
| "118 pts ahead of #3" | a **cushion** | **omit** |
| "Best 106.5 · **rank #2**" | best kept; rank is a position | keep the best, **omit the rank** |

This is the most likely thing in this build to look like a bug against the mockup. It is not.
**Enforce it at the API boundary, not in the component** — the web build strips rank and field
size at the route for the stated reason that "a value that never leaves the server cannot be
exposed by a rendering bug". The phone consumes that same route and therefore inherits the
protection; the mobile component must branch on **whether the field is present**, never on a role
flag.

---

## 5. The boards, element by element

Everything below is from `EloState Rep Pitch Dashboard.pdf` pp. 1–2 and 4, opened at full
resolution. Values in the mockup are sample data.

### 5.1 Progress (mockup p1)

| # | Element | Source | Notes |
|---|---|---|---|
| 1 | Segmented control `Progress \| Breakdown \| Metrics` | — | Third segment: see §7 |
| 2 | Period toggle `Day \| Week \| Month \| All time` | — | **Carries across Progress and Breakdown** (guide Step 2) |
| 3 | Competition card: "WEEK 38 SHOWDOWN · Ends Sun 11:59 PM", "62 pts behind #1", "Prize eligible: 5-pitch minimum met" | leaderboard route | rank and cushion removed per §4 |
| 4 | Radial gauge, avg Pitch Score, band label, "Best 106.5" | aggregate | Gauge range **0–130**, not 0–100 |
| 5 | Three chips: avg base /100, avg bonus /30, avg violations | aggregate | Bonus is **already capped per pitch** before averaging — `LOGIC…` §C5 |
| 6 | **View scoring rubric** button | — | Opens the §5.3 sheet |
| 7 | Total points as digit tiles, "+177 today" | aggregate | |
| 8 | "18 of 23 pitches counted — 5 didn't reach Discovery or scored under 40 base. Tap to see which ›" | aggregate + `not_qualifying_reason` | Qualification is judged on **base**, the list displays **total** — `LOGIC…` §C3 |
| 9 | YOUR BEST PITCHES ×3, each "See scoring" | aggregate | Links to **web** pitch detail (§1) |
| 10 | MILESTONES — earned amber **with dates**, unearned grey **with criteria** | see §3 | Caption shows only when unearned [OBSERVED, p1] |

### 5.2 Breakdown (mockup p2)

| # | Element | Notes |
|---|---|---|
| 1 | "Your rubric averages / 18 qualifying pitches this week" + **Rubric** button | Same sheet as §5.3 |
| 2 | **BIGGEST OPPORTUNITY** — exactly **one** callout | The shipped web board opened with up to four; `EVIDENCE.md` flags this. One. |
| 3 | BASE SCORE n/100 with six section bars | |
| 4 | `LOWEST` badge on one section | **By percentage of max, not absolute points** — `LOGIC…` §C1. Transitions 4.7 is lower in points; Close 8.6 is badged, because 57.3% < 58.8%. |
| 5 | The lowest section **expands inline inside its own card** to element rows with "72% hit · 16% partial · 12% missed" | Inline, not a new screen [OBSERVED, p2] |
| 6 | BONUS POINTS +n/30 cap — table `Bonus \| Earned in \| Avg pts`, 10 rows | |
| 7 | VIOLATIONS −n — 5 rows, including a zero row rendered as "None · 0" | A zero violation is **shown**, not hidden |
| 8 | Reconciling footer `68.9 base + 14.6 bonus − 3.2 = 80.3 avg` | This is an **assertion**, not decoration — guide's launch checklist |

### 5.3 Scoring rubric sheet (mockup p4)

Not a tab. A modal/sheet over Progress and Breakdown, **read-only, rendered from `rubric_config`
so it never goes stale** (guide Step 2 item 4).

Contents: `100 + 30 − Viol. = 130 Max score`; HIT / PARTIAL / MISSED definitions; six collapsible
sections with every element and its points; 13 bonuses; 5 violations; COMPETITION RULES ×5.

**Do not hard-code the rubric.** Every number in it is in `rubric_config` on the server.

---

## 6. Data — nothing new to build

All of it exists and is deployed. The phone needs read clients only.

| Need | Endpoint (already live) |
|---|---|
| Aggregate for the period | `GET /api/coach/sales-session/pitch-score/breakdown?period=…` |
| Competition card | `GET /api/coach/sales-session/pitch-score/leaderboard` |
| Milestones | `GET /api/coach/sales-session/pitch-score/milestones` |
| Rubric for the sheet | `rubric_config` via the score route |
| A single pitch | `GET /api/coach/sales-session/pitch-score?sessionId=…` — **web detail**, mobile links out |

Consume them through the existing `coachGet<T>(path)`. Every one is RLS-scoped to the caller, so a
rep gets their own figures and nothing else.

**Read-only.** The phone writes nothing in this revision. Disputes, overrides and comments are all
web surfaces.

---

## 7. The third segment, and what is honestly unspecified

The boards draw `Progress | Breakdown | Metrics`. The guide's Step 2 names four boards and
**never mentions a Metrics segment**. `LOGIC-AND-CONTRADICTIONS.md` §D records this as
"in the design, absent from the spec" and the web build left it "declared-but-empty … so the tab
bar matches the design without fabricating content nobody specified."

On the phone there is an additional wrinkle: **"Metrics" is also the name of an existing bottom
tab** ("Today's Metrics"). A segment and a tab with the same word, one level apart.

**RESOLVED by R-A — the problem it described does not exist.** That recommendation was written
while this plan believed the boards lived in Pitch Performance, which put a "Metrics" segment one
level from a "Today's Metrics" tab. Under R-A the boards ARE pages of Today's Metrics, so the third
segment is that tab's existing content — the Arena and the door field metrics `metrics.tsx` already
renders. Nothing is invented, nothing is declared-but-empty, and no name is duplicated.

The wrinkle moves rather than vanishing, and §3 is where it now lands: `metrics.tsx` page 0 is the
Arena, so the segment that completes the drawing is also the screen that carries the OTHER progress
system. DECISION 1 is therefore sharper under R-A, not softer.

---

## 8. Build order

Each step is shippable and verifiable on its own.

| Step | Work | Done when |
|---|---|---|
| **M0** | Decide §9 DECISION 1 and 2 | The two questions are answered; nothing below is blocked on them except where noted |
| **M1** | `lib/pitch-score/` read clients + types over `coachGet`. Mirror the web's types; **no second copy of any derivation** | Types compile; a fixture round-trips |
| **M2** | Period toggle as shared state across Progress and Breakdown | Switching on one moves the other |
| **M3** | **Breakdown board** (§5.2) — build this *before* Progress | The reconciling footer's identity holds on live data |
| **M4** | **Scoring rubric sheet** (§5.3) from `rubric_config` | Every number traceable to the server; nothing hard-coded |
| **M5** | **Progress board** (§5.1), minus anything §4 forbids | Gauge, chips, counted-card and best-pitches render; rank absent |
| **M6** | Milestones, per DECISION 1 | No rep can earn two First-pitch badges |
| **M7** | Third segment — under R-A this is `metrics.tsx`'s existing content, so the work is wiring the segmented control to the pager, not building a board | Switching segments moves the pager, and the Arena page is reachable |
| **M8** | Empty, failed and partial states across all three surfaces | A failed read never renders as a zero |

**Why Breakdown before Progress**, against the drawn order: Breakdown carries the reconciliation
the launch checklist demands (`sections sum to base; base + bonus − violations = avg`). If that
identity does not hold, every number on Progress is wrong too and the gauge is the last place you
would notice. Build the screen that can fail loudly first.

---

## 9. Decisions this plan does not take

**DECISION 1 — ANSWERED 2026-09-22 by R-D.** It was put to the founder with the collision stated
in full, which `LOGIC-AND-CONTRADICTIONS.md` §M records as never having happened before: *"which
system is THE system"*. The answer is **name both**, for the third time in this product's history
and this time deliberately rather than by default — Pitch Score takes the `Progress` segment, the
gamification Arena becomes `Points`, and the Arena keeps its own route so nothing a rep learned is
deleted.

**What this obliges every later task to do.** Two point totals, two milestone sets and two "best"
figures now sit in one segmented control, on one tab. Each surface must state what it counts, in
its own copy, beside the number. A rep who can reach both in one swipe and is told neither is being
asked to reconcile them privately — which §M names as the cost that has never been priced.

**DECISION 2 — the third segment. DISSOLVED by R-A, 2026-09-22.** Not answered: the condition
that made it a question was this plan's own wrong placement. See §7.

**Carried from the web build, unresolved and equally binding here:**

- **B4 — does a Partial count as a miss** in pattern detection. Still a named parameter.
- **The Pitch Score implementation guide is not in the folder.** `LOGIC…` §E: guide page 2 names
  "Pitch Score System — Engineering Implementation Guide" as holding the full scoring detail.
  It has never been read. Mobile does not score, so this does not block M1–M8 — but any question
  about *why* a number is what it is may be answered in a document nobody here has.

---

## 10. Contradictions register for this build

Noted, not applied. Nothing below may be hard-coded.

| # | Contradiction | Status |
|---|---|---|
| **MB1** | Guide Step 2 says Pitch detail is mobile; `WHATSAPP.txt` says web | **Resolved** — web, per §B1. Corrected §H's claim that this depends on an unshown image. |
| **MB2** | Mockup p1 shows rank and cushion; the founder's L-ruling forbids both to reps | **Resolved** — ruling wins, §4. The board will not match the drawing. |
| **MB3** | Two "Progress" screens, two milestone sets | **OPEN — DECISION 1** |
| **MB8** | The period toggle offers **Day**; the leaderboard route accepts only week/month/all and silently falls back to **all-time**, so a Day selection would put an all-time competition figure above a one-day gauge | **RESOLVED by R-C.** The card was always drawn as a fixed weekly contest ("WEEK 38 SHOWDOWN · Ends Sun 11:59 PM"), not a view of the toggle. It reads the competition week and captions itself, so no selection can silently change it. The server is unchanged and the mismatch becomes impossible to express. |
| **MB4** | "Metrics" is both a segment and a bottom tab | **DISSOLVED by R-A.** Under the drawn placement the segment is the tab's own page, not a second thing sharing its name. |
| **MB7** | The manager board (drawn 19 Sep) captions its activity strip *"presentations are recorded pitches"* — the definition the founder reversed on 11 Sep after it produced a 333% close rate | **RESOLVED by R-B — the new design wins, on Pitch Score surfaces only.** The Door Log keeps `doors_knocked − no_answer`. Two definitions now coexist deliberately, so **every surface printing the figure must name its source**. See §0a for why the impossibility does not recur. |
| **MB5** | The dot strip legend reads "Missed / Done right / **Not applicable**", over a strip the guide defines as "the last 10 **applicable** pitches" — a set containing its own exclusion | **Noted.** Not a mobile surface in this revision (Pattern Interrupt is web). Recorded so it is not re-derived if a rep pattern view comes to the phone. `LOGIC…` §C4 reads it as `last min(10, applicableCount)`; the web build currently renders Missed / Done right / **Partial**, which matches neither legend. |
| **MB6** | Guide Step 2 says "Remove Strong calls, Deals closed and the last 6 calls chart" — the phone's Arena renders a trend of recent sessions | **Noted.** The instruction is about the *Progress board*, not the Arena. Do not delete the Arena's trend on the strength of a sentence written about a different screen. Depends on DECISION 1. |

---

## 11. What would make this plan wrong

Stated so it can be checked rather than trusted.

1. **No mobile surface has been rendered.** Every claim about the phone's current state is from
   reading its source, and every claim about the web API is from having built it. Neither is from
   running the app.
2. **The mockups are sample data.** `LOGIC…` §A recomputed twenty-four arithmetic identities
   across all three mockup datasets and all reconcile, which is why the numbers can be trusted to
   settle a *rule*. They cannot be trusted as *content*.
3. **Two of four badge definitions I would have guessed were wrong** — `LOGIC…` §M. `Triple
   digits` and `In the door` still carry no caption on the sheet and their definitions remain
   inferred. Against this sheet, a two-in-four miss rate is the best available evidence that the
   two unchecked ones are also wrong.
4. **`SalesCoach-KPI-System.md` is not in `source-files/`.** The L-ruling in §4 turns on it. It
   lives in the web repo and governs this build; it should be read before M5.

---

## 12. Not opened

- **The "EloState Rep Pitch Dashboard canvas" interactive mockups** — a link named on guide page 1,
  not a file. The four ▷ PLAY buttons in `WhatsApp Image … 04.50.33.jpeg` are its entry points.
  Never visited.
- **"Pitch Score System — Engineering Implementation Guide"** — named on guide page 2, not in the
  folder, never read. See §9.
- **`SalesCoach-KPI-System.md`** — governs §4, lives in the web repo, not read for this plan.
- **No screen of this mobile app, or of the web product, has been rendered in a browser or a
  simulator for this plan.** Source only.
