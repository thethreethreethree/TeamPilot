# BUILD — Macro Mode bottom-nav revision

### the Macro bottom nav is the founder's 4-tab set (D-choice: drop Team Chat)
- write-path: `MACRO_MOBILE_TABS` in `SalesCoachShell.tsx` is now
  `[Home, Pitch Performance (/doors/report-card), Today's Metrics (/doors/todays-metrics), Role Play (/roleplay)]`
  — AI Agent (/sessions) + Team Chat removed; Role Play moved to the last slot. `Bot` import dropped (now unused).
- read-path: a Macro-mode mobile rep sees one-tap Pitch Performance + Today's Metrics; the swap
  `(macroOn ? MACRO_MOBILE_TABS : MOBILE_TABS)` is unchanged, so a non-macro rep's 5-tab nav is untouched.

### the two promoted surfaces leave the Macro home grid (D-choice: true move)
- write-path: the `macroOn` branch of `dashboard/sales-coach/page.tsx` now renders ONLY the Door Log card
  (centered at the same half-width proportion, not a stretched slab); the Today's Metrics + Pitch Performance
  `MobileCard`s are removed. `BarChart3` import dropped (was only that card's icon).
- read-path: no duplicate entry point — the two surfaces live in the nav now; the macro home is Door Log + the
  KPI bubbles + Start Knocking, leaner as the founder specified.

### the layout is locked so it can't silently regress (A30)
- write-path: `salesCoachShellNav.test.ts` asserts the exact set + ORDER (Home → Pitch Performance → Today's
  Metrics → Role Play) + the removed tabs (no AI Agent, no Team Chat, no /sessions);
  `macroCardVisibility.render.test.tsx` asserts Macro ON shows Door Log and NOT the two moved cards.
- read-path: a future edit that reorders, re-adds AI Agent/Team Chat, or re-adds the cards fails CI.

## Files
- `src/components/sales-coach/SalesCoachShell.tsx` — new MACRO_MOBILE_TABS + drop unused `Bot` import.
- `src/app/dashboard/sales-coach/page.tsx` — macro home grid = Door Log only + drop unused `BarChart3` import.
- tests: `salesCoachShellNav.test.ts` (macro-nav block rewritten), `macroCardVisibility.render.test.tsx` (Macro-ON
  card assertions updated).

## Ripple (holistic)
- Scope is **mobile Macro Mode only** — the desktop sidebar (`NAV_SECTIONS`) and the non-macro mobile nav
  (`MOBILE_TABS`) are untouched (a desktop macro rep still reaches Today's Metrics / Pitch Performance via the
  MacroModeToggle `showLinks` card). The founder annotated the mobile macro screen; that is the scope.
- Reachability consequence (layer-3, flagged in closure): a mobile MACRO rep no longer has Team Chat or the Live
  AI Coach (Sessions) in-nav; Team Chat remains on desktop + the non-macro mobile nav. Disclosed in the picker;
  founder chose it.
- Orphaned imports (`Bot`, `BarChart3`) removed so lint stays clean. No route, schema, or data-layer change.
