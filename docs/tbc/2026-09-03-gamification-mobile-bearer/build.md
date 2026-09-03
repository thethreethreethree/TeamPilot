# BUILD — Mobile Bearer support for the gamification routes

### Identity widens to cookie-OR-Bearer (all 4 routes)
- write-path: `getCurrentAuthContext()` → `resolveApiAuth(req)` in leaderboard, my-points, notifications (GET+POST),
  and calibration's `requireManager(req)`. Same AuthContext verdict; consumed identically (§2.2).
- read-path: a mobile caller sending `Authorization: Bearer <token>` now authenticates (was 401); a web caller with
  a cookie is unchanged (resolveApiAuth tries the cookie first and returns it).

### Data client becomes caller-scoped where the read relies on the session (RLS / DEFINER RPC)
- write-path: `callerScopedDb(req) ?? (await createClient())` in leaderboard (the RPC), my-points (owner read),
  notifications GET (recipient read). The Bearer client carries the caller's JWT → `auth.uid()` / `auth_company_id()`
  resolve → existing RLS applies unchanged; fails closed.
- read-path: a mobile caller reads their OWN leaderboard/points/notifications (auth.uid() = the caller) instead of an
  empty set; notifications POST + calibration are unchanged — they use the admin client with explicit `recipient_id`
  / `company_id` scoping, which already worked for any authenticated identity.

## Files
- `src/app/api/coach/gamification/leaderboard/route.ts` — resolveApiAuth + callerScopedDb (RPC)
- `src/app/api/coach/gamification/my-points/route.ts` — resolveApiAuth + callerScopedDb (read)
- `src/app/api/coach/gamification/notifications/route.ts` — resolveApiAuth (GET+POST) + callerScopedDb (GET read)
- `src/app/api/coach/gamification/calibration/route.ts` — resolveApiAuth via requireManager(req)
- `src/app/api/coach/gamification/my-points/__tests__/route.bearer.test.ts` (NEW, +2 tests)
- `docs/sales-coach/GAMIFICATION-MOBILE-BUILD-SPEC.md` — the spec's Bearer claim is now TRUE (no doc change needed)

## Ripple (§6 item 5)
- No schema/RLS/policy change — RLS is the enforcement and it is untouched; only the client carrying the caller's
  identity widens. A mobile caller sees exactly what the web caller would (A18 preserved).
- Cookie path byte-for-byte unchanged: `resolveApiAuth` returns the cookie ctx when present; `callerScopedDb(req)`
  returns null without a Bearer header → `createClient()` fallback. The existing 12 route tests confirm this.
- Fails CLOSED: a bad/expired Bearer → the token client returns no rows (never another tenant's).
