# BUILD — Sales Coach Extension, Phase 1b: coach-my-reply

## Doc integrity (§0.1)
```
$ sha256sum CLAUDE.md ThinkerThinker.md
e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f  CLAUDE.md
0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc  ThinkerThinker.md
```
Match DOC_MANIFEST.json; no governing-doc change, no AMD required.

## Change

### Text-in sales reply-coaching engine
`src/lib/coach/extension/salesReplyCoach.ts` (new).

- **write-path:** `generateSalesReplyCoaching({conversation, draft, repName})` — guards a trivial draft
  (<10 chars → EMPTY), composes a CONVERSATION + DRAFT user message, builds
  `salesReplyCoachSystemPrompt(repName)` (shared `methodologyBlock` + WHO-IS-WHO anchor +
  `CONVERSATION_IS_DATA` fence), calls `dissectCoachV5`, parses via `parseSalesReplyCoaching`. Never throws.
- **read-path:** the route returns the `SalesReplyCoaching`; `parseSalesReplyCoaching` is pure + exported so
  the structural-honesty degrade (no assessment + no improvement + no revision → EMPTY) is tested directly.

### Sales extension coach route
`src/app/api/coach/extension/coach/route.ts` (new).

- **write-path:** `POST /api/coach/extension/coach` — `guardExtensionRequest` (IP → entitlement → per-user
  30/min → zod `{conversation, draft}`), best-effort rep-name lookup, then `generateSalesReplyCoaching`.
  EPHEMERAL.
- **read-path:** returns `{ coaching }` (200) — hasSignal:true with the graded read, or hasSignal:false
  honest-empty. The route test asserts 429/402 short-circuit before the engine and that conversation, draft,
  and rep name are threaded in.

## Four-layer pre-walk (§1.5.1)
- **L1 structure:** reuses the guard, the LLM, the shared methodology block, the fence; mirrors the Phase 1a
  engine/route shape. Sound.
- **L2 effect:** invoked as the extension will (conversation + draft), returns a grounded graded read; tests
  drive gate ordering + pass-through. Works.
- **L3 continuity:** SERVER substrate; the rep-facing flow (draft box in panel → this route → rendered
  coaching) completes in the client phase. The seam it exposes is exactly what the client will call.
- **L4 surface:** N/A this phase (no UI); the browser client is Phase 2, selectors unverifiable in sandbox.
  Explicitly deferred, not faked.

## Verdict: SHIPPABLE-WITH-FOLLOWUP
Server substrate complete, tested, gated (L1/L2 pass). L3/L4 complete in the client phase; honestly labeled
substrate, not an end-feature.

## Files
- `src/lib/coach/extension/salesReplyCoach.ts`
- `src/lib/coach/extension/__tests__/salesReplyCoach.test.ts`
- `src/app/api/coach/extension/coach/route.ts`
- `src/app/api/coach/extension/__tests__/coach.route.test.ts`
