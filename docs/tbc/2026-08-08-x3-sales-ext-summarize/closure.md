# CLOSURE — Sales Coach Extension, Phase 1c: summarize

## What shipped
The third sales tool: a text-in summary engine (`generateSalesSummary`) + route
(`POST /api/coach/extension/summarize`). A rep re-opening a prospect thread gets a short, honest read of
where the deal stands (what they want / what's been offered / the objection / the next step). Reuses the
shared extension guard, the generic text-out LLM, and the injection fence.

## Un-named reliance (not self-evident)
- **SUBSTRATE, not a shippable end-feature.** No browser client posts to it yet (Phase 2).
- **This engine surfaces errors; it does NOT swallow to empty — on purpose.** Dissect and coach degrade to
  honest-EMPTY because "no signal" is an acceptable read. A summary is different: an empty summary reads as
  "nothing to summarize", which is a lie when the truth is "the provider failed". So `generateSalesSummary`
  lets the `LlmError` propagate and the route maps it to 429/502. Do not "make it consistent" with dissect by
  catching-to-empty here — that would trade an honest error for a false silence (§3.4). This matches the
  C.A.R.E summarize route.
- **The three tools now share the guard + fence but differ correctly in failure mode.** dissect/coach →
  honest-empty; summarize → honest-error. The difference is intentional and tested, not an inconsistency.

## Flagged, not fixed (§3.3)
- None new. Co-pilot (draft the reply — may be control-gated) + the standalone CLIENT package are Phase 2,
  recorded in project memory, not skipped.

## Residual (A36)
```json
[
  { "id": "RES-01", "item": "No browser client posts to /api/coach/extension/summarize yet — the human-facing seam is unwired.", "why_skipped": "Phase 1c is verifiable server substrate; the client package (manifest/panel/adapters) is Phase 2, unverifiable in this no-browser sandbox. Building the client first would be dead surface.", "confidence_it_does_not_matter": "high", "opened_at": "2026-08-08T04:32:00Z", "outcome": "OPENED — Phase 2 builds the client package + wires a 'catch me up' button to this route." },
  { "id": "RES-02", "item": "Summary is not grounded in the tenant product context (the C.A.R.E summarize passes getProductContextForTenant).", "why_skipped": "The sales summary is a deal-STATE read of the thread, not a product-grounded reply, so product context is less load-bearing here than for the coach/reply tool; deferred to keep the tool focused. Add it if summaries need product framing.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-08T04:32:00Z", "outcome": "OPENED — add product context to the summary prompt if deal summaries need it." }
]
```
