# CHECK — Sales Coach Extension, Phase 1d: co-pilot

## Verification (A38 — canonical command, by name, coverage + exit)
Ran `npm run check` (typecheck && lint && theme:audit && rls:audit && invariant:audit && tbc && test).

```
invariant:audit — Violations: 0 (incl. "every extension route authenticated")
tbc — docs ✓ · manifest ✓ · artifacts ✓ · residual ✓ · freshness ✓
test — Tests 2393 passed | 15 skipped
=== check exit code: 0 ===
```
New tests inside that run:
- `src/lib/coach/extension/__tests__/salesCopilot.test.ts` — 9 cases (split edge-cases, methodology
  grounding, drafting identity, FOLLOW-UP vs REPLY mode, no-fabrication, injection fence).
- `src/app/api/coach/extension/__tests__/copilot.route.test.ts` — 7 cases (429/402 short-circuit,
  {reply,reasoning}+rep+lastSpeaker threaded, empty-draft→502, rate_limit→429, server→502, non-LLM→502).

## Reachability (A31 — assert the seam, and name what is NOT built yet)
```json
[
  {
    "feature": "Text-in sales co-pilot draft (server substrate)",
    "files": [
      "src/lib/coach/extension/salesCopilot.ts",
      "src/app/api/coach/extension/copilot/route.ts"
    ],
    "write_path": {
      "exists": true,
      "where": "POST /api/coach/extension/copilot → generateSalesCopilotReply; callable by any entitled extension session",
      "human_can_set": "NOT YET — no browser client posts to it in this phase (Phase 2)"
    },
    "read_path": {
      "exists": true,
      "where": "route returns {reply, reasoning} (or an error status); rendered + paste-into-thread by the client panel in Phase 2",
      "human_can_see": "NOT YET — Phase 2 renders it"
    }
  }
]
```
**Honest status:** verified SUBSTRATE, not a human-reachable end-feature — server exists, client caller is
Phase 2. Not reported as a shippable user feature.

## Findings
no findings — reuses the shared entitlement guard (auth parity held by the invariant audit), the shared
sales methodology block, AND the shared reply/follow-up mode selector (no fork). Drafts without fabricating,
surfaces a provider failure as 429/502, and never returns a blank reply (empty draft → 502) — all locked by
tests. The one deliberate boundary — no browser client this phase — is sequenced as Phase 2, not omitted.
