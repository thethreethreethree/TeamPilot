# CHECK — Macro Mode bottom-nav revision

## Gate — the canonical command (A38)

```
$ npm run check
  (typecheck → lint → theme:audit → rls:audit → invariant:audit → tbc → test)
  Invariant audit: Violations 0 (incl. "every upload route validated")
  Test Files  567 passed | 1 skipped (568)
       Tests  3721 passed | 15 skipped (3736)
EXIT: 0
```

## What the tests prove
- **Nav set + order (`salesCoachShellNav.test.ts`):** the Macro nav is exactly Home → Pitch Performance → Today's
  Metrics → Role Play, in that order, pointing at `/doors/report-card`, `/doors/todays-metrics`, `/roleplay`; and
  it does NOT contain AI Agent, Team Chat, or `/sessions`.
- **Card removal (`macroCardVisibility.render.test.tsx`):** rendering the real page with Macro ON shows the Door
  Log card and NO Today's Metrics / Pitch Performance cards (they moved to the nav); the Macro-OFF home is
  unchanged; the door bubbles + Start Knocking CTA still render.

## Honest limit
The render test proves the DOM (which cards exist), not the pixel layout. The two-line wrap of "Pitch Performance"
/ "Today's Metrics" in the 4-tab bar is a visual property confirmed on a real phone at go-live (layer-4); the
labels are kept verbatim to the founder's mockup. The nav lives in `SalesCoachShell` (a client component
unrenderable in the node env), so its set/order is guarded by source-substring assertions, the same posture as the
existing extension-parity + collapsible-group guards in that file.

## Findings
No findings.
