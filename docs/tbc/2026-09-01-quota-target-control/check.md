# CHECK — wire the missing quota-target control

## Canonical commands
```
$ npm run typecheck   (tsc --noEmit)
EXIT_TYPECHECK=0

$ npx eslint src/app/dashboard/sales-coach/kpi/page.tsx
EXIT_LINT=0
```
Both clean (exit 0), no output = no errors.

## Contract check (client ↔ route, read term-for-term)
- Route `PatchSchema = z.number().int().positive().max(100000).nullable()`; client sends `{ target }` only after
  validating `Number.isInteger(n) && n > 0 && n <= 100000`, or `null` for blank. Match confirmed by reading
  `src/app/api/coach/sales-session/quota/route.ts` lines 40–80 this session.
- Status codes: route returns 401/403/409/500; client branches 409 → "not enabled on this environment", else
  generic. Success `{ ok, target }` → client persists + refreshes.

## Findings
- No findings. Typecheck + lint clean; the client's validation is a term-for-term mirror of the server bound; the
  save path refreshes both KPI sources so no surface lags on "building".

## Not claimed
- No client render test — page.tsx has no jsdom/render harness (founder-visual-verify, consistent with the rest of
  this page). The server mutation is covered by `.../quota/__tests__/route.test.ts` (pre-existing).
- Founder-visual-verify: set a target as a manager and confirm the Quota metric leaves "building".
