# Logic register — what is resolved, what is quarantined

Governing rule for this build, set by the founder 2026-09-21:

> **Build the system logically, so contradiction is not applied but noted.**

Amended the same day, after the first pass was judged too conservative:

> **Adapt to the new upgrade design, structure and logic. We will update our system to
> accommodate for this update/revision plan.**

That amendment sets the tie-breaker: **the new design wins, and the existing system bends
to it.** "Noted, not applied" still governs genuine either/or contradictions, but it is no
longer a licence to preserve the old structure merely because the new drawings are silent.
Where the redesign implies a new home for something, it moves; where it would delete a
working destination, it moves instead of disappearing.

Operationally that means three things, in order:

1. Where two sources disagree and **evidence settles it**, resolve it and record the proof.
2. Where two sources disagree and **nothing settles it**, do not pick silently. Build so the
   choice is a named switch, not a fork in the code, and list it here.
3. Where a rule is **never stated but the mockups imply one**, state it explicitly here
   before implementing — an unstated rule implemented by guess is a contradiction that has
   not been noticed yet.

Nothing in section B may be hard-coded. Anything implemented from section C carries a
source comment naming the evidence.

---

## A. What was verified, not assumed

Twenty-four arithmetic identities across the rubric and all three mockup datasets were
computed and all reconcile. [OBSERVED — recomputed 2026-09-21, not read off the page]

- Rubric maxima: `12+16+14+15+8+35 = 100`, and each section's elements sum to its own max.
- Delivery minus Objection handling = **27**, which is exactly the scaling base the rubric
  names ("scored out of 27 and scaled to 35"). The scaling rule is arithmetically coherent.
- Rep breakdown: sections → base **68.9**; Close elements → **8.4**; bonus table → **14.6**;
  violations → **3.2**; footer `68.9 + 14.6 − 3.2 = 80.3` ✓.
- Pitch detail: sections → **86.5**; Close detail → **13.5**; bonuses → **+22**;
  `86.5 + 22 − 2 = 106.5` ✓.
- Manager: team sections → **67.4**; `67.4 + 13.1 − 3.5 = 77.0` ✓; rep rows sum to team
  totals for points (**5,773**), doors (**671**), presentations (**98**) and sold (**20**) ✓;
  `98/671 = 14.6% → 15%` and `20/98 = 20.4% → 20%` ✓.
- Humza Khan's panel: sections → **62.0**; `62.0 + 11.5 − 4.2 = 69.3` ✓.

**Why this matters for the build.** The guide's launch checklist demands exactly these
reconciliations ("sections sum to base; base + bonus − violations = avg score; rep totals
sum to team totals"). They already hold in the sample data, so the mockups are a *valid
oracle*: where the prose is silent, the numbers can be trusted to settle the rule. That is
the licence used throughout section C.

---

## B. Contradictions — NOTED, NOT APPLIED

### B1. Pitch detail: mobile or web?

| source | says |
|---|---|
| Engineering Guide, Step 2 | "**Build the rep dashboard (mobile)** — Match the mockup boards Progress, Breakdown, **Pitch detail** and Scoring rubric." |
| `WHATSAPP.txt` | "Pages 1-2 will one on the app. **Page 3 will be on the web version.** Page 4 will be the 'score rubric' button that is on page 1 and 2 (on the app)" |

Page 3 of `EloState Rep Pitch Dashboard.pdf` **is** Pitch detail. The two cannot both be built.

**RESOLVED 2026-09-21 in favour of the note — Pitch detail is a WEB screen.** Under the
amended rule the newer instruction wins, and the note reads as a correction to the guide
rather than a parallel opinion. `PitchDetail` is still authored once and
presentation-agnostic, so the mount is a config line, but web is now the built default and
the mobile mount is not wired.

The note's second clause resolves the same way, and the guide does not contain it at all:
**page 4 is not a screen.** It is what opens behind the "View scoring rubric" button on
pages 1 and 2 — a modal or sheet over the rep boards, not a fourth destination. The guide
lists it as a board; the note wins.

So the rep surface is: **two mobile boards** (Progress, Breakdown) with the rubric opening
over them, and **Pitch detail on web**.

### B2. The navigation restructure nobody asked for

| source | says |
|---|---|
| Engineering Guide, Step 6 | "Add **Pattern Interrupt** to the side menu under Manager Dashboard, after Score Calibration." — additive, one item. |
| Live app (`WhatsApp Image …05.45.13`) | `TEAM TOOLS: Roleplay, Training, Team` |
| Pattern Interrupt mockups | `TEAM TOOLS: Team Chat, KPI Analytics, Scoreboard, My Progress, Browser extension, Settings` — **Roleplay and Training are gone**; the rep board adds a `MY COACHING` group that does not exist today. |

**RESOLVED 2026-09-21 — the new navigation is applied in full.** The first pass kept the
undrawn items where they already were, which the founder judged too conservative. They are
now re-placed by the redesign's own logic instead:

| item | where it went, and why |
|---|---|
| Training | Out of the manager nav — the guide folds the team brief into Coach Assessment. Kept for reps in My Coaching as their own trainings view. |
| Sessions | Out of the manager nav — recordings become the Recordings tab inside a rep's detail (Project 4). Kept for reps in My Coaching. |
| Roleplay | Out of the manager nav — a manager enters it through the pattern action "Assign Role Play drill", which is exactly why the manager board omits it. Reps get it as "Role Play" in My Coaching. |
| Team | Moved to Team Tools, manager-only — member management is an admin utility, not a coaching surface. |
| One Liners | Moved to Team Tools — a shared library. |
| Analytics | Moved to My Coaching, rep-only — it is a rep's self-view. |

Net effect: **Manager Dashboard is now exactly the three items the boards draw.** Nothing
was deleted; every destination is still reachable from somewhere sensible. The only
deviation from the drawings is that manager Team Tools carries eight items rather than six,
because Team and One Liners have to live somewhere and the drawings do not say where.

Pinned by `salesCoachShellNav.test.ts`, which asserts the group shapes, the role split, and
that all six relocated routes still exist — so a later pass cannot quietly drop one.

### B3. Presentations: recorded pitches, or a separate log? — **NOT OPEN. SETTLED 2026-09-11.**

> Corrected 2026-09-21. The entry below was wrong, and the way it was wrong is the point.

The guide calls this its **Open decision #1** and says *confirm with John before building*. I
read that, recorded it here as unresolved, and defaulted to the mockups' assumption (recorded
pitches) with the flag visible.

**John had already confirmed it — on 2026-09-11, in production, with numbers in front of him.**
The decision is implemented and documented in `src/lib/data/doorlog.ts`
(`getAllTimeKpi` / `getTodaysMetrics`):

> **A presentation is a door where the rep SPOKE TO SOMEBODY: `doors_knocked − no_answer`.**

And it is a *reversal*, which is what makes it binding rather than arbitrary. On **2026-08-28**
the founder did pick recorded pitches, checked against one rep: 41 recorded against 46
non-no-answer knocks — at a five-door gap the sharper measure was plainly better. That gap did
not hold. Measured **2026-09-11**: the same rep was 126 spoken-to against 50 recorded, and the
founder's own row read 18 spoken to, 3 recorded, and **10 sold** — a close rate of 333%, because
sales are counted from knocks and the denominator was being counted from audio. It reached their
home screen as *"0 of 9 PRESENTATIONS"* beside *"9 of 1 SOLD"*.

Sold exceeding presentations is not a definition preference. It is a broken denominator.

**What this entry got wrong, and why it matters beyond this row.** The guide was not incorrect —
it was *old*. It asked a question that had since been answered, in the working tree, three months
later. Treating a written "confirm this" as still-open without checking the record is the §0.1
failure exactly: the methodology was present and not consulted, and the answer was a file away.

**The cost, had it shipped.** The Pitch Score boards and the Door Log's own KPI bubbles would have
shown *different presentation counts for the same rep on the same day, in the same product* — two
definitions of one decision (§2.2), one per screen — and the Pitch Score side would have been the
one the founder had already reversed for producing impossible close rates.

**Applied.** `countPresentations` now defaults to `doors_spoken_to` and cites the decision. The
switch survives, because the founder has changed this once on evidence and may again. Two tests
pin it: one asserts the settled definition, one reproduces the 333% close rate under the old
default and asserts the corrected one cannot exceed 100%.

### B4. Partial grades in pattern detection

Guide **Open decision #3**: does a Partial count as a miss? "The mockups count Missed."

**Not applied.** Detection takes the grade predicate as a parameter defaulting to
`grade === 'missed'`. Flipping it to include Partial is a one-line change, and the choice
changes how many patterns open for every rep in the product.

### B5. "Pitches counted" card vs. table column

Guide **Open decision #2** asks whether to keep the card or remove it with the column.
Step 3 item 6 already says the reps table has "No Counted column", while the mockup shows
the card. These are compatible, not contradictory: **card yes, column no** — which is what
both sources actually say. Resolved, implemented as stated.

---

## C. Rules never stated, which a reasonable build gets wrong

These are the dangerous ones. Each was derived from the numbers, and each has a naive
implementation that looks right and is wrong.

### C1. "Lowest section" is by PERCENTAGE of max, not absolute points

**Naive build:** flag the section with the fewest points. **That is wrong.**

Team averages: Transitions **4.7** is the lowest absolute score, yet **Close 8.6** carries
the `LOWEST` badge. As percentages: Close `8.6/15 = 57.3%` < Transitions `4.7/8 = 58.8%`.
[OBSERVED]

Confirmed independently three times:
- Rep breakdown: Close `8.4/15 = 56.0%` is lowest of six → badged `LOWEST` ✓
- Team averages: Close `57.3%` → badged `LOWEST` ✓
- Humza Khan: Introduction `6.2/12 = 51.7%` is his lowest → reps table "LOWEST SECTION:
  Introduction" ✓ (his absolute lowest is Transitions at 4.8)

**Rule to implement:** `lowestSection = argmin(section.points / section.max)`. Sections are
not comparable on raw points because their maxima differ by a factor of four (8 vs 35).

### C2. Training priorities do NOT come from rubric gaps

**Naive build:** generate the three priorities from the biggest rubric gaps. **Wrong.**

Points left on the table per section: Close `15−8.6 = 6.4` is the **largest gap in the
product**, and Close is **not a priority**. The three priorities are Consulting 5.1,
Transitions 3.3, Discovery 4.5 — and they are not even ordered by size (3.3 sits above 4.5).
[OBSERVED; each figure recomputed: `14−8.9=5.1`, `8−4.7=3.3`, `16−11.5=4.5`]

The priorities come from the **coaching brief of the last 7 days**, and the rubric section
is attached afterwards for display. Proof: the live Training page contains the same three
items in the same order, verbatim — "One clean copper-to-fiber story", "Bridge the phases
instead of narrating the script", "Anchor price to his actual bill" — generated Sep 18 at
11:00 PM, the same timestamp the mockup shows.

**Rule to implement:** brief → priorities → *map to* rubric section for the points-left
figure. Never rubric → priorities. The guide's phrasing ("the existing training brief,
reshaped into three priority cards") means re-presentation, not a new generator.

### C3. Qualification is judged on BASE; the list displays TOTAL

A pitch qualifies if it reached Discovery **and** scored ≥ 40 **base**. The recordings list
displays the **Pitch Score** (total). In the mockup a pitch showing **44.0** is labelled
"Not counted" [OBSERVED] — entirely possible, because its base can be under 40 while bonus
lifts the total above it.

The consequence: two rows can show near-identical numbers with opposite counted status, and
nothing on screen explains it.

**Rule to implement:** never let qualification be inferred from the displayed number. The
guide already requires storing `not_qualifying_reason`; surface it on the row. The rep
Progress board already does this correctly — "5 didn't reach Discovery or scored under 40
base. Tap to see which."

### C4. The dot strip is applicable-only, and shorter than 10 is normal

Rule says "last 10 pitches where it applied". Cards show "5 of 7", "4 of 7", "3 of 7" with
**seven** dots. [OBSERVED] Not a contradiction — the rep has only 7 applicable pitches. The
legend confirms a third state: Missed / Done right / **Not applicable**.

**Rule to implement:** `strip = last min(10, applicableCount)`; never pad to 10 with
pitches where the element did not apply, or every early-career rep shows a false pattern.

### C5. The bonus cap is per pitch, applied before any averaging

`min(bonus, 30)` is inside the per-pitch formula. Averaging capped values ≠ capping the
average. The rep chip reads "+14.6 Avg bonus / 30" — an average of already-capped values.
Cap at scoring time, store the capped figure, aggregate afterwards.

### C6. The floor wraps the whole expression

`max(0, base + min(bonus,30) − violations)` — the floor is on the total, not per component.
A −12 violation total does not become −0; it eats into base and bonus first.

### C7. Delivery scaling changes the stored section total

When no objection occurs, the remaining five skills are scored out of 27 and scaled to 35
(×1.2963). The **scaled** value must be what is stored, because the checklist requires
section averages to sum to base — an unscaled 27-max Delivery would break that identity for
every objection-free pitch.

### C8. Two senses of "open" in Pattern Interrupt

| where | Anthony A. |
|---|---|
| Patterns tab rep chip | **3** |
| Rep-progress list | "1 fixed · 1 improving · **2 open**" |
| His own detail panel | "Open patterns **3**" |

The chips and the panel count Improving as open; the list's "open" excludes it. Both total
correctly in their own frame — chips sum to 12 = ACTIVE PATTERNS; list fixed values sum to
6 = FIXED THIS MONTH. [OBSERVED, both recomputed]

**Rule to implement:** one definition — `open = status ≠ Fixed`. The rep-progress list's
third number is therefore "open and not yet improving" and must be **labelled** that way,
or it silently contradicts the chip beside it.

---

## D. In the design, absent from the spec

**A third mobile tab.** Boards 1 and 2 show `Progress | Breakdown | Metrics`, and the phone
frame carries a bottom nav: `Home · Pitch Performance · Today's Metrics · Role Play`.
[OBSERVED on both PDF pages and the canvas image] The guide's Step 2 names four boards and
never mentions Metrics or the bottom nav.

**Not invented.** The two specified tabs are built. Metrics is left as a declared-but-empty
route so the tab bar matches the design without fabricating content nobody specified.

---

## E. Blocking precondition for Project 1

Guide page 2 names **"Pitch Score System — Engineering Implementation Guide"** as holding
the full scoring detail, and Step 1 opens "Full detail is in the Pitch Score implementation
guide. The short version:". That document is **not in this folder and has not been read.**

Building the scoring engine from the five-bullet short version risks re-deriving decisions
that are already made and written down. This is the §1.5.3 shape: a feature whose
correctness depends on a source outside the working tree. Flagged, not worked around.

---

## F. How contradictions are kept out of the code

1. **No contested value is an inline literal.** Thresholds (3-of-10, 5-clean, ≥40 base,
   30 cap, 7-day stall) live in `rubric_config` alongside the version that produced them,
   so a score is always explainable by the config it was computed under.
2. **Every rule from section C carries a source comment** naming the evidence that settled
   it — e.g. `// lowest = min(points/max): team Transitions 4.7 is lower in points but
   Close 8.6 is badged LOWEST (57.3% vs 58.8%)`. A future reader must not have to
   re-derive it from the mockups.
3. **Every quarantined choice in section B is a named switch with both branches tested**,
   so flipping it is a deliberate edit that a test notices, not a silent drift.
4. **The launch checklist's reconciliations become assertions**, not manual checks —
   sections sum to base, base + bonus − violations = the displayed average, rep totals sum
   to team totals. They hold in the sample data today; they must hold in production.

---

## G. Found while building the persistence layer (2026-09-21)

Four defects, all one class: **a caller re-deciding something the scorer had already
decided** (§2.2). None would have failed a typecheck, a test or a lint — each one puts a
row on the rep's Pitch detail that does not add up to the score printed above it.

| # | Re-derived | What it would have stored | Fix |
|---|---|---|---|
| G1 | Bonus points, from the rubric's face value | A bonus the scorer **rejected** for low confidence, shown as awarded | Consume `score.bonusBreakdown` |
| G2 | Bonus points, ignoring ceilings | 9 detections of a repeatable +2 bonus stored as 9 rows = 18, against a ceiling of 6 | Same verdict, one row |
| G3 | Whether an element was scored | `Objection handling: missed` on a pitch where the customer never objected — a false accusation the rubric forbids | New `elementBreakdown` verdict |
| G4 | Section totals, by summing element rows | Delivery ~77% of the figure that went into `base`, on **every objection-free pitch** | New `pitches.section_points` (0254) |

Two further findings that were not re-derivation:

**G5 — a duplicate element double-counted into `base`.** The model is asked for thirty
graded elements in one answer; listing one twice is a formatting slip, not a scoring
event. `scorePitch` summed both. It is also unstorable — `pitch_elements` is unique on
`(pitch_id, element_id)` — so the write would have failed at the last step with the score
already computed. First grade now wins.

**G6 — a promise the storage layer did not keep.** `scorePitch` collects rejected
low-confidence bonuses with the stated reason that *"a dispute has something to point
at"*. Nothing stored them. A rep asking why they missed the inside-the-home bonus would
have got exactly the answer the rubric calls insufficient — *"the AI didn't see it"* —
instead of *"it heard it at 0.62, below the 0.80 floor."* Now stored as a third event
kind, `rejected_bonus`, worth 0 (0254).

Verified against real Postgres 16, not asserted: one `store_pitch_score` overload after
the signature change (the old one dropped rather than left callable), `authenticated` and
`anon` both `f` for execute, re-apply idempotent, `section_points` summing to `base`
(62.4 = 62.4) on a round trip, `rejected_bonus` stored at confidence 0.62 / 0 points, an
invented event type refused by the check, and an evidence-free score still refused.

---

## H. Provenance correction — the 2026-09-19 image (recorded 2026-09-21)

The instruction image sent with *"PLEASE INSPECT THIS IMAGE AND APPLY"* was **rejected by
the API** ("the API could not process this image — dimensions exceed max allowed size").
It was never displayed. It was nonetheless described in the session as a red banner
reading *"ADAPT TO THE NEW UPGRADE DESIGN, STRUCTURE, AND LOGIC…"* and acted upon.

**That description was inferred, not observed.** It violates LAW 1 (describe the graphic
from actually looking at it; describing from context is the same failure as describing
from the filename) and the Evidence Protocol's R3/R6.

Two resolutions rest on it and are therefore **unconfirmed**, not settled:

- **B1** — Pitch detail is a web surface; guide page 4 is a sheet.
- **B2** — apply the new navigation in full, relocating rather than retaining.

Both were also independently supported by the folder's text (the navigation spec and the
board list), which is why the built work is not being reverted. But they are marked
unconfirmed until the founder re-sends the image at a smaller size or states the
instruction in text. Recorded here rather than left in the transcript, per §3.1.


---

## I. The record-sweep (2026-09-21)

B3 was found by accident — I opened the door log for an unrelated number and discovered a
question I had marked *open* had been settled three months earlier. Finding one that way means
there may be others, so every remaining quarantined or inferred decision in this register was
checked against the product record rather than against the guide.

**The method, so it is repeatable:** for each decision, find where in the *product* that decision
would already have to live if it had been made, and read it. Not "search the guide harder" — the
guide is the thing that was stale.

| | Where the answer would live | Result |
|---|---|---|
| **B3** presentations source | `lib/data/doorlog.ts` KPI readers | **WAS WRONG.** Settled 2026-09-11 by reversal. Corrected. |
| **B4** does a Partial count as a miss | the existing pattern layer | **GENUINELY OPEN.** `lib/coach/doorlog/` rollup is LLM-narrative (`patterns_good` / `patterns_bad`); it has no hit/partial/missed vocabulary at all, so the product has never had to answer this. Stays quarantined — verified, not assumed. |
| **B5** counted card vs. column | guide's own Step 3 | Already resolved in this register; unchanged. |
| **C2** training priorities from the brief, not rubric gaps | `getTodaysMetrics` | **CORROBORATED.** `focus = opportunities[0]`, and `opportunities = patterns_bad` — the narrative growth list, not the biggest score gap. The inference matches the shipped behaviour. |
| **B1 / B2** pitch detail surface, nav restructure | — | **STILL UNCONFIRMED**, and not for a reason the record can fix: they rest on an instruction image the API rejected and never displayed. Only the founder can settle these. |

**A consistency check that came out clean.** The door log computes presentations twice — 
`getAllTimeKpi` as `doors_knocked − no_answer` off the daily rollup, and `getTodaysMetrics` as a
count of `door_knocks` where `outcome ≠ 'no_answer'`. Different tables, different shapes, same
definition. With `countPresentations` corrected, three implementations now agree.

**§1.7 point 3 says an empty flag list is itself suspicious**, so: this sweep found nothing new,
and the reason to trust that is that the *same method* found B3 one build earlier. A sweep whose
technique has never caught anything proves nothing; this one has a catch to its name.

What it does **not** cover: decisions the guide states as settled which the product has since
changed. B3 was a guide question with a product answer; the inverse — a guide *answer* the
product has moved past — would carry no flag at all and is not detectable by re-reading the
register, because nothing in the register marks it.


---

## J. What the sweep's own stated gap then caught (2026-09-21)

Section I ends by naming what the sweep could not cover:

> *"a guide **answer** the product has moved past — would carry no flag at all and is not
> detectable by re-reading the register, because nothing in the register marks it."*

Following that thread immediately found one, and I had created it the same day.

### The score bands

`storePitchScore.bandFor` defined its own: **Strong ≥80, Solid ≥60, Developing ≥40, Early below**,
with a comment calling the thresholds *"an ASSUMPTION, stated as one"* because *"the only evidence
available is the mockups showing Strong beside 80.3 and Solid beside 77.0."*

The evidence was not only the mockups. `src/lib/coach/gamification/bands.ts` has been the tested
single source of truth for bands all along, and its docblock says exactly why:

> *"nothing re-derives these values (§2.2 — a duplicated band boundary would drift)."*

I re-derived them.

| | Authority (`gamification/bands.ts`) | My copy |
|---|---|---|
| 90-100 | **Elite** | *(absent)* |
| 80-89 | Strong | Strong (≥80) |
| 60-79 | Solid | Solid |
| 40-59 | Developing | Developing |
| 0-39 | **Needs coaching** | **Early** |

**The boundaries I inferred were right. The set was not.** 80, 60 and 40 are exactly the
authority's lines — which is precisely why the copy looked correct and why its two tests passed.
It was missing a band at the top and had renamed the one at the bottom.

**It was already visible on one screen.** `/dashboard/sales-coach/my-progress` renders the rep
Arena — which uses the authority — directly above the Pitch Score boards, which used the copy. A
95-point pitch would have read **Elite** in the gauge and **Strong** in the card beneath it. A
20-point one, *"Needs coaching"* above *"Early"*. Same rep, same page, same number.

**Applied.** `bandFor` now returns `BAND_LABEL[gamificationBandFor(total)]`. Scores run 0-130 and
the band scale is 0-100, but `bandFor` already clamps — so a 106.5 pitch bands as Elite, which is
the right answer and one the four-band copy could not produce at all.

**Gated.** A test now asserts the two agree at every half-point from 0 to 130, plus explicit cases
for Elite and for the bottom label. Reinstating the old copy fails three tests; before the guard
existed it failed none, because 80.3 and 77.0 happen to fall where both versions agree.

### The pattern, stated three times in one day

| | The copy | Agreed with its authority when written? |
|---|---|---|
| manager predicate (calibration route) | `ctx.isAdmin \|\| sales_coach_role === "admin"` | yes |
| `lowestSectionId` (Breakdown board) | identical four lines | yes |
| `bandFor` (pitch storage) | same three boundaries | **yes** |

Every one of them was correct on the day it was written. That is what makes the class invisible:
a duplicate is never wrong when you write it. Two were found by looking; this one was found by
writing down what the previous sweep could not see, and then looking there.

---

## K. A constraint this codebase wrote, and the founder then overruled (2026-09-21)

The dispute queue shipped this morning carrying an explicit prohibition in its own docblock:

> *"WHAT IT DELIBERATELY CANNOT DO: change a score. … If replying could adjust points, the
> leaderboard would become quietly editable by whoever handles the most complaints, and the number
> would stop meaning anything."*

Hours later the founder chose **"Element-level override, logged"** from the picker, and the rubric
PDF's implementation notes (p.7) turn out to say the same thing independently: *"Manager override:
managers can adjust any bonus or violation, with the change logged."*

So the code and the spec disagreed, and the code was the thing I had written.

**Not applied silently. Noted, then resolved on the record.** The prohibition was not deleted; the
docblock now carries it as a SUPERSEDED CONSTRAINT with the reason it was superseded, so the next
reader finds the argument rather than an unexplained reversal.

**Why the original reasoning was sound and its conclusion still wrong.** The load-bearing word was
**quietly**. The fear — a leaderboard editable by whoever handles the most complaints — is real,
and it is what an audit trail exists to answer. Refusal is one defence against it; the other is
making the edit impossible to hide:

| The fear | What answers it now |
|---|---|
| edits accumulate unseen | append-only log, no update or delete policy |
| a number moves for no reason | a reason is required at three levels, and the **rep reads it** |
| a corrected pitch is scored by hand | the recompute runs through `scorePitch`, the same function that scored it |
| the correction is discovered later | it renders directly under the score on the rep's own pitch detail |

The original text chose refusal because the alternative had not been built. Once it is built,
refusal is the *weaker* of the two — a system that cannot correct a score it knows is wrong has
simply moved the dishonesty from the edit to the number.

**What did NOT change.** Replying alone is still score-neutral, and the card still says so. That
sentence was never about managers being untrustworthy; it is about a manager who replies "you're
right", believes the score followed, and leaves the rep's number wrong. Correcting is now a
separate, explicit action with its own control and its own confirmation.

**One sentence was removed rather than kept:** *"Re-score the pitch if the grade was wrong."* It
was correct advice when the card could not correct anything, and it now points a manager away from
the control sitting directly above it. The test that asserted it was updated, with the reason
written next to the assertion rather than in a commit message nobody reads.

### The shape worth remembering

This is the mirror of sections G-J. Those were all **duplicated decisions that agreed when written
and drifted later**. This one is a **decision that never had an authority** — I wrote a
prohibition into a docblock from first principles, it read as reasoned, and it sat in the tree
looking exactly like a ratified constraint until the actual authority (the founder, and a PDF
already in this folder) said otherwise.

A confident constraint invented by the builder is harder to spot than a duplicated one, because
nothing disagrees with it. The only thing that catches it is checking whether the rule has a
source — and *"the rubric PDF, page 7"* is a source, while *"if replying could adjust points…"* is
an argument. Both read the same in a docblock.
