# BUILD — door home screen: swipeable pager + cash box

### The swipeable pager (the missing "make it swipeable" piece)
- write-path: `src/components/sales-coach/doorlog/MobileHomePager.tsx` — a native scroll-snap track (no gesture
  lib): each page scrolls vertically inside itself, the track scrolls horizontally between them, so the axes
  don't fight. Opens on page 0 every mount (cold load / first open / navigated back — Q6), two dots track the
  position, and it snaps to page 0 on the `elostate:home-tab` event (Q8).
- read-path: a Macro rep opens Home → sees the door tracker (page 0) → swipes left to the original Macro home
  (page 1) → taps the Home tab from anywhere → lands back on page 0.

### Wiring it into the live mobile home
- write-path: `src/app/dashboard/sales-coach/page.tsx` — when `macroOn === true` the mobile home renders the
  pager (page 0 `<DoorScreen/>`, page 1 the original Macro home) with "Back to ELOSTATE" pinned above it; when
  off/loading it renders the existing home unchanged. The 3 all-time door bubbles are REMOVED from page 1 (page
  0 owns the funnel), and the dead `macroTotals` state + `door-log?range=all` fetch are deleted.
- read-path: `src/components/sales-coach/SalesCoachShell.tsx` — the Home bottom-tab fires `elostate:home-tab`
  so the pager can snap to page 0 even when the route doesn't remount.

### Exact-mockup parity on the door screen
- write-path: `DoorScreen.tsx` — date eyebrow + "Afternoon, Marcus" greeting, the "Today's door target"
  sentence built from the rep's inverted ratios ("1 sale per N presentations…"), "Tap a dial to log one", and
  the cash box; `DoorDial.tsx` — 26 ticks over a 300° sweep from −150° (bottom gap), viewBox 110, ember fill —
  the mockup's exact tick math.
- read-path: the rep sees a screen matching the mockup; ember is `--ember-400 #FACC15` = the mockup's yellow.

### The cash box + its data
- write-path: migration `0248_door_home_screen_sale_value.sql` adds `sale_value_cents` to
  `rep_daily_sales_goal`; `dayTargetData.getOrFreezeDayTarget` reads it via `select("*")` and returns it on both
  the frozen and fresh paths; the `rep-goal` route GET returns it and PATCH accepts it (with an A34
  retry-without-column); `RepGoalPanel` gains a "$ per sale (optional)" input.
- read-path: "Earned today" = sold × $-per-sale; "to goal" = remaining sales × $-per-sale; no value set → the
  box degrades to the plain "sales to goal" line (no fabricated $0).

### The gate (A30)
- write-path: `dayTargetData.test.ts` (+2: $-per-sale flow-through, null degrade), `rep-goal/route.test.ts`
  (+1: manager sets $-per-sale; GET returns it), `MobileHomePager.render.test.tsx` (+2: pages + dots + Home-tab
  snap). DoorDial gesture tests unchanged.
- read-path: a regression dropping the $-per-sale, or breaking the pager scaffolding, fails these.

## Files
- `supabase/migrations/0248_door_home_screen_sale_value.sql`
- `src/lib/coach/doorlog/dayTargetData.ts`
- `src/app/api/coach/doorlog/day-target/route.ts` (flows the new field via the view — unchanged shape)
- `src/app/api/coach/doorlog/rep-goal/route.ts`
- `src/components/sales-coach/doorlog/DoorScreen.tsx`
- `src/components/sales-coach/doorlog/DoorDial.tsx`
- `src/components/sales-coach/doorlog/MobileHomePager.tsx`
- `src/components/sales-coach/doorlog/RepGoalPanel.tsx`
- `src/app/dashboard/sales-coach/page.tsx`
- `src/components/sales-coach/SalesCoachShell.tsx`
- tests: `dayTargetData.test.ts`, `rep-goal/__tests__/route.test.ts`, `MobileHomePager.render.test.tsx`

## Ripple (§1.5)
- Additive migration (new nullable column); no existing table/policy changed. RLS on the goal row already gates
  writes to managers — the $-per-sale rides the same row, same policy.
- The desktop dashboard and the non-Macro mobile home are untouched. Only a Macro-ON rep gets the pager.
- 0248 is BUILT but not applied — the app degrades to sales-to-goal until `npm run db:apply` lands it (A34).
