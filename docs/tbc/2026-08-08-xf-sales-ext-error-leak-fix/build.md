# BUILD — what changed

## Production code
- **`src/lib/coach/extension/llmErrorResponse.ts`** — the LlmError branch now logs the real cause
  (`kind` + `provider` + `status` + `message` + first 500 chars of `rawBody`) server-side, and returns
  `{ error: opts.fallbackMessage, kind: err.kind }` instead of `{ error: err.message, kind }`. Status mapping
  unchanged (rate_limit → 429, else `err.status ?? 502`). Docstring rewritten to state the CWE-209 contract.
- **`src/app/api/coach/extension/summarize/route.ts`** — added `if (!summary) → 502` (logged) after a
  successful engine call, mirroring copilot/formulate. An empty model result is now surfaced as a failure,
  never a blank "caught up".

## Tests
- **`src/lib/coach/extension/__tests__/llmErrorResponse.test.ts`** — corrected the rate-limit test (it had
  LOCKED the leak by asserting `error === "slow down"`) to assert the generic fallbackMessage + preserved
  `kind` + that the cause is logged. Added a dedicated CWE-209 test: an LlmError carrying "DeepSeek …" +
  raw body → the response body contains NEITHER the vendor name NOR the raw detail, but the operator log does.
- **`src/app/api/coach/extension/__tests__/summarize.route.test.ts`** — added the empty-summary → 502 test.

## Not touched (deliberately — §1.5 / §5)
The 4 C.A.R.E extension routes carrying the identical inline leak. Flagged to the founder in closure.md with
the one-line fix each; not changed under the continuation guard without explicit go-ahead (shipping product).
