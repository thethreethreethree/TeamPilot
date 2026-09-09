# EVIDENCE.md — inspection of `docs/2ND MAIN PANEL DASKBOARD/`

Scope: the folder `docs/2ND MAIN PANEL DASKBOARD/` → one subfolder `home-screen-build/` → 10 markdown
files (00–09). No images, no raw/summary pairs (all `.md`). Every file opened in full, line by line.
Phase 0 per the Evidence Protocol (R1/R7): reading is gated; no code follows until approved.

| # | Path | Bytes | Opened | Proof — a fact from inside (not guessable from the name) |
|---|------|-------|--------|-----------------------------------------------------------|
| 00 | home-screen-build/00-READ-FIRST.md | 3360 | YES | [OBSERVED] Design-system table gives `yellow-400 = #FACC15`, `zinc-800 = #27272A`. The "Afternoon, Marcus" greeting is declared an **invented placeholder** "It has no basis in the sketch" (line 48). Out-of-scope list = 9 items incl. "Remembering which page the rep was last on". |
| 01 | home-screen-build/01-inspect.md | 2234 | YES | [OBSERVED] Heading 5 orders **reuse** of the Progress screen's tick-dial — "Do not write a second dial component" (l.53). Output = `INSPECTION.md` at repo root; unfindable items must be written "not found", not guessed (l.58-59). |
| 02 | home-screen-build/02-decisions.md | 4441 | YES | [OBSERVED] Title = "**Eight questions**" (l.3), Q1–Q8. Q1 option B worked example: "$400 today → 2.2 sales → 88 doors" (l.21). Q6 = "what counts as a restart" (cold launch vs background threshold). |
| 03 | home-screen-build/03-number-logic.md | 5112 | YES | [OBSERVED] Worked example yields `doors_needed = 79.2 → 80` (l.61). Introduces a **second ratio** `contact_ratio = 1/4.4` NOT named in the sketch (l.66-73). "To goal" shows zero as the words "goal met", never `$0` (l.136-138). |
| 04 | home-screen-build/04-data-model.md | 2497 | YES | [OBSERVED] Proposes `activity_events(id, rep_id, kind 'door'\|'presentation', occurred_at, local_date)` (l.32-38); **sales stay in the deals table**, not this log. "Store `local_date` explicitly" written once at insert (l.44-46). |
| 05 | home-screen-build/05-target-engine.md | 1999 | YES | [OBSERVED] `calculateDayTarget(input)→output` must have **no database calls inside** (l.16). "Zero sales is the one to get right" — `sales÷presentations = 0` makes `sales_needed ÷ 0` infinite (l.43-45). Floor/ceiling on the door number = a product decision to write down, not bury (l.47-49). |
| 06 | home-screen-build/06-home-pager.md | 2778 | YES | [OBSERVED] "**Do not persist the page index. No AsyncStorage, no database column**" — the reset-on-launch IS the absence of persistence (l.19-26). The single most-likely bug named: a horizontal drag starting on a dial must swipe, not tap (l.50-52). |
| 07 | home-screen-build/07-door-screen.md | 2896 | YES | [OBSERVED] Down-screen order (l.14-20): header → target card → 3 dials → earned → page dots → nothing. Tab bar's 4 items named: **Home, Pitch Performance, Today's Metrics, Role Play** (l.11). Ring ≈ 110pt at three-across; check "120 of 80" still reads (l.42-44). Four required states incl. "Goal met" (l.60-67). |
| 08 | home-screen-build/08-logging.md | 1526 | YES | [OBSERVED] Sold dial "almost certainly cannot be a bare tap" → opens the **existing deal flow**, "Do not write a second way to create a sale" (l.5-11). "No offline queue" (l.23). ⚠️ Its H1 reads "**Phase 07 — Logging a tap**" (mislabeled; see flags). |
| 09 | home-screen-build/09-verification.md | 2633 | YES | [OBSERVED] Day-boundary test seeds events at **11:50pm and 12:10am** in the rep's timezone, then repeats with tz ≠ server (l.17-20). Ends by requiring a single list of "**every decision made without John**" (l.64). ⚠️ Its H1 reads "**Phase 08 — Verification**" (mislabeled; see flags). |

## Flags — mismatches found inside (R3: the mismatch is often the most valuable finding)

- **F1 — Phase numbers in the file H1s drift off-by-one from file 08 onward.** `08-logging.md`'s heading is
  "Phase 07"; `09-verification.md`'s heading is "Phase 08". Filenames and the 00-READ-FIRST index are
  correct; the in-file titles are not. [OBSERVED]
- **F2 — The count of open decisions is inconsistent across the spec.** `00-READ-FIRST.md` calls Phase 02
  "**four decisions**" (l.12) in prose and "**Five open questions**" (l.19) in its index table — inconsistent
  even with itself — while `04-data-model.md` waits on "the **five answers**" (l.4). But `02-decisions.md`
  actually contains **eight** (Q1–Q8, its own title says "Eight questions"). The spec was expanded 5→8 and the
  cross-references were not updated. [OBSERVED]
- **F3 — The spec depends on a codebase this pack has not seen.** `01-inspect.md` l.6: "I have not seen this
  codebase." Phases 04–08 are explicitly *blocked* on Phase 01's findings AND on John's Phase-02 answers.
  [OBSERVED]

## What this spec is (one paragraph)
A phased build plan (not code) for a **rep home screen**: three funnel dials (doors → presentations → sold),
each `done / target`, with an **AI-calculated** door target worked back from a goal through a close ratio and
a contact ratio, plus a "dollars earned today" box — wrapped as **page 0** of a two-page horizontal pager whose
page 1 is the existing home screen, resetting to page 0 on every launch by *not persisting* the index. Design
tokens are Tailwind zinc + `yellow-400`. It is written for a React Native / Expo app and repeatedly says
**reuse** existing components (the Progress dial, the deal-creation flow, the sessions/deals tables) rather than
duplicate them.

## Not opened
- none — all 10 files in `docs/2ND MAIN PANEL DASKBOARD/home-screen-build/` were opened in full.

## Gate (R7)
This is Phase 0. `02-decisions.md` is itself a hard STOP: **eight decisions only John can make** (Q1–Q8), and
Phases 04–08 cannot be specified until those answers plus the Phase-01 codebase inspection exist. No migration,
component, or code is written until that is done and approved.
