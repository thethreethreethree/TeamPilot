# CHECK — Sales Coach Extension, Phase 1e: formulate

## Verification (A38 — canonical command, by name, coverage + exit)
Ran `npm run check` (typecheck && lint && theme:audit && rls:audit && invariant:audit && tbc && test).

```
invariant:audit — Violations: 0 (incl. "every extension route authenticated")
tbc — docs ✓ · manifest ✓ · artifacts ✓ · residual ✓ · freshness ✓
test — Tests 2422 passed | 15 skipped
=== check exit code: 0 ===
```
New tests inside that run:
- `src/lib/coach/extension/__tests__/salesFormulate.test.ts` — 9 cases (methodology grounding,
  shape-not-judge, rep anchor, no-fabrication, injection fence; JSON parse, ```json-fence survival,
  non-JSON fallback, empty-reply).
- `src/app/api/coach/extension/__tests__/formulate.route.test.ts` — 7 cases (429/402 short-circuit, threading,
  empty-reply→502, rate_limit→429, server→502, non-LLM→502).
- The existing `salesExtensionConfigWiring.test.ts` now iterates 5 endpoints and asserts the new
  formulate→route mapping (no dead tool).

## Reachability (A31 — assert the seam, and name what is NOT built yet)
```json
[
  {
    "feature": "Text-in sales formulate (server substrate + wired tool)",
    "files": ["src/lib/coach/extension/salesFormulate.ts", "src/app/api/coach/extension/formulate/route.ts", "extension-sales/config.js"],
    "write_path": {
      "exists": true,
      "where": "SALES_TOOLS.formulate → POST /api/coach/extension/formulate → generateSalesFormulate; endpoint→route asserted by the drift guard",
      "human_can_set": "NOT YET — no browser panel posts to it (Phase 2b)"
    },
    "read_path": {
      "exists": true,
      "where": "route returns {reply, reasoning}; rendered by the client panel in Phase 2b",
      "human_can_see": "NOT YET — Phase 2b renders it"
    }
  }
]
```
**Honest status:** verified SUBSTRATE + a drift-guarded tool entry (so it is NOT a dead button), but the
human-facing panel is still Phase 2b. Not reported as a shippable user feature.

## Findings
no findings — reuses the shared guard (auth parity held by the invariant audit), the shared methodology, and
the shared JSON coercion; shapes without fabricating; never a blank message (empty reply → 502); and the new
tool is bound to its route by the existing drift guard. The browser panel remains the sequenced Phase 2b
boundary, not a silent omission.
