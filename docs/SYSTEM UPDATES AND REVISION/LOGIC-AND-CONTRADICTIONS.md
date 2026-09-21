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

### B3. Presentations: recorded pitches, or a separate log?

The guide's own **Open decision #1**, and it is load-bearing: presentations feed the team
activity row, door→presentation %, and close rate. The mockups assume recorded pitches, and
the guide says *confirm with John before building*.

**Not applied.** `presentations` is computed behind one named function with the assumption
stated at its definition, so switching the source later touches one place. Until confirmed,
the mockup's assumption is used **as a default with the flag visible**, never as a fact.

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
