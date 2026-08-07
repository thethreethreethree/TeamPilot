# CLOSURE — DRY the LlmError→HTTP mapping across the 3 generative sales routes

## What shipped
`llmErrorResponse(err, {logTag, fallbackMessage})` — the single implementation of the LlmError→HTTP mapping
the three generative sales routes (summarize/copilot/formulate) each hand-rolled. Each catch is now a one-line
call; the error taxonomy lives in one place; behavior identical; the mapping test-locked.

## Un-named reliance (not self-evident)
- **Behavior is preserved LINE-FOR-LINE.** Same status logic (rate-limit → 429, other LlmError → its status
  default 502, non-LLM → logged 502), same body shape (`{error, kind}` for LlmError; `{error}` for the
  fallback), same log. Do not change the mapping without updating the helper test + being aware all 3 routes
  move together (that centralization is the point).
- **The read-only tools deliberately do NOT use this.** dissect + coach honest-empty (their engines never
  throw), so they have no catch to share. Only the generative tools (whose engine lets an LlmError propagate)
  map errors. Do not "unify" a catch onto dissect/coach — they have none by design.
- **NextResponse stays imported in the routes.** The success returns and the empty-draft/empty-reply 502
  branches still build responses directly; only the direct `LlmError` reference left the routes.
- **INV24 correctly ignores llmErrorResponse.ts** — it references no LLM caller, injects no external text, so
  no CONVERSATION_IS_DATA fence is required (the invariant's LLM-caller trigger is why).

## Flagged, not fixed (§3.3)
- The C.A.R.E extension routes (summarize/copilot/formulate/spawn) hand-roll the same LlmError mapping. A
  future pass could adopt this helper for them too — not done now (touches working C.A.R.E code for no
  behavior change).

## Residual (A36)
```json
[
  { "id": "RES-01", "item": "The C.A.R.E extension generative routes still inline the same LlmError→HTTP mapping.", "why_skipped": "Adopting the helper there is a pure DRY with no behavior change on working code; the sales-side duplication (this session's own output) was the one worth removing now.", "confidence_it_does_not_matter": "high", "opened_at": "2026-08-08T05:44:00Z", "outcome": "OPENED — optionally adopt llmErrorResponse in the C.A.R.E extension routes in a future DRY pass." }
]
```
