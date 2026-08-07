# BUILD — Sales Coach Extension, Phase 1d: co-pilot

## Doc integrity (§0.1)
```
$ sha256sum CLAUDE.md ThinkerThinker.md
e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f  CLAUDE.md
0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc  ThinkerThinker.md
```
Match DOC_MANIFEST.json; no governing-doc change, no AMD required.

## Change

### Text-in sales co-pilot engine
`src/lib/coach/extension/salesCopilot.ts` (new).

- **write-path:** `generateSalesCopilotReply({conversation, repName, lastSpeaker})` builds
  `salesCopilotSystemPrompt` (shared `methodologyBlock` + rep drafting-identity + the reused
  `copilotModeInstruction` reply/follow-up selector + `CONVERSATION_IS_DATA` fence), calls `generateCareReply`,
  and splits the output via the pure `splitReplyReasoning`. Does NOT catch — LlmError propagates.
- **read-path:** the route returns `{reply, reasoning}`; `splitReplyReasoning` + `salesCopilotSystemPrompt`
  are pure + exported so the split edge-cases, the mode switch, the anchor, the no-fabrication rule, and the
  fence are tested directly.

### Sales extension co-pilot route
`src/app/api/coach/extension/copilot/route.ts` (new).

- **write-path:** `POST /api/coach/extension/copilot` — `guardExtensionRequest` (IP → entitlement → per-user
  20/min → zod `{conversation, lastSpeaker?}`), best-effort rep-name lookup, then `generateSalesCopilotReply`.
  EPHEMERAL; not control-gated (external conversation).
- **read-path:** returns `{reply, reasoning}` (200); an empty draft → 502; an `LlmError` → 429 (rate-limit) /
  502. The route test asserts 429/402 short-circuit, the {reply,reasoning}+rep+lastSpeaker threading, the
  empty-draft-502, and the rate_limit→429 / server→502 / non-LLM→502 mapping.

## Four-layer pre-walk (§1.5.1)
- **L1 structure:** reuses the guard, the LLM, the shared methodology block, the shared mode selector, the
  fence, and the C.A.R.E co-pilot's reply/reasoning-marker convention. Sound.
- **L2 effect:** invoked as the extension will (conversation + lastSpeaker), returns a mode-correct draft +
  the named move, or a correct error; tests drive both. Works.
- **L3 continuity:** SERVER substrate; the rep-facing flow (panel "draft my reply" with a paste-into-thread
  action → this route → rendered draft) completes in the client phase.
- **L4 surface:** N/A this phase; client is Phase 2, selectors unverifiable in sandbox. Deferred, not faked.

## Verdict: SHIPPABLE-WITH-FOLLOWUP
Server substrate complete, tested, gated (L1/L2 pass), with the mode + honest-error contracts locked. L3/L4
complete in the client phase; honestly labeled substrate.

## Files
- `src/lib/coach/extension/salesCopilot.ts`
- `src/lib/coach/extension/__tests__/salesCopilot.test.ts`
- `src/app/api/coach/extension/copilot/route.ts`
- `src/app/api/coach/extension/__tests__/copilot.route.test.ts`
