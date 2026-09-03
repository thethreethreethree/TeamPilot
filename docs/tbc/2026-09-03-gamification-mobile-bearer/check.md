# CHECK — Mobile Bearer support for the gamification routes

## Typecheck: `npm run typecheck` → clean.

## Route tests: `npx vitest run src/app/api/coach/gamification/`
```
 Test Files  4 passed (4)
      Tests  14 passed (14)
```
- The existing 12 (leaderboard/my-points/calibration) still pass → the **cookie path is unchanged** (resolveApiAuth
  returns the mocked getCurrentAuthContext for the cookie path; header-less Requests → callerScopedDb null → cookie
  fallback).
- +2 Bearer-path tests (my-points): a `Authorization: Bearer` request reads through the caller-scoped token client
  (the cookie client is stubbed to THROW, so an accidental fallback fails loudly) and returns the caller's own
  points; 401 when neither cookie nor Bearer authenticates.

## Full canonical gate: `npm run check` (typecheck · lint · theme · rls:audit · invariant:audit · tbc · test)
The security-relevant steps, from the run:
```
✓ No theme-bound leaks.
  Missing policies:      0
```
rls:audit unaffected (no policy change; the caller-scoped client uses the anon key so RLS still enforces). The gate's
own tbc step validates THIS directory, so the definitive full-suite pass is recorded at the commit (the pushed
branch runs `npm run check` in CI); the route-test block above is the direct evidence for this change.

## Findings
- No findings. The change widens identity + read-client only; RLS is the enforcement and is untouched. Fails closed.

## Not claimed
- Not verified against a live mobile device/token (no device in this environment) — proven by the Bearer-path unit
  tests + the proven callerScopedDb pattern the session routes already ship. A real device smoke-test is a founder
  step post-deploy.
- Other cookie-only coach routes outside gamification are unchanged (out of scope).
