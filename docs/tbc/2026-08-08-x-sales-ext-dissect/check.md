# CHECK — Sales Coach Extension, Phase 1a

## Verification (A38 — canonical command, by name, coverage + exit)
Ran `npm run check` (typecheck && lint && theme:audit && rls:audit && invariant:audit && tbc && test).

```
invariant:audit — Files scanned: 751 · Violations: 0 (incl. "every extension route authenticated")
tbc — docs ✓ · manifest ✓ · artifacts ✓ · residual ✓ · freshness ✓
test — Test Files 353 passed | 1 skipped · Tests 2354 passed | 15 skipped
=== check exit code: 0 ===
```
New tests inside that run:
- `src/lib/coach/extension/__tests__/salesTextDissect.test.ts` — 10 cases (grounding drops hallucinated
  excerpts, whitespace-normalized real-quote match, honest-empty, structural-empty, prompt anchor + fence).
- `src/app/api/coach/extension/__tests__/dissect.route.test.ts` — 4 cases (429/402 short-circuit before the
  engine, rep-name threaded, honest-empty pass-through).

## Reachability (A31 — assert the seam, and name what is NOT built yet)
```json
[
  {
    "feature": "Text-in sales dissect (server substrate)",
    "files": [
      "src/lib/coach/extension/salesTextDissect.ts",
      "src/app/api/coach/extension/dissect/route.ts"
    ],
    "write_path": {
      "exists": true,
      "where": "POST /api/coach/extension/dissect → generateSalesTextDissect; callable by any entitled extension session token",
      "human_can_set": "NOT YET — no browser client posts to it in this phase; the client (panel + adapters) is Phase 2"
    },
    "read_path": {
      "exists": true,
      "where": "route returns {dissect}; the engine result shape is rendered by the client panel in Phase 2",
      "human_can_see": "NOT YET — Phase 2 renders it"
    }
  }
]
```
**Honest status:** this is verified SUBSTRATE, not a human-reachable end-feature. Per A31 the store↔surface
seam is only half-wired (server exists; no client caller yet), so it is deliberately labeled Phase-1a
substrate — NOT reported as a shippable user feature. The client phase closes the human-facing seam.

## Findings
no findings — the route reuses the shared entitlement guard (auth parity held by the invariant audit), the
engine grounds every claim and degrades honestly, and nothing is stored (ephemeral). The one deliberate
boundary — no browser client this phase — is stated above and sequenced as Phase 2, not silently omitted.
