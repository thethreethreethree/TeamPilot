# CLOSURE — Sales Coach Extension, Phase 2a: standalone client core

## What shipped
The standalone Sales Coach extension package's verifiable core: `manifest.json` (MV3, sales-branded),
`config.js` (`SALES_TOOLS` wired to the 4 Phase-1 routes, with distinct token/guard/tools names so it
coexists with the C.A.R.E extension), a `README.md` with an honest status table + the Phase 2b port spec, and
a drift guard binding the config to the real routes.

## Un-named reliance (not self-evident)
- **The package is NOT loadable yet, on purpose.** No background/content/adapters, no icons, no auth handoff.
  Do not present it as a working extension. The README says NOT-yet-loadable in a status table; keep that
  honest as the runtime lands.
- **The drift guard is the load-bearing verification here.** Since the browser can't run in the sandbox, the
  one contract that CAN rot silently — a tool button pointing at a route that doesn't exist — is the one
  pinned by a test. If a future tool is added to `SALES_TOOLS`, its route must exist or `npm run check` fails.
- **Distinct keys are not cosmetic.** `salesCoachToken` / `__salesCoachConfigLoaded` / `SALES_TOOLS` MUST
  stay distinct from the C.A.R.E extension's `careToken` / `__careConfigLoaded` / `CARE_TOOLS`, or installing
  both breaks both (shared global scope, shared storage). The guard pins all three.
- **The port has a hidden dependency the guard can't see: auth.** Phase 2b's `background.js` must NOT
  reference `/api/coach/extension/refresh` until that route is built — the drift guard only checks TOOL
  endpoints, not the refresh/connect endpoints. Flagged in the README + check.md so the port doesn't
  reintroduce a broken reference.

## Flagged, not fixed (§3.3)
- The whole browser runtime (background/content/adapters/permission/icons) + the sales auth connect/refresh
  routes are Phase 2b — specced in the README, recorded in project memory. Not skipped, not stubbed.

## Residual (A36)
```json
[
  { "id": "RES-01", "item": "The browser runtime (background.js/content.js/adapters.js/permission + icons) is not ported — the package is not loadable.", "why_skipped": "Unverifiable in a no-browser sandbox, and ~1400 lines of C.A.R.E-specific JS with dependencies (auth connect/refresh) that don't exist for the sales extension yet; copying it blindly would ship broken surface. Specced as a mechanical port in the README instead.", "confidence_it_does_not_matter": "high", "opened_at": "2026-08-08T04:45:00Z", "outcome": "OPENED — Phase 2b ports the runtime per the README, founder-live-verified per platform." },
  { "id": "RES-02", "item": "No sales-extension auth handoff (connect page + token mint + refresh route).", "why_skipped": "The C.A.R.E handoff is its own subsystem; the sales extension needs an equivalent before it can authenticate. Out of scope for the client-core phase; it is the gating dependency for a loadable extension.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-08T04:45:00Z", "outcome": "OPENED — build the sales connect/refresh routes + /extension/connect handoff before or with Phase 2b." }
]
```
