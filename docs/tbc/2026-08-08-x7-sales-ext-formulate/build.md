# BUILD — Sales Coach Extension, Phase 1e: formulate

## Doc integrity (§0.1)
```
$ sha256sum CLAUDE.md ThinkerThinker.md
e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f  CLAUDE.md
0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc  ThinkerThinker.md
```
Match DOC_MANIFEST.json; no governing-doc change, no AMD required.

## Change

### Text-in sales formulate engine
`src/lib/coach/extension/salesFormulate.ts` (new).

- **write-path:** `generateSalesFormulate({conversation, intent, repName})` builds `salesFormulateSystemPrompt`
  (shared `methodologyBlock` + rep shaping-identity + `CONVERSATION_IS_DATA` fence), calls `generateCareReply`,
  and parses via the pure `parseFormulateReply` (coerceJsonText + raw-text fallback). Does NOT catch.
- **read-path:** the route returns `{reply, reasoning}`; `parseFormulateReply` + `salesFormulateSystemPrompt`
  are pure + exported so the fence-survival, the non-JSON fallback, the empty-reply case, and the grounding
  rule are tested directly.

### Sales extension formulate route + tool wiring
`src/app/api/coach/extension/formulate/route.ts` (new); `extension-sales/config.js` (+1 tool).

- **write-path:** `POST /api/coach/extension/formulate` — `guardExtensionRequest` (IP → entitlement → per-user
  20/min → zod `{conversation, intent}`, sales productLabel), rep-name lookup, then `generateSalesFormulate`.
  `SALES_TOOLS` gains a `formulate` entry with an `intent` input.
- **read-path:** returns `{reply, reasoning}` (200); empty reply → 502; `LlmError` → 429/502. The route test
  asserts the gate ordering, the threading, the empty-reply-502, and the error mapping. The EXISTING drift
  guard now asserts the new endpoint maps to this route (no dead tool).

## Four-layer pre-walk (§1.5.1)
- **L1 structure:** reuses the guard, the LLM, the methodology, the fence, and the JSON-coercion helper;
  mirrors the co-pilot shape. Sound.
- **L2 effect:** invoked as the extension will (conversation + intent), returns a shaped message or a correct
  error; tests drive both. Works.
- **L3 continuity:** SERVER substrate; the rep-facing flow (panel intent box → this route → rendered message)
  completes in the client phase.
- **L4 surface:** the tool label/desc + the intent-input placeholder are set; the panel is Phase 2b.

## Verdict: SHIPPABLE-WITH-FOLLOWUP
Server substrate complete, tested, gated; the new tool is drift-guarded to its route. L3/L4 complete in the
client phase; honestly labeled substrate.

## Files
- `src/lib/coach/extension/salesFormulate.ts`
- `src/lib/coach/extension/__tests__/salesFormulate.test.ts`
- `src/app/api/coach/extension/formulate/route.ts`
- `src/app/api/coach/extension/__tests__/formulate.route.test.ts`
- `extension-sales/config.js`
