# BUILD — Sales Coach Extension, Phase 1c: summarize

## Doc integrity (§0.1)
```
$ sha256sum CLAUDE.md ThinkerThinker.md
e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f  CLAUDE.md
0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc  ThinkerThinker.md
```
Match DOC_MANIFEST.json; no governing-doc change, no AMD required.

## Change

### Text-in sales summary engine
`src/lib/coach/extension/salesSummary.ts` (new).

- **write-path:** `generateSalesSummary({conversation, repName})` — builds `salesSummarySystemPrompt(repName)`
  (sales deal-state framing + WHO-IS-WHO anchor + `CONVERSATION_IS_DATA` fence), calls `generateCareReply`,
  returns the trimmed text. Does NOT catch — an `LlmError` propagates by design.
- **read-path:** the route returns `{ summary }`; `salesSummarySystemPrompt` is pure + exported so the
  framing, the no-fabrication rule, the anchor, and the fence are tested directly.

### Sales extension summarize route
`src/app/api/coach/extension/summarize/route.ts` (new).

- **write-path:** `POST /api/coach/extension/summarize` — `guardExtensionRequest` (IP → entitlement →
  per-user 20/min → zod `{conversation}`), best-effort rep-name lookup, then `generateSalesSummary`.
  EPHEMERAL.
- **read-path:** returns `{ summary }` (200), OR maps an `LlmError` to 429 (rate-limit) / its status (502) —
  never a false-empty summary. The route test asserts 429/402 short-circuit, success pass-through, and the
  rate_limit→429 / server→502 / non-LLM→502 mapping.

## Four-layer pre-walk (§1.5.1)
- **L1 structure:** reuses the guard, the generic LLM, the fence; mirrors the Phase 1a/1b shape but with the
  deliberate error-surfacing contract. Sound.
- **L2 effect:** invoked as the extension will (conversation), returns a grounded deal-state read, or a
  correct error status; tests drive both. Works.
- **L3 continuity:** SERVER substrate; the rep-facing flow (panel "catch me up" → this route → rendered
  summary) completes in the client phase.
- **L4 surface:** N/A this phase; client is Phase 2, selectors unverifiable in sandbox. Deferred, not faked.

## Verdict: SHIPPABLE-WITH-FOLLOWUP
Server substrate complete, tested, gated (L1/L2 pass), with the honest-error contract locked. L3/L4 complete
in the client phase; honestly labeled substrate.

## Files
- `src/lib/coach/extension/salesSummary.ts`
- `src/lib/coach/extension/__tests__/salesSummary.test.ts`
- `src/app/api/coach/extension/summarize/route.ts`
- `src/app/api/coach/extension/__tests__/summarize.route.test.ts`
