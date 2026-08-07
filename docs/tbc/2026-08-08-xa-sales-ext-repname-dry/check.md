# CHECK — DRY the rep-name lookup across the 5 sales extension routes

## Verification (A38 — canonical command, by name, coverage + exit)
Ran `npm run check` (typecheck && lint && theme:audit && rls:audit && invariant:audit && tbc && test).

```
invariant:audit — Violations: 0 (INV24 ignores repName.ts — no LLM caller, so no fence required)
tbc — docs ✓ · manifest ✓ · artifacts ✓ · residual ✓ · freshness ✓
test — Tests 2442 passed | 15 skipped
=== check exit code: 0 ===
```
- `src/lib/coach/extension/__tests__/repName.test.ts` — 5 cases (name trimmed, blank→fallback, no-row→fallback,
  non-string→fallback, throw→fallback).
- The 5 sales route tests are unchanged and pass: their `createAdminClient` mock intercepts the helper's
  lookup (same import path), so `repName: "Dana Rep"` still threads to each engine.

## Behavior-preservation note (§1.5)
tsc clean confirms no unused import and no broken reference after swapping `createAdminClient` for
`resolveRepName` in each route. The helper is a line-for-line move of the inline block, so the routes emit the
identical `repName` they did before.

## Reachability (A31 — both directions)
```json
[
  {
    "feature": "Shared rep-name resolver for the sales extension routes",
    "files": ["src/lib/coach/extension/repName.ts", "src/app/api/coach/extension/*/route.ts"],
    "write_path": { "exists": true, "where": "each route calls resolveRepName(user.userId) after the guard", "human_can_set": true },
    "read_path": { "exists": true, "where": "the resolved repName is threaded into each engine's WHO-IS-WHO anchor, as before", "human_can_see": true }
  }
]
```
Internal refactor: the seam is route→helper→engine, all exercised by the route + helper tests.

## Findings
no findings — a behavior-preserving DRY extraction (5 copies → 1), the fallback contract now test-locked, tsc
clean, all extension tests unchanged and covered by the run above. INV24 correctly does not flag `repName.ts`
(it references no LLM caller, so it injects no external text and needs no fence).
