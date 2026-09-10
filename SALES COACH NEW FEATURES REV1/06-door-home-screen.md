# 06 — Door home screen (the door tracker)

**What it is.** A new rep home screen for door-to-door: **three done/target dials** — doors knocked →
presentations → sold — each `count / target`, with an **AI-calculated door target**, plus an **"Earned today $"
cash box**. It's **page 0 of a swipeable two-page pager**; swipe left reaches the existing home screen (page 1).
The app opens on page 0 each launch.

This mirrors the founder's **"Door Tracker Screen" mockup** exactly, and the shipped web build
(commit `0433058b`, 2026-09-10). Build the app to match the web build described below.

## Decisions (LOCKED — do not re-open; web `INSPECTION.md` + founder calls 2026-09-10)
- **Door target works back from a manager-set DAILY SALES GOAL** (per rep). `doors = goal ÷ close_ratio ÷
  contact_ratio`, round UP each step.
- **All three dials have targets.** presentations target = `goal ÷ close_ratio`; sold target = the goal.
- **Two ratios, 30-day window:** close = sales÷presentations, contact = presentations÷doors.
- **New/thin-history rep → a fixed STARTER target** (starter ratios 1/9 and 1/4.4 → goal 2 gives 18 / 80), until
  "qualified" = **≥10 presentations AND ≥1 sale** in the window. Door number clamped **[20, 200]**.
- **CASH BOX (updated 2026-09-10 — reverses the earlier "no cash").** The bottom box matches the mockup:
  **"Earned today $__"** (big), with **"$__ per sale"** and **"$__ to goal"** on the right ("goal met" at zero).
  - "Earned today" = `sold_today × $-per-sale`; "to goal" = `max(0, sold_target − sold_today) × $-per-sale`.
  - **$-per-sale is a manager-set value per rep** (see migration 0248). **It is OPTIONAL**: when it isn't set,
    the box **degrades to the plain "N more sales to goal" line** — never a fabricated `$0`.
- **Logging: tap a dial → OPEN the existing quick-log** (pick the knock outcome / record the pitch), NOT a bare
  +1 — a `door_knock` requires an outcome and a "presentation" is a recorded pitch. The dials show the rep's
  **REAL logged counts** and refresh after logging.
- **No long-press decrement, no "Reset the day" button.** (Both were in the prototype but are dropped: real
  counts are immutable logged events — you can't fake-+1 or wipe them. Undo lives in the DoorLog flow.)
- **Reset to page 0** on cold load OR first open (a fresh screen mount) — the page index is NOT persisted; the
  Home tab also snaps back to page 0.
- **Two page dots** + a "Swipe left for your home screen" hint under them.
- **Greeting matches the mockup:** a date eyebrow (e.g. "Tuesday, 9 September") above **"Afternoon, <first
  name>"** (part-of-day only, no "Good").
- **Target card wording matches the mockup:** *"Your close ratio is 1 sale per N presentations and 1
  presentation per M doors. To land K sales today, knock D doors."* (Starter reps see 9 and 4.4.)
- **Remove the 3 all-time bubbles from the existing home** (page 1): page 0 now owns the funnel numbers.
- **Accent = ember.** Note: the app's `--ember-400` is **`#FACC15`** — byte-identical to the mockup's
  yellow-400 — so "ember" and the mockup's yellow are the **same colour**. Dark ground `#09090B`, cards on
  `#18181B`/subtle white, borders `#27272A`/`#3F3F46`, text `#FAFAFA`/`#A1A1AA`/`#71717A` (= the mockup's zinc).

## Web source of truth (mirror these)
- Migrations:
  - `0247` — `rep_daily_sales_goal` (rep_id PK, `sales_goal`, MANAGER-write RLS — a rep can't self-set),
    `rep_day_target` (frozen per rep per `local_date`: doors/presentations/sold targets + ratios + `used_starter`).
  - `0248` — adds **`sale_value_cents`** (integer, nullable) to `rep_daily_sales_goal`: the manager-set $-per-sale
    for the cash box, in CENTS. NULL → the screen shows sales-to-goal instead of dollars.
- Engine (pure): `src/lib/coach/doorlog/dayTarget.ts` — `calculateDayTarget({salesGoal, closeRatio, contactRatio,
  qualified}) → {doorsTarget, presentationsTarget, soldTarget, usedStarter}`; `dialFill(count,target)` = clamped
  fraction. Starter ratios + floor/ceiling live here. **Port this arithmetic exactly** (the worked example must
  give 80, not 79).
- Read/freeze: `src/lib/coach/doorlog/dayTargetData.ts` — `getOrFreezeDayTarget` reads the frozen row (never
  recompute intra-day), else reads the goal + computes 30-day close/contact ratios from `door_knocks`/`pitches`,
  calls the engine, and freezes. It also reads `sale_value_cents` LIVE (not frozen — the manager may change it)
  via `select("*")` so a pre-0248 DB doesn't error, returning it as `saleValueCents`.
- Endpoint: `GET /api/coach/doorlog/day-target?tz=<IANA tz>` → `{ localDate, repName, target, today: {doors,
  presentations, sold} }`. `target` = the frozen DayTarget **plus** `salesGoal`, `closeRatio`, `contactRatio`,
  and **`saleValueCents`** (cents, or null). Degrades to 503 until 0247 rolls out.
- Manager goal: `GET/PATCH /api/coach/doorlog/rep-goal` — PATCH `{ repId, salesGoal, saleValueCents? }`,
  manager-gated + caller-scoped; the write retries without `sale_value_cents` if 0248 isn't applied yet.
- Dial component: `src/components/sales-coach/doorlog/DoorDial.tsx` — inline SVG, **26 ticks** over a **300°
  sweep** from **−150°** (a 60° gap at the bottom), viewBox 110, `CX=CY=55`, `R_INNER=39`, `R_OUTER=50`,
  strokeWidth 2.9; 0° = straight up, clockwise (`x=CX+R·sin`, `y=CY−R·cos`). Lit = ember `#FACC15`, unlit =
  `rgba(255,255,255,.15)`. Count is TEXT in the centre (`of N` below); the whole dial is one tap target (tap =
  onTap → open the quick-log). This is the mockup's exact tick math.
- Screen: `src/components/sales-coach/doorlog/DoorScreen.tsx` — order down the screen: date eyebrow + greeting →
  "Today's door target" card (the ratio sentence) → three dials → "Tap a dial to log one" → the cash box. The
  target card sits ABOVE the dials on purpose (read WHY before the count).
- Pager: `src/components/sales-coach/doorlog/MobileHomePager.tsx` — a native horizontal scroll-snap track: each
  page scrolls vertically inside itself, the track scrolls horizontally between them (so the axes don't fight);
  opens on page 0 every mount; two dots; snaps to page 0 on a Home-tab signal. On iOS use the platform's paged
  scroll / a UIPageViewController-equivalent; keep the vertical-inside / horizontal-between split.
- Home-tab → page 0: the web shell fires an `elostate:home-tab` event on Home tap; the native app just calls the
  pager's "go to page 0" when the Home tab is tapped.

## App work
1. **Door screen (page 0)** — mirror `DoorScreen.tsx`: fetch `GET /api/coach/doorlog/day-target?tz=<device tz>`,
   render date eyebrow + "Afternoon, <name>" + the "Today's door target" ratio sentence + three dials + "Tap a
   dial to log one" + the cash box. States: loading / unavailable(503) / error / **no-goal** (ask a manager to
   set one) / start-of-day (all zero) / goal-met. **Cash box:** show dollars when `saleValueCents` is set, else
   the "N more sales to goal" line.
2. **Dials** — mirror `DoorDial.tsx`'s 26-tick geometry + `dialFill`. Tap → open the existing quick-log, then
   refresh the screen. No long-press decrement.
3. **Pager** — page 0 = the door screen, page 1 = the existing home (minus its 3 bubbles). Open on page 0 every
   launch; do NOT persist the page index; reset to 0 on cold load / first open; two dots + swipe hint; Home tab
   snaps to 0. Tab bar stays fixed. Watch the gesture conflict: a horizontal drag starting ON a dial must SWIPE
   the page, not fire the tap.
4. **Manager goal UI** — a manager sets a rep's **daily sales goal AND (optionally) the $-per-sale** (writes
   `rep_daily_sales_goal`; RLS + a manager gate enforce manager-only). Until a goal exists, the rep's door screen
   shows the no-goal state; until a $-per-sale exists, the cash box shows sales-to-goal.
5. **Remove the existing home's 3 all-time bubbles** (doors/presentations/sold) — page 0 replaces them.

## Verify (from the web `09-verification` phase)
- Target arithmetic: goal 2 / close 1/9 / contact 1/4.4 → 18 presentations, 80 doors (round up).
- Cash box: `sold=1`, `$185/sale` → "Earned today $185", "$185 to goal" (target 2). No $-per-sale set → the box
  shows "1 more sale" instead of dollars (never `$0`).
- Zero-sales / new-rep → the starter target, never a blank or a crash.
- Local-day boundary (11:50pm vs 12:10am) lands on the right day in the rep's tz.
- A horizontal drag on a dial swipes and does NOT log; cold launch lands on page 0 every time.
