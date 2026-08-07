# CHECK — Sales Coach Extension, Phase 1b

## Verification (A38 — canonical command, by name, coverage + exit)
Ran `npm run check` (typecheck && lint && theme:audit && rls:audit && invariant:audit && tbc && test).

```
invariant:audit — Violations: 0 (incl. "every extension route authenticated")
tbc — docs ✓ · manifest ✓ · artifacts ✓ · residual ✓ · freshness ✓
test — Tests 2366 passed | 15 skipped
=== check exit code: 0 ===
```
New tests inside that run:
- `src/lib/coach/extension/__tests__/salesReplyCoach.test.ts` — 8 cases (structural-honesty degrade,
  array caps, methodology grounding, rep anchor, injection fence).
- `src/app/api/coach/extension/__tests__/coach.route.test.ts` — 4 cases (429/402 short-circuit,
  conversation+draft+rep threaded, honest-empty pass-through).

## Reachability (A31 — assert the seam, and name what is NOT built yet)
```json
[
  {
    "feature": "Text-in sales reply coaching (server substrate)",
    "files": [
      "src/lib/coach/extension/salesReplyCoach.ts",
      "src/app/api/coach/extension/coach/route.ts"
    ],
    "write_path": {
      "exists": true,
      "where": "POST /api/coach/extension/coach → generateSalesReplyCoaching; callable by any entitled extension session",
      "human_can_set": "NOT YET — no browser client posts to it in this phase (Phase 2)"
    },
    "read_path": {
      "exists": true,
      "where": "route returns {coaching}; rendered by the client panel in Phase 2",
      "human_can_see": "NOT YET — Phase 2 renders it"
    }
  }
]
```
**Honest status:** verified SUBSTRATE, not a human-reachable end-feature — the store↔surface seam is half-
wired on purpose (server exists; client caller is Phase 2). Not reported as a shippable user feature.

## Findings
no findings — reuses the shared entitlement guard (auth parity held by the invariant audit) and the shared
sales methodology block (no fork), grades without fabricating (structural degrade tested), stores nothing.
The one deliberate boundary — no browser client this phase — is sequenced as Phase 2, not silently omitted.
