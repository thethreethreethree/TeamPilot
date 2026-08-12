# CLOSURE — capture-cost dashboard

## What shipped
A manager-only, read-only "Capture health" card (Settings → Coaching) + `/capture-health` route that counts how
many ended sessions failed to capture a transcript — split into recoverable (audio saved) vs lost (no audio) —
answering the founder's "determine the cost of this issue" in-app (the SQL query in the action queue was the
immediate answer; this is the in-product version). Founder-directed ("please continue" after the cost was
raised).

## Un-named reliances (A35)
- **RLS + the manager gate scope the count to the caller's company.** The route passes companyId to the reads
  and RLS on coaching_sessions/segments enforces tenancy; no cross-company read.
- **fetchAllPaged's 200k backstop is the honest ceiling.** Past it the route 500s with a clear message rather
  than under-counting — the point at which a server-side aggregate RPC is the correct tool.

## Residual (A36 — ranked by confidence-it-does-not-matter; top OPENED)
```json
[
  { "id": "R1", "item": "The count is computed in-app (paged reads), so it transfers segment session_ids and fails loud past fetchAllPaged's backstop, rather than a server-side SQL aggregate.", "why_skipped": "The proper tool is an RPC, which is a migration — consequential + gated to the founder's db:apply, and a secure RPC needs care (client-callable-DEFINER invariant) not worth rushing deep in a long session for a number the SQL already answers. The in-app version serves the first-client (low-volume) incident with an honest ceiling.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-12T10:25:00Z", "outcome": "Opened + assessed: correct + honest for the incident scale; flagged that a company past the backstop should get the RPC version. Documented; not built to avoid a rushed/gated migration. The route's 500 message points at the RPC as the fix." },
  { "id": "R2", "item": "The Settings-card UI (React) is not unit-tested (node env).", "why_skipped": "Repo constraint — React components aren't unit-testable here; the route (the logic) IS tested, and the card is a thin fetch+render.", "confidence_it_does_not_matter": "high", "opened_at": "2026-08-12T10:26:00Z", "outcome": "Opened + assessed: this is the standing repo constraint (no jsdom); the load-bearing logic is in the route, which is unit-tested (derivation + gate + honest-zero). The card is a thin fetch→render with no logic worth extracting. Accepted; device/manual confirmation covers the render." }
]
```

## Gate result (`npm run check`)
```
$ npm run check
typecheck ✓ · lint ✓ · theme:audit ✓ · rls:audit ✓
invariant:audit ✓ — Violations 0
tbc ✓ — docs · manifest (12) · artifacts · residual (2) · freshness all ✓
test ✓ — Test Files 398 passed | 1 skipped (399); Tests 2740 passed | 15 skipped (2755)
CHECK_EXIT=0
```
