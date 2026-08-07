# CLOSURE — Sales Coach Extension, Phase 1e: formulate

## What shipped
The fifth sales tool: a text-in formulate engine (`generateSalesFormulate`) + route
(`POST /api/coach/extension/formulate`), plus the `formulate` entry in `SALES_TOOLS`. The rep supplies their
INTENT (what they want to get across) and the tool shapes it into a sales-effective message + names the move.
Reuses the shared extension guard, the generic LLM, the shared sales methodology, the shared JSON coercion,
and the injection fence.

## Un-named reliance (not self-evident)
- **Formulate ≠ co-pilot, and that distinction is the point.** Co-pilot decides WHAT to say from the
  conversation; formulate phrases what the rep ALREADY decided to say. Do not collapse them — they serve
  different moments (AI-initiative vs rep-initiative).
- **It shapes the intent; it does not judge it.** The prompt is explicit ("shaping their intent, NOT
  judging"). This is the mirror-not-verdict stance — do not turn formulate into a critique of the rep's plan.
- **SUBSTRATE, not a shippable end-feature.** No browser panel posts to it yet (Phase 2b). But it is NOT a
  dead button: the drift guard binds the new `SALES_TOOLS` endpoint to this route, so adding the tool to the
  config could not ship pointing at nothing.
- **Non-JSON never errors the rep out.** `parseFormulateReply` falls back to raw text as the reply
  (coerceJsonText handles a ```json fence first); the route then guards emptiness (502). A formatting slip
  yields the rep's message, not an error — but a truly empty shape is an honest 502, never a blank send.

## Flagged, not fixed (§3.3)
- None new. The browser client (Phase 2b) now needs to render 5 tools (dissect/coach/summarize/copilot/
  formulate); coach + formulate carry an input field (draft / intent). Recorded in the README + memory.

## Residual (A36)
```json
[
  { "id": "RES-01", "item": "No browser panel posts to /api/coach/extension/formulate yet — the human-facing seam is unwired.", "why_skipped": "Phase 1e is verifiable server substrate; the client panel (which must render the formulate intent input) is Phase 2b, unverifiable in this no-browser sandbox. The drift guard already binds the tool to its route so it is not a dead button.", "confidence_it_does_not_matter": "high", "opened_at": "2026-08-08T05:06:00Z", "outcome": "OPENED — Phase 2b renders the 5 tools incl. the formulate intent box." }
]
```
