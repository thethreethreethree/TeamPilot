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

---

# EVIDENCE — "General Sales Interface for Elostate.pdf" (founder, 2026-11-24)

Phase 0 per the Evidence Protocol. Source: `/Users/elostate/Downloads/General Sales Interface for Elostate.pdf`, 1,286,648
bytes, 3 pages. Opened 2026-11-24 by rendering every page to an image (PDFKit, scratchpad/gsi/page1-3.png) and reading
each, plus the page text. This is the same document `docs/rss/MACRO-MODE-SPEC.md` names as its source (l.3, "3 pages,
shared by the founder 2026-11-22").

| Page | Opened | Proof — a fact from inside |
|---|---|---|
| 1 | YES (image + text) | [OBSERVED] A Gong call-page screenshot titled "RealityCorp Demo", "Jul 8, 2024 · 42m · Listened · Credax", tabs Highlights/Outline/Transcript/Call Info/Points of interest/Slides, player at "00:00 / 42:01" with three speaker lanes (Alex Castillo, Lorna Rice, Laurel Harmon). Text: "3 tabs — Highlights, Coaching, Next Meeting … Too many"; Highlights (cyan) = Call Brief, Key Points, Next Steps, then "generate follow up email/text/API integration (SalesForce/whatever platform the company uses)"; Coaching (green) = "scorechart 0-100, what they did well, what they need to improve upon. Harvard research on psychological effect on the wordings … (This is a way for us to boast about our system)". |
| 2 | YES (image + text) | [OBSERVED] Next Meeting (yellow) = "set the agenda, key points … Custom checklist upon finishing the call (must be reviewed) … integrated with calendar for reminders". "That's it. Nothing else. Super Simple." CRM: a Gong pipeline screenshot (cards "Open $5.58M (87)", "Commit $1.983M (13)", "Most Likely $683.5K (11)", "Best Case $1.31M (27)", "Closed Won $2.19M (36)"; rows BitForge, Sourcemax, WulfExtract, Indis, Exempla, ApexMind, Fundex, Exellix with Score/Warnings/Contacts/Activity/Next Call; overlay "pipeline inspection."). Top tabs wanted: "Open $figure, Closed Won, Closed Lost". |
| 3 | YES (image + text) | [OBSERVED] Per prospect: "To do (ex: send a follow up email), stage, next call date, last call date, potential/deal amount"; "oh I have to send Betty a follow up email on next steps". Video link "Using Gong Engage to Manage My Pipeline // How Gong Uses Gong". Manager flow: "Nothing will change here, except … see sales rep's pipeline/sales presentation". Braindump: "Hello Moses, what is our to do list for the day … 2 biggest needle mover … Open format summary of yesterday's performance." |

## Against the code (2026-11-24)

- Built (Macro Mode, 0303): the three call tabs (MacroCallView.tsx:41-44), follow-up email/text drafts, score +
  did-well + improve, agenda + checklist that must be reviewed + .ics reminders, pipeline tabs Open/Closed Won/Closed
  Lost with to-do, stage, next call, last call, amount, the manager's "Whose pipeline", and Today's brain dump with two
  needle movers and yesterday's numbers.
- Not built: "API integration (Salesforce/whatever platform)" — MacroCallView.tsx:293 says "Sending to Salesforce or
  HubSpot comes later; for now, copy it." [OBSERVED]
- Not shown: the Harvard-research basis of the coaching wording (MACRO-MODE-SPEC.md:25 records it; no screen cites it;
  no source is in the tree). [OBSERVED]
- At odds with "KEEP IT SIMPLE / nothing else": Macro Mode reduces a rep's TABS to Today, Pipeline, Calls
  (RemoteSalesShell.tsx:34-38), but features added 2026-11-23 live inside those screens and are not hidden in Macro
  Mode — on Pipeline: List/Calendar/Sources/Forecast views, the Ask box, risk and sentiment lines, stage practice, lead
  source, expected close; on Today: "Your coaching this week". [OBSERVED in code; whether each shows in Macro Mode is
  INFERRED from the absence of a macro check in RemotePipeline.tsx and RemoteToday.tsx]

Not opened: the video link on page 3 (a YouTube page; not fetched).

## Re-read 2026-11-25 — General Sales Interface PDF (founder: "the macro system did not follow the PDF")

- /Users/elostate/Downloads/General Sales Interface for Elostate.pdf · 1,286,648 bytes · 3 pages · opened as text (PDFKit) AND each page rendered to PNG and viewed.
- p1 image: Gong call page — "Ask anything about this call" box, tabs Highlights/Outline/Transcript/Call Info/Points of interest/Slides on the LEFT with "Call brief" + "Key points"; video tile, player (1.5x, 15s back/forward) and per-speaker talk lanes (Alex Castillo, Lorna Rice, Laurel Harmon) on the RIGHT. Text: "3 tabs … Highlights, Coaching, Next Meeting … Too many." Cyan highlight: Call Brief, Key Points, Next Steps, "then at the bottom generate follow up email/text/API integration". Green: "scorechart 0-100, what they did well … need to improve … Harvard research".
- p2: yellow highlight "set the agenda, key points … Custom checklist upon finishing the call (must be reviewed) … integrated with calendar"; "That's it. Nothing else. Super Simple."; image: Gong pipeline — top tiles "Open $5.58M (87)", Commit, Most Likely, Best Case, "Closed Won $2.19M (36)", Closed Lost; a TABLE with columns Name · Score · Warnings · Contacts · Activity · Next Call. Green: "top tabs —- Open $figure, Closed Won, Closed Lost".
- p3: cyan "tabs for each prospect —- To do, stage, next call date, last call date, potential/deal amount"; Manager flow "Nothing will change here, except … a section where managers can see sales rep's pipeline/sales presentation"; brain dump "when they first open the software … Hello Moses … 2 biggest needle mover … Open format summary of yesterday's performance."

Compared with the code [OBSERVED]:
1. Managers/admins in Macro Mode keep all 10 tabs + Today, the full pipeline and full Today (RemoteSalesShell.tsx:45, RemotePipeline.tsx:77, RemoteToday.tsx:40) — the PDF's simple screens only reach reps.
2. Macro call page (SessionDetailView.tsx:481) is one phone-width column: stage chips, consent status, a player with Download transcript/audio, Save clip, Trim and talk lanes, THEN the three tabs — not "3 tabs, nothing else", not the picture's tabs-left / player-right.
3. Opening Remote Sales lands on Calls (stats, start a call, list), not the brain dump "when they first open the software".
4. Pipeline prospects are stacked cards; the PDF's picture is a table with one column per field.
Present and matching: the three tabs and their sections in order; Send to CRM; scorechart 0–100 + did well / improve + cited research; agenda / bring up again / reviewed checklist with Add to calendar; Open $ / Closed Won / Closed Lost tiles; To do / stage / next / last call / amount per prospect; brain dump, needle movers, yesterday.

Not opened: the linked video "Using Gong Engage to Manage My Pipeline" (a YouTube link in the PDF).
