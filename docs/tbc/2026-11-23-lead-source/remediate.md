# REMEDIATE - Lead source on prospects

### F1 - the existing create-route test pinned the exact function arguments
Updated to the new contract and a source case added.
gate-or-promise: gate (src/app/api/coach/remote/prospects/__tests__/route.test.ts)

### F2 - live app and new database between push and deploy
Backward compatible by construction (defaulted parameter, appended column); confirmed by the full-chain replay.
gate-or-promise: promise (OPEN.md after-push check: add a prospect with a source on the live site)
