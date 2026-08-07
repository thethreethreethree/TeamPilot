# BUILD — Sales Coach Extension, Phase 1a: text-in sales dissect

## Doc integrity (§0.1)
```
$ sha256sum CLAUDE.md ThinkerThinker.md
e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f  CLAUDE.md
0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc  ThinkerThinker.md
```
Match DOC_MANIFEST.json; no governing-doc change, no AMD required.

## Change

### Text-in sales dissect engine
`src/lib/coach/extension/salesTextDissect.ts` (new).

- **write-path:** `generateSalesTextDissect({sourceText, repName})` — guards sparse input (<40 chars →
  EMPTY), builds `salesTextDissectSystemPrompt(repName)` (sales framing + WHO-IS-WHO anchor +
  `CONVERSATION_IS_DATA` fence), calls the shared `dissectCoachV5`, and parses via `parseSalesTextDissect`.
  Never throws — EMPTY on failure, with the cause logged.
- **read-path:** the route below consumes the returned `SalesTextDissect`; `parseSalesTextDissect` is pure +
  exported so the grounding contract is tested directly (a strength whose excerpt is not in the source is
  dropped; nothing-grounded-and-no-summary → EMPTY).

### Sales extension dissect route
`src/app/api/coach/extension/dissect/route.ts` (new).

- **write-path:** `POST /api/coach/extension/dissect` — `guardExtensionRequest` (IP guard → entitlement →
  per-user rate limit → zod `{conversation}`), best-effort rep-name lookup, then `generateSalesTextDissect`.
  EPHEMERAL — nothing stored.
- **read-path:** returns `{ dissect }` (200) — hasSignal:true with the read, or hasSignal:false honest-empty.
  The route test asserts 429/402 short-circuit before the engine, the rep name is threaded in, and the
  honest-empty shape passes through.

## Four-layer pre-walk (§1.5.1)
- **L1 structure:** reuses the guard, the LLM, the fence, the source cap; new files mirror the proven C.A.R.E
  text-in engine + route. Sound.
- **L2 effect:** invoked as the extension will (text-in), the route returns a grounded sales read; tests drive
  the gate ordering + pass-through. Works.
- **L3 continuity:** this is the SERVER substrate; the rep-facing flow (panel → this route → rendered read)
  completes in the client phase. Within scope, the seam it exposes is exactly what the client will call.
- **L4 surface:** N/A this phase — no UI yet; the browser client (manifest/panel/adapters) is Phase 2, and its
  selectors are unverifiable in this sandbox. Explicitly deferred, not faked.

## Verdict: SHIPPABLE-WITH-FOLLOWUP
The server substrate is complete, tested, and gated (L1/L2 pass). L3/L4 complete when the client phase ships;
this phase is the verifiable foundation it rests on, and is honestly labeled substrate — not an end-feature.

## Files
- `src/lib/coach/extension/salesTextDissect.ts`
- `src/lib/coach/extension/__tests__/salesTextDissect.test.ts`
- `src/app/api/coach/extension/dissect/route.ts`
- `src/app/api/coach/extension/__tests__/dissect.route.test.ts`
