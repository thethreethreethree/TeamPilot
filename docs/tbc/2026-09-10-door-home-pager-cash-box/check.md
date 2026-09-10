# CHECK — door home screen: swipeable pager + cash box

## Findings
**No findings.** No defects surfaced. Two design notes (not defects):
1. The prototype's "Reset the day" button is intentionally omitted — real counts are immutable logged events,
   so there is nothing to reset (a knock is a `door_knock` with an outcome; a presentation is a recorded pitch).
   Flagged to the founder as a correctness-driven departure, not a style omission.
2. The dials show REAL logged counts and a tap opens the quick-log; the prototype's fake +1 is not copied
   (§3.4). The one visual thing not literally matched, on purpose.

## Visual parity (§1.5.4 — the founder specified exact UI/graphics)
A faithful replica using the component's EXACT dial tick-math and the app's dark tokens was rendered to PNG via
Edge headless and inspected: date eyebrow, "Afternoon, Marcus", the "Today's door target" sentence, three
26-tick ember dials (47/80, 11/18, 1/2) with the bottom gap + clockwise fill, "Tap a dial to log one", the
"$185 Earned today" cash box with "$185 per sale / $185 to goal", two dots, and "Swipe left for your home
screen" — all present and matching the mockup. The app's `--ember-400` is `#FACC15`, byte-identical to the
mockup's yellow-400, so the accent matches by construction.

## Migration held for review (A34)
`0248_door_home_screen_sale_value.sql` (adds `sale_value_cents` to `rep_daily_sales_goal`) is BUILT but NOT
applied. Until `npm run db:apply` lands it, the read path returns `saleValueCents: null` and the cash box
degrades to the plain "sales to goal" line — it does not fabricate a $0, and the goal write retries without the
column, so setting a goal still works pre-migration.

## Targeted suite
```
$ npx vitest run src/lib/coach/doorlog/__tests__/dayTargetData.test.ts src/app/api/coach/doorlog/rep-goal/__tests__/route.test.ts src/components/sales-coach/doorlog/__tests__/DoorDial.render.test.tsx src/components/sales-coach/doorlog/__tests__/MobileHomePager.render.test.tsx
 Test Files  4 passed (4)
      Tests  18 passed (18)
```

## Canonical command
```
$ npm run check
  typecheck · lint · theme:audit · rls:audit · invariant:audit · tbc · test
  theme-bound leaks: 0
  rls:audit — Tables without RLS: 0 · Tenant-pin risks: 0 · Missing policies: 0
  invariant audit — Files scanned: 1011 · Violations: 0
  tbc:docs ✓  tbc:manifest ✓ (build: docs/tbc/2026-09-10-door-home-pager-cash-box, 13 entries)
  tbc:artifacts ✓  tbc:residual ✓  tbc:freshness ✓
  Test Files  633 passed | 1 skipped (634)
       Tests  4178 passed | 15 skipped (4193)
  Duration    42.13s
EXIT_CHECK=0
```
The whole gate is green (exit 0), including the updated `macroCardVisibility.render.test.tsx` (the Macro home is
now the pager) and the new pager/$-per-sale tests.
