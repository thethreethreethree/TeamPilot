# CHECK — Sales Coach Extension, Phase 1c: summarize

## Verification (A38 — canonical command, by name, coverage + exit)
Ran `npm run check` (typecheck && lint && theme:audit && rls:audit && invariant:audit && tbc && test).

```
invariant:audit — Violations: 0 (incl. "every extension route authenticated")
tbc — docs ✓ · manifest ✓ · artifacts ✓ · residual ✓ · freshness ✓
test — Tests 2377 passed | 15 skipped
=== check exit code: 0 ===
```
New tests inside that run:
- `src/lib/coach/extension/__tests__/salesSummary.test.ts` — 5 cases (deal-state framing, no-fabrication,
  rep anchor, injection fence).
- `src/app/api/coach/extension/__tests__/summarize.route.test.ts` — 6 cases (429/402 short-circuit, success
  + rep threaded, rate_limit→429, server→502, non-LLM→502).

## Reachability (A31 — assert the seam, and name what is NOT built yet)
```json
[
  {
    "feature": "Text-in sales summary (server substrate)",
    "files": [
      "src/lib/coach/extension/salesSummary.ts",
      "src/app/api/coach/extension/summarize/route.ts"
    ],
    "write_path": {
      "exists": true,
      "where": "POST /api/coach/extension/summarize → generateSalesSummary; callable by any entitled extension session",
      "human_can_set": "NOT YET — no browser client posts to it in this phase (Phase 2)"
    },
    "read_path": {
      "exists": true,
      "where": "route returns {summary} (or an error status); rendered by the client panel in Phase 2",
      "human_can_see": "NOT YET — Phase 2 renders it"
    }
  }
]
```
**Honest status:** verified SUBSTRATE, not a human-reachable end-feature — server exists, client caller is
Phase 2. Not reported as a shippable user feature.

## Findings
no findings — reuses the shared entitlement guard (auth parity held by the invariant audit) and the generic
text-out LLM, grounds without fabricating, and — the point of this tool's contract — surfaces a provider
failure as 429/502 rather than a false-empty summary (§3.4), locked by the route tests. The one deliberate
boundary — no browser client this phase — is sequenced as Phase 2, not silently omitted.
