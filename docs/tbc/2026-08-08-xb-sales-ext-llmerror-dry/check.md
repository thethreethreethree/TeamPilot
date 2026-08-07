# CHECK — DRY the LlmError→HTTP mapping across the 3 generative sales routes

## Verification (A38 — canonical command, by name, coverage + exit)
Ran `npm run check` (typecheck && lint && theme:audit && rls:audit && invariant:audit && tbc && test).

```
invariant:audit — Violations: 0 (INV24 ignores llmErrorResponse.ts — no LLM caller reference)
tbc — docs ✓ · manifest ✓ · artifacts ✓ · residual ✓ · freshness ✓
test — Tests 2446 passed | 15 skipped
=== check exit code: 0 ===
```
- `src/lib/coach/extension/__tests__/llmErrorResponse.test.ts` — 4 cases (rate-limit→429, other-LlmError→502,
  explicit-status honored, non-LLM→logged-502 with the fallback).
- The summarize / copilot / formulate route tests are unchanged and pass — the helper returns the identical
  responses the inline blocks did.

## Behavior-preservation note (§1.5)
tsc clean confirms no unused import after swapping `LlmError` for `llmErrorResponse` in each route
(`NextResponse` is still used by the success + empty-branch returns). The helper is a line-for-line move.

## Reachability (A31 — both directions)
```json
[
  {
    "feature": "Shared LlmError→HTTP mapping for the generative sales routes",
    "files": ["src/lib/coach/extension/llmErrorResponse.ts", "src/app/api/coach/extension/{summarize,copilot,formulate}/route.ts"],
    "write_path": { "exists": true, "where": "each generative route's catch returns llmErrorResponse(err, {...})", "human_can_set": true },
    "read_path": { "exists": true, "where": "the mapped status + body reach the extension client exactly as before", "human_can_see": true }
  }
]
```
Internal refactor: route→helper→response, exercised by the helper test + the 3 unchanged route tests.

## Findings
no findings — a behavior-preserving DRY extraction (3 copies → 1), the error taxonomy now centralized and
test-locked, tsc clean, the route tests unchanged. INV24 correctly does not flag `llmErrorResponse.ts` (it
references no LLM caller, so it injects no external text and needs no fence).
