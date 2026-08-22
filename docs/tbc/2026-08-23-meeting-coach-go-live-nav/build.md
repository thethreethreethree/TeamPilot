# BUILD — Meeting Coach go-live: nav entry + module entitlement (flag-guarded)

### Meeting Coach is now part of the sales_coach entitlement
- write-path: `moduleAccess.ts` — `MEETING_COACH_ROOT` + `moduleForPath` returns `sales_coach` for the
  meeting-coach subtree, so the 0207 lock no longer redirects a sales_coach-locked account away.
- read-path: `isPathAllowed(sales_coach, /dashboard/meeting-coach)` → true (reachable); `isPathAllowed(care, …)`
  → false (denied); `isPathAllowed(null, …)` → true (hub). Locked in a unit test.

### the nav entry, gated on the go-live flag
- write-path: `NEXT_PUBLIC_MEETING_COACH_ENABLED` (build-time) gates the entry in BOTH navs — `SalesCoachShell`
  (conditional spread into the Home section, sales_coach accounts) and the global `Sidebar` (a
  `requiresMeetingCoachFlag` entry filtered in the render, like `vendorOnly`, for hub accounts).
- read-path: with the flag off (default) neither nav shows "Meeting Coach" — the feature stays URL-only; with it
  on (founder-set after db:apply + redeploy) both navs surface it → the built Prep-up/Meeting-Coach loop is
  reachable.

## Files
- `src/lib/auth/moduleAccess.ts` — `MEETING_COACH_ROOT` + entitlement classification.
- `src/lib/auth/__tests__/moduleAccess.test.ts` — +1 test (the entitlement matrix).
- `src/components/sales-coach/SalesCoachShell.tsx` — flag-gated Home-section entry.
- `src/components/layout/Sidebar.tsx` — flag-gated `requiresMeetingCoachFlag` production entry + render filter.
- `docs/MEETING-COACH-GO-LIVE.md` (NEW) — the §1.5.3 blocking-setup record (migrations + flag + verification + rollback).

## Ripple (holistic)
`moduleForPath` is LIVE auth — the change only EXPANDS sales_coach access to the (flag-off, A34-safe) meeting-coach
subtree and leaves care/hub behavior unchanged; the entitlement matrix is unit-tested so a regression trips CI. No
schema change. The nav entries are additive + build-time-gated.
