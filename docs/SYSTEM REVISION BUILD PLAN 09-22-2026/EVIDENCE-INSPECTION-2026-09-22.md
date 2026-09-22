# EVIDENCE — independent inspection of every file in this folder

**Read 2026-09-22, first-hand.** The owner asked for proof that every item here was opened and its
*contents* examined, "not just name it by the folder title". This is that record.

**Written beside `EVIDENCE.md` rather than over it.** That file is a prior session's Phase 0 record
and is itself evidence; overwriting it would destroy a source in the act of documenting one. Where
this inspection disagrees with it, the disagreement is listed rather than silently corrected.

**R2 governs this document's own method.** `EVIDENCE.md` and `source-files/EVIDENCE.md` both assert
that all fourteen sources were opened. A summary never discharges its source, so every PDF was
re-opened and every page rendered here, independently — and that is what produced the six
discrepancies in the last section, four of which are against those two manifests.

**Inventory swept, not recalled:** `find . -type f` → **16 files**, 15.1 MB, 2 at the root and 14 in
`source-files/`. **24 PDF pages**, not 23 (see D6).

---

## Root (2 files)

| File · bytes | Opened | A fact from inside |
|---|---|---|
| `EVIDENCE.md` · 10,666 | yes, in full | Its "Three records checked against the target repo" table contains a self-correction: the grep it first cited for "the app calls no Pitch Score endpoint" was `grep -rn "pitch-score\|pitchScore" src/`, which returns **one** hit — `after-pitch-card.tsx:45` importing `@/lib/after-pitch-scores`, a substring collision — and it records the corrected command rather than leaving the bad one to be re-run. |
| `MOBILE-BUILD-PLAN.md` · 19,254 | yes, in full | §11 item 3 states its own weakest link: *"Two of four badge definitions I would have guessed were wrong… a two-in-four miss rate is the best available evidence that the two unchecked ones are also wrong."* Its §8 orders **Breakdown before Progress**, against the drawn order, because Breakdown carries the reconciling identity and "the gauge is the last place you would notice" a failure. |

## `source-files/` — text (4 files)

| File · bytes | Opened | A fact from inside |
|---|---|---|
| `WHATSAPP.txt` · 143 | yes, whole file | Verbatim, and the whole of it: *"Pages 1-2 will one on the app. Page 3 will be on the web version. Page 4 will be the "score rubric" button that is on page 1 and 2 (on the app)"*. Note the typo "will one on the app" — this is the entire basis for mobile scope. |
| `TWO-SCORING-SYSTEMS.md` · 5,132 | yes, in full | Its rank row records that `competitionRanks` is **standard** competition ranking — "1-2-2-**4**, not dense 1-2-2-3" — and warns that a hand-rolled second ranker "would differ on ties before it differed anywhere else". |
| `LOGIC-AND-CONTRADICTIONS.md` · 39,944 · 717 lines | yes, in full, in three reads | §J records that `bandFor` was re-derived with boundaries 80/60/40 that were **correct**, but the *set* was wrong — missing **Elite** at the top and renaming "Needs coaching" to "Early" — so a 95 read Elite in the Arena and Strong in the card directly beneath it on `/dashboard/sales-coach/my-progress`. |
| `source-files/EVIDENCE.md` · 13,517 | yes, in full | It records that the 11 source files were **byte-identical** to the 2026-09-21 read — "same mtimes (11:14–11:17), same md5s" — so the folder rename was "a change of *authority*, not of material". |

## `source-files/` — PDFs (8 files, 24 pages, every page rendered)

| File · bytes · pages | A fact from inside |
|---|---|---|
| `EloState Coaching Build Plan  Engineering Guide.pdf` · 268,288 · **8 pp** | Page 1 is bylined **"2026-09-19 · @Someone"**. Page 5 item 2 gives the player speeds as **"1x, 1.25x, 1.5x, 2x"**. Page 7's rep-list statuses are **Needs 1:1** (any stalled pattern), **Follow up** (coached but not reviewed, or open 5+ days without coaching), **New rep**, **On track** — and its launch checklist is **13 checkboxes**. Page 8's fourth open decision sets the audio-inferred bonus threshold at **80% confidence**. |
| `EloState AT&T Fiber Pitch Scoring Rubric.pdf` · 227,106 · **7 pp** | Page 6's scoring formula **failed to render and prints as raw LaTeX**: `\text{Pitch Score} = \text{Base} + \min(\text{Bonus}, 30) - \text{Violations}`. Page 1 says the score "is the competition currency and **feeds Vault**" — Vault is named nowhere else in this folder. Page 4 carries an explicit anti-double-count rule: *"The app's existing Questions and Closing skill scores are covered by Discovery and Close and must not be counted a second time."* Page 1 also lists the Violations range as **"Negative, uncapped"**, while page 6 caps two of the five individually. |
| `EloState Rep Pitch Dashboard.pdf` · 3,483,269 · **4 pp** | p1's bottom tab bar highlights **Today's Metrics**, not Pitch Performance (see D1). p1's header row carries a **"Scoreboard" link** beside "#2 on your team this week" (D2). p2's bonus table has **9 rows** summing to exactly the +14.6 printed: 2.8+2.2+2.0+1.9+1.9+1.4+1.0+0.8+0.6 (D3). p3's Close detail sums 3+3+3+1.5+3 = **13.5**, matching its header, and its Options close is PARTIAL for *"Asked 'does that work?' before AM/PM"*. p4 shows only **Close** expanded; the other five sections are collapsed with a `+`. |
| `Coach Assessment  manager dashboard (web).pdf` · 3,035,030 · 1 p | Dated **"Saturday, September 19, 2026"**. Its Team activity strip prints the caption *"Doors come from rep logs; **presentations are recorded pitches**"* — the definition the founder reversed on 2026-09-11 (D4). Rep rows sum independently to **5,773** points, **671** doors, **98** presentations, **20** sold; Humza's six sections sum to **62.0**, and 62.0 + 11.5 − 4.2 = **69.3** ✓. |
| `Coach Assessment  Recordings tab open (web).pdf` · 3,180,115 · 1 p | **Six** recording rows are visible, not the three the manifests list: Sep 19 3:52 PM 78.5 · Sep 19 11:20 AM **44.0 "Not counted"** · Sep 18 4:40 PM 61.5 · Sep 17 5:05 PM 68.0 · Sep 16 6:12 PM 74.5 · Sep 16 2:30 PM 70.5. The player header reads "58.5 base +5.0 −2.0 = **61.5**", and the two positive key moments (+3 at 2:30, +2 at 6:15) sum to exactly that +5.0. |
| `Pattern Interrupt  rep (web).pdf` · 1,572,847 · 1 p | The rep's TEAM TOOLS group has **four** items — Team Chat, Scoreboard, Browser extension, Settings — and **no KPI Analytics**, which the manager's nav does carry. The banner states the detection rule on the rep's own page: *"A pattern appears when the same miss shows up in 3 or more of a rep's last 10 pitches."* Its three cards read 5 of 7, 4 of 7, 3 of 7 — seven dots, not ten. |
| `Pattern Interrupt  manager Patterns (web).pdf` · 1,832,671 · 1 p | Rep chips read Humza Khan 3 · Anthony A. 3 · James Soto 3 · Knute Knudtson 2 · John Knudtson 1 — summing to **12**, exactly the ACTIVE PATTERNS card. The manager nav contains **no Training, Roleplay, Team, One Liners or Sessions** anywhere. |
| `Pattern Interrupt  manager Rep progress (web).pdf` · 1,649,160 · 1 p | The rep list's "open" counts total **10** (2+2+2+3+1) while the OPEN PATTERNS card reads **12** — and 12 is what you get counting Improving as open (3+2+3+3+1). That is §C8 proved by arithmetic rather than asserted. FIXED THIS MONTH **6** = 1+1+2+0+2 ✓. Anthony's table prints the status rules working: `3/5 → 3/5 →` with 0 of 5 = **Stalled**; `4/5 → 1/5 ▼` with 2 of 5 = **Improving**. |

## `source-files/` — images (2 files, one line each, opened one at a time — R3 / LAW 1a)

| File · bytes | What is actually in it |
|---|---|
| `WhatsApp Image 2026-09-20 at 04.50.33.jpeg` · 382,356 · **rendered** | Four dark phone boards on a light-grey canvas, each titled above-left with an outlined **▷ PLAY** button above-right; titles read "Progress", "Breakdo…", "Pitch det…", "Scoring r…" — three truncated. Board 1 shows WEEK 38 SHOWDOWN, the 80.3 Strong gauge, chips 68.9 / +14.6 / −3.2 and digit tiles **1 4 4 5**; board 4's violations block is red-tinted. **Near-duplicate: yes** — a lower-resolution overview of the same four boards as `EloState Rep Pitch Dashboard.pdf`. **Mismatch against its own PDF:** board 3's violation timestamp reads **▶ 6:12**; PDF p3 reads **▶ 5:12** (D5). Board 1's bottom bar highlights **Today's Metrics**, corroborating D1 in a second rendition. |
| `WhatsApp Image 2026-09-20 at 05.45.13.jpeg` · 234,820 · **rendered** | A light-theme screenshot of the **live** Training page, not a mockup: dark left rail (Home, Meeting Coach; MANAGER DASHBOARD → Coach Assessment, Score Calibration; TEAM TOOLS → **Roleplay, Training** (active), **Team**; then Team Chat, KPI Analytics, Scoreboard, My Progress, Browser extension, Settings). Body: "Ready — generated **Sep 18 at 11:00 PM**", WORK ON AS A TEAM ×3, RUN THIS DRILL "Bill Anchor to Called-Shot Speed Test" in five steps, ONE FOCUS EACH for four named reps, "Team practice — No one has practiced yet". **Near-duplicate: no** — the only live-product screenshot in the folder. Produces D6. |

---

## What this inspection found that the existing records do not say

Six items. Four are corrections to `EVIDENCE.md` / `MOBILE-BUILD-PLAN.md`; two are new.

**D1 — the boards are drawn under *Today's Metrics*, not Pitch Performance. [OBSERVED, twice]**
`MOBILE-BUILD-PLAN.md` §5.1 and §5.2 both place Progress and Breakdown "inside Pitch Performance".
On `EloState Rep Pitch Dashboard.pdf` **p1 the highlighted bottom tab is Today's Metrics** — amber
bar-chart icon, amber label — and the canvas JPEG shows the same. The phone already has
`(tabs)/metrics.tsx` as a two-page pager, which makes this placement coherent rather than a drawing
slip, and it also dissolves DECISION 2: a "Metrics" segment inside the Today's Metrics tab is not a
duplicate name, it is the tab's own third page. **This changes where the build puts two screens.**

**D2 — p1 links out to Scoreboard, and §4 forbids what that link leads to.**
The header row reads "#2 on your team this week" with an amber **Scoreboard** link. No manifest
records the link. It matters because the rep-visibility ruling strips rank *at the route* — but the
drawn board offers a one-tap route to the gamification Scoreboard, where a rep's cross-agent
position is exactly what is shown. The ruling and the drawing collide on this control specifically.

**D3 — the bonus table has 9 rows, not 10.** `MOBILE-BUILD-PLAN.md` §5.2 item 6 says "10 rows".
Counted on p2: DIRECTV, Customer laughs, Icebreaker, Inside house or backyard, Buying questions,
Pitches Wireless, Hard follow-up set, All other bonuses, Pitches ADT = **9**, and they sum to the
+14.6 the header prints. Ten rows would not reconcile.

**D4 — the manager board prints a superseded definition on its face.**
*"presentations are recorded pitches"* is the caption on the Team activity strip. §B3 records the
founder reversing exactly that on 2026-09-11, after it produced a **333% close rate**. The mockup is
dated 2026-09-19, four days *after* the reversal shipped. Under the governing rule this is a
contradiction to note, not apply — and it is not in either manifest's contradiction list.

**D5 — the canvas JPEG and its PDF disagree on a timestamp.** JPEG board 3 reads **6:12**; PDF p3
reads **5:12**. `source-files/EVIDENCE.md` claims this correction; this inspection confirms both
sides first-hand rather than repeating the claim.

**D6 — two counting errors in the existing records.** The folder holds **24** PDF pages
(8+7+4+1+1+1+1+1), not the 23 `source-files/EVIDENCE.md` states. And both manifests say the live
Training page carries the manager mockup's three priorities *"verbatim and in the same order"* —
same three and same order, and the same "Sep 18 at 11:00 PM" timestamp, but the **third is not
verbatim**: the mockup reads *"Anchor price to their bill, then prove it"*, the live page reads
*"Anchor price to his actual bill, then make the problem undeniable."* The §C2 argument survives
intact; the word "verbatim" does not.

---

## Two claims checked beyond the folder, because I had specific reason to doubt one

**§B3's "Applied" — checked, and it is true. [OBSERVED]** The register states that
`countPresentations` now defaults to `doors_spoken_to`. I doubted it for a concrete reason: on
2026-09-11 that change was left staged when a commit hook rejected it. It did land.
`src/lib/coach/doorlog/dayTargetData.ts:119` reads
`db.from("door_knocks")…neq("outcome", "no_answer")`, its header says "All three figures now come
from door_knocks.local_date", and `countPresentations` exists at
`src/lib/coach/pitchScore/aggregate.ts:335` documented as *"doors_knocked − no_answer… and not
recorded pitches"*. Recorded because a doubt that survives checking is worth as much as one that
does not.

**D7 — the web repo has moved, and three documents still cite the old path. [OBSERVED]**
`source-files/EVIDENCE.md` verifies these files against
`TeamPilot/docs/SYSTEM UPDATES AND REVISION 09-22-2026`, and `MOBILE-BUILD-PLAN.md` §11 item 4 sends
the reader to the web repo for `SalesCoach-KPI-System.md` — the authority the §4 rep-visibility
ruling turns on. That repo is **no longer at
`C:\Users\johns\OneDrive\Documents\GitHub\TeamPilot`**; it is now at
`C:\Users\johns\Documents\GitHub\TeamPilot` (HEAD `dfe8204d`, "The one verdict a machine should not
make alone"). Nothing in the folder is wrong about the *content*; every path to it is stale.

---

## Not opened

- **The "EloState Rep Pitch Dashboard canvas" interactive mockups** — a link on guide page 1 ("Hit
  Play on any board to click through it"), not a file. The four ▷ PLAY buttons in the canvas JPEG
  are its entry points. **Never visited**, and it is the only source that could settle what the
  three truncated board titles say in full.
- **"Pitch Score System — Engineering Implementation Guide"** — named on guide page 2 as holding the
  full scoring detail for Project 1. Not in this folder. **Never read.**
- **`SalesCoach-KPI-System.md`** — the authority the rep-visibility ruling turns on. Lives in the web
  repo, not here. **Not read during this inspection.**
- **Nothing was rendered or run.** No mobile screen, no web page, no simulator, no browser. Every
  claim above about the *folder* is from opening the file; every claim about the *app* is from
  reading its source. None is from watching software behave.
- **The repo claims in the two manifests were not re-verified** — the tab-bar match, the
  zero-Pitch-Score-endpoint grep, and the presence of the gamification milestone modules. Those are
  checks against `src/`, outside this folder, and this inspection was scoped to the folder.
