# INSPECTION.md — Phase 01 for the home-screen build

Codebase inspection answering `01-inspect.md`'s five headings. Every claim is [OBSERVED] from a named file
unless marked [INFERRED]. This phase writes no app code.

---

## 1. Which stack is this app?

[OBSERVED] **Next.js web app, NOT React Native / Expo.** `package.json` has `"next": "^16.2.6"` and **no**
`react-native`, `expo`, `nativewind`, or `react-native-svg`. There is **no** `app.json` / `app.config.*`
anywhere in the tree — no Expo project exists. The "native iOS status bar and tab bar" the spec saw in a
screenshot is this Next.js app running as a **mobile PWA / installed web app**, which is exactly the
alternative `01-inspect.md` Q1 asked to confirm.

Consequences for the spec (all [INFERRED] from the stack fact):
- NativeWind is moot — real Tailwind `zinc-*` / `yellow-400` classes already work here.
- `react-native-svg` is moot — the dials are plain inline SVG.
- `AsyncStorage`, `react-native-pager-view` (06-home-pager) don't apply; the web equivalents do (a CSS
  scroll-snap / transform pager; "do not persist the page index" = React state only, which is trivial on web).
- The data-model, number-logic, target-engine, and verification phases are **stack-independent** and stand.

## 2. What already stores rep activity?

[OBSERVED] The three funnel facts the screen needs **already exist** — in `src/lib/data/doorlog.ts` +
`src/lib/coach/doorlog/outcomes.ts`:
- **`door_knocks`** — one row per knock, with `outcome: KnockOutcome` (`KNOCK_OUTCOMES` = sold, go_back,
  not_interested, no_answer, non_decision_maker). `doors_knocked` = count of knock rows regardless of outcome.
- **`pitches`** — a **"presentation" = a door where the rep RECORDED a pitch** (founder decision 2026-08-28,
  comment in doorlog.ts). Presentations = count of `pitches` rows, NOT a separate counter.
- **`rep_kpi_daily`** — daily rollup per rep with `doors_knocked, sold` columns; "stays the source" for
  doors + sold.
- `getTodaysMetrics()` / `getAllTimeKpi()` already return **`{ doorsKnocked, presentations, sold }`**.

[OBSERVED] **"sold" is a `KnockOutcome`** — a Macro rep marks a door "sold"; `rep_kpi_daily.sold` rolls it up.
So in Macro, a sale is already logged from the door flow, which nuances `08-logging.md`'s assumption that the
sold dial must open a separate deal-creation flow.

→ **This is the single most important finding.** `04-data-model.md` proposes a NEW `activity_events` table;
the codebase already records doors (`door_knocks`), presentations (`pitches`), and sales
(`rep_kpi_daily`/knock outcome). Per 04's own rule ("extend what exists; two rows for the same sale is the
failure mode"), the home screen must **read these**, not create `activity_events`.

## 3. What is on the Home tab right now?

[OBSERVED] The Home tab is `src/app/dashboard/sales-coach/page.tsx` (nav "Home" → `/dashboard/sales-coach`,
`SalesCoachShell.tsx:96`). When **Macro Mode** is on (`macroOn`), the page **focuses the mobile home**, hides
two sidebar cards (Live AI Coach & Sessions, One-Liners — SalesCoachShell.tsx:144-146), and renders the three
door KPIs as **stat bubbles** (page.tsx:306-315): "Doors Knocked", "Presentation", "Sold" — currently the
**all-time** totals (`macroTotals`, "All-time door KPIs for the 3 bubbles", l.104), with `—` on fetch error,
never a false 0.

→ **Duplication flag (the exact case `06-home-pager.md` says to flag and stop on):** the existing home (spec's
page 1) **already shows doors / presentations / sold** — as all-time bubbles. The spec's page 0 shows the same
three metrics as **today's** done/target dials. Same three facts, different window. This is a product decision
for John, not a silent cleanup.

## 4. Is there an existing goal or quota anywhere?

[OBSERVED] Yes — a **monthly, manager-set, company-wide deals-won quota** (`QuotaTargetPanel.tsx` →
`/api/coach/sales-session/quota`): "each rep's Quota Attainment = deals won this month ÷ this target." So
`02-decisions.md` **Q1 option C** (monthly quota ÷ remaining working days) is buildable from data that already
exists. [OBSERVED] There is **no existing daily door target** and **no per-rep dollar goal / commission rate**
in the code I read — those (Q1/Q3) are genuinely new. [not found] a flat/tiered commission rate table.

## 5. Where do the existing tick-dial and stat cards live?

[OBSERVED] **The reusable "tick-mark done/target dial" the spec assumes does not exist as described.** A grep
for a multi-tick dial in `src/components/sales-coach` found none. What exists:
- `EloMeter.tsx` — an **arc gauge** for the ELO scale [100, 3000] with a single reference tick at 1500
  (strokeDasharray arc + gradient + glow). Not a lit/unlit tick-mark ring.
- `PivotAndScores.tsx` — score **rings**.
- The Macro home's three metrics render as plain **stat bubbles** (label + value), not dials.

→ **Reuse flag:** `01-inspect.md` Q5 and `07-door-screen.md` say "reuse the existing tick-mark dial, do not
write a second dial." That component isn't there. A done/target dial would be **new** (or built from
EloMeter's arc primitives). This should be confirmed with John before Phase 07, since the spec's reuse
instruction can't be followed literally. Outlined stat cards do exist (the bubbles + shared `DeckCard`).

---

## Not opened
- none of the 10 spec files were skipped (see EVIDENCE.md). This codebase inspection is **targeted**, not a
  full-repo read: the files observed are `package.json`, `src/lib/data/doorlog.ts`,
  `src/lib/coach/doorlog/outcomes.ts`, `src/components/sales-coach/SalesCoachShell.tsx`,
  `src/app/dashboard/sales-coach/page.tsx`, `src/components/sales-coach/EloMeter.tsx`,
  `src/components/sales-coach/QuotaTargetPanel.tsx`. Anything not in that list is [not inspected], not [absent].

## Decisions
John's answers to `02-decisions.md`, quoted as given:

- **Q1 — door target works back from:** **A daily SALES goal** (e.g. "2 today"). [OBSERVED — John, 2026-09-10]
  The door target = `sales_goal ÷ close_ratio ÷ contact_ratio`, rounded up.
- **Q1 follow-up — who sets the daily goal:** **The manager sets it per rep.** [OBSERVED — John, 2026-09-10]
  → NEW: a per-rep daily-sales-goal store + a manager UI to set it (none exists today).
- **Q2 — targets on all three dials?:** **All three have targets** (done/target dials). [OBSERVED — John,
  2026-09-10] presentations target = `goal ÷ close_ratio`; sold target = the goal itself.
- **Q3 — "dollars earned today":** **Dropped. That field shows NUMBER OF SALES, not cash.** [OBSERVED — John,
  2026-09-10] No commission/rate model is built (none exists — matches the inspection). Exact framing of the
  field being resolved (it must not merely duplicate the Sold dial).
  → **Resolved:** the field shows **"sales to goal"** = `max(0, sold_goal − sold_today)` ("goal met" at 0), a
  count of sales remaining, not a copy of the Sold dial. [OBSERVED — John, 2026-09-10] This removes the entire
  commission/dollar model (Q3/Q6/Q7 money lines) from the build.
- **Q4 — new-rep fallback:** **A fixed starter target until they qualify**, then switch to their real ratio.
  [OBSERVED — John, 2026-09-10] Needs: the starter number + the "enough data" threshold.
- **Q4 — ratio window:** **Last 30 days** for both close ratio and contact ratio. [OBSERVED — John, 2026-09-10]
  Simple date filter on existing `door_knocks` / `pitches`.
- **Q5 — undo a tap:** **Long-press a dial to decrement** (tap +1, long-press −1; no editable log).
  [OBSERVED — John, 2026-09-10] Supersedes 00-READ-FIRST's "editing/deleting a tap is out of scope" note —
  update that. A 'sold' decrement must also unwind that door's sale outcome.
- **Q6 — what counts as a restart:** **Cold load OR first open of the day** (track last-active; snap to page 0
  on reload and on the first open each day / after a long background gap). [OBSERVED — John, 2026-09-10]
- **Q7 — page hint:** **Two page dots** under the content. [OBSERVED — John, 2026-09-10]
- **Q8 — Home tab on page 1:** **Snap back to page 0** (the door screen). [OBSERVED — John, 2026-09-10]
- **Ratios:** **Two ratios** — close (sales÷presentations) and contact (presentations÷doors), 30-day.
  [OBSERVED — John, 2026-09-10] `doors = goal ÷ close ÷ contact`, round up at each step.
- **Greeting:** **Keep it simple** — "Good <morning/afternoon/evening>, <rep name>", no engine beyond the clock.
  [OBSERVED — John, 2026-09-10]

### Builder defaults for the small sub-choices (the spec lets the builder pick + document these — John to veto)
- [ASSUMED] **Starter door target** (new rep, pre-qualification): **80** (the mockup's number). Presentations/sold
  starter targets derive once a goal is set.
- [ASSUMED] **"Enough data" threshold** to switch off the starter → the rep's real ratio: **≥ 10 presentations
  AND ≥ 1 sale in the 30-day window** (one sale is not a ratio, per Q4).
- [ASSUMED] **Door-number floor/ceiling:** floor **20**, ceiling **200** (a target of 4 or 900 is useless).
- [ASSUMED] **Overshoot:** the ring clamps full at 100% (95 of 80 shows a full ring + "95 of 80"); no second lap.
- [ASSUMED] **Target freeze:** computed once at the first open of the rep's day and stored; not recomputed on
  every load (per 03-number-logic — a target that drops as you sell rewards stopping).

### Open product fork the spec says to STOP on (06-home-pager)
- **Page-0 / page-1 duplication.** Page 1 (the existing Macro home) already shows doors / presentations / sold
  as **all-time bubbles**; page 0 now shows the same three as **today's** done/target dials. Same three facts,
  two windows, two pages. 06 says report and stop — this is John's call.
  → **Resolved:** **Remove the 3 all-time bubbles from page 1** (the existing home keeps its other content).
  Page 0 is the single home for the funnel numbers. [OBSERVED — John, 2026-09-10] Note: this DOES edit page 1,
  overriding 06's "do not touch page 1" — an intentional, John-approved exception.

---

## Status: Phase 02 STOP cleared — all decisions in. Build (Phases 03–09) is unblocked.
