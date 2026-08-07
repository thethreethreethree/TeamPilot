# CLOSURE

## What shipped
The sales extension's generative error path no longer leaks raw provider detail to the client (CWE-209) and
logs the real cause server-side; the summarize route no longer emits a false-empty "caught up". Both locked
by tests.

## Residuals — founder-gated
1. **The 4 C.A.R.E extension routes carry the identical `err.message` leak** (inline, never adopted the shared
   helper): `care/extension/summarize/route.ts`, `copilot/route.ts`, `formulate/route.ts`, `coach/route.ts`.
   The clean fix is to point them at `llmErrorResponse` (which now also lives correctly) — one edit each,
   mechanical, and it removes the duplication the helper's docstring was created to prevent. Held for founder
   go-ahead because it changes the shipping C.A.R.E product; I will not rewrite it under the continuation
   guard without an explicit yes.
2. **Client `kind` usage:** the sales content.js does not yet branch on `data.kind` (e.g. a distinct
   "AI is busy, try again" on rate_limit). Low value; the status code already drives correct behavior.

## Un-named reliance (the half that's easy to skip)
- This fix relies on `err.message` / `err.rawBody` being the ONLY carriers of raw provider text — if a future
  `LlmError` subclass adds another raw field and a route returns it, the leak reopens. The chokepoint
  (`llmErrorResponse`) is the defense; any NEW generative extension route must route errors through it, not
  hand-roll a response. (No invariant enforces "generative extension routes must use llmErrorResponse" — that
  remains a discipline, not a guard. A candidate future INV if a third such route appears and hand-rolls.)
- The CWE-209 test asserts absence of two specific strings ("DeepSeek", "internal detail"); it is a
  representative check, not a proof that no provider string can ever appear. The structural guarantee is that
  the response `error` is `opts.fallbackMessage` — a constant — which the test also asserts.
