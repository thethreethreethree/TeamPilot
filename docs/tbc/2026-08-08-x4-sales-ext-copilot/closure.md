# CLOSURE — Sales Coach Extension, Phase 1d: co-pilot

## What shipped
The fourth and most powerful sales tool: a text-in co-pilot engine (`generateSalesCopilotReply`) + route
(`POST /api/coach/extension/copilot`). Given the conversation (and who spoke last), it drafts the rep's next
message to the prospect and names the sales move used, for the rep's learning. Reuses the shared extension
guard, the generic LLM, the shared sales methodology, the shared reply/follow-up mode selector, and the
C.A.R.E co-pilot's reply/reasoning marker convention.

## Un-named reliance (not self-evident)
- **SUBSTRATE, not a shippable end-feature.** No browser client posts to it yet (Phase 2). The client will
  add the "draft my reply" action + a paste-into-thread affordance + the `lastSpeaker` DOM signal.
- **Not control-window-gated, on purpose.** It acts on the rep's EXTERNAL conversation, not the team's
  internal event chain — the same decision as the C.A.R.E co-pilot (only the internal-chain writer, Spawn,
  carries that gate). Do not add the control gate here; it would be the wrong gate on the wrong surface.
- **The mode selector is REUSED, not re-implemented.** `copilotModeInstruction` is the same function the
  C.A.R.E co-pilot uses — an agent-last thread must produce a FOLLOW-UP, never a reply to the rep's own
  words. Do not fork it to swap "customer"→"prospect"; the logic is identical and one copy is the point (A21).
- **Empty draft is a 502, and a provider failure is 429/502 — never a blank reply.** Like summarize (and
  unlike dissect/coach's honest-empty), an outbound draft that failed must surface as an error, not as a
  blank message the rep might send.
- **The four tools now form a coherent set** (dissect / coach / summarize / co-pilot), sharing the guard +
  fence + methodology, with failure modes chosen per tool (read tools → honest-empty; generative tools →
  honest-error). The pattern is complete for the server side of Phase 1.

## Flagged, not fixed (§3.3)
- None new. The standalone CLIENT package (manifest/branding + `config.js` SALES_TOOLS + adapters/content +
  the `lastSpeaker` DOM signal) is Phase 2 — recorded in project memory, not skipped.

## Residual (A36)
```json
[
  { "id": "RES-01", "item": "No browser client posts to /api/coach/extension/copilot yet — the human-facing seam is unwired, including the lastSpeaker DOM signal that drives reply-vs-follow-up.", "why_skipped": "Phase 1d is verifiable server substrate; the client package (manifest/panel/adapters + the DOM lastSpeaker read) is Phase 2, unverifiable in this no-browser sandbox. The route already accepts lastSpeaker optionally, so the client can supply it without a server change.", "confidence_it_does_not_matter": "high", "opened_at": "2026-08-08T04:38:00Z", "outcome": "OPENED — Phase 2 builds the client + supplies lastSpeaker from the DOM per platform." },
  { "id": "RES-02", "item": "The draft is not grounded in the tenant product context (the C.A.R.E co-pilot passes getProductContextForTenant).", "why_skipped": "Deferred to keep Phase 1d focused; the sales methodology block is the load-bearing grounding here. A sales draft that must cite specific product capabilities/prices would benefit from product context — add it when the extension coach is product-aware.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-08T04:38:00Z", "outcome": "OPENED — add product context to the co-pilot prompt when drafts need product specifics." }
]
```
