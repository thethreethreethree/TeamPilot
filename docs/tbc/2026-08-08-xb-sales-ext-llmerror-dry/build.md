# BUILD — DRY the LlmError→HTTP mapping across the 3 generative sales routes

## Doc integrity (§0.1)
```
$ sha256sum CLAUDE.md ThinkerThinker.md
e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f  CLAUDE.md
0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc  ThinkerThinker.md
```
Match DOC_MANIFEST.json; no governing-doc change, no AMD required.

## Change

### Shared LlmError→HTTP response helper
`src/lib/coach/extension/llmErrorResponse.ts` (new).

- **write-path:** `llmErrorResponse(err, {logTag, fallbackMessage})` — LlmError rate-limit → 429 (error+kind
  body), other LlmError → its status (default 502), non-LLM → a logged generic 502 with the fallback message.
  A line-for-line move of the inline blocks.
- **read-path:** the 3 generative routes call it from their catch; the mapping is unit-tested directly (4
  cases: rate-limit / other-LlmError / explicit-status / non-LLM+log).

### The three generative routes call the helper
`src/app/api/coach/extension/{summarize,copilot,formulate}/route.ts`.

- **write-path:** each catch's ~9-line inline block becomes a one-line `return llmErrorResponse(err, {...})`,
  and the now-unused `LlmError` import is swapped for the helper import (`NextResponse` stays — the success /
  empty-branch returns still use it).
- **read-path:** each route emits the identical status + body it did before; the route tests (429/402/empty/
  rate-limit→429/server→502/non-LLM→502) are unchanged and pass.

## Four-layer pre-walk (§1.5.1)
- **L1 structure:** one error-mapping helper, three thin call sites; the error taxonomy centralized. Cleaner.
- **L2 effect:** identical responses — same status, body, log; tested.
- **L3 continuity:** none (internal refactor).
- **L4 surface:** none.

## Verdict: SHIPPABLE
A behavior-preserving DRY extraction that centralizes the error taxonomy (one place to change if a new kind
or status mapping is ever needed), with the mapping test-locked; no external behavior change.

## Files
- `src/lib/coach/extension/llmErrorResponse.ts`
- `src/lib/coach/extension/__tests__/llmErrorResponse.test.ts`
- `src/app/api/coach/extension/summarize/route.ts`
- `src/app/api/coach/extension/copilot/route.ts`
- `src/app/api/coach/extension/formulate/route.ts`
