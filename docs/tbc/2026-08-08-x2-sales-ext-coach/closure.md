# CLOSURE — Sales Coach Extension, Phase 1b: coach-my-reply

## What shipped
The second sales tool: a text-in reply-coaching engine (`generateSalesReplyCoaching`) + route
(`POST /api/coach/extension/coach`). The rep's DRAFT reply is graded against the shared sales methodology —
strengths, improvements (each with the sales-principle WHY), a stronger revision of their OWN draft, and a
§3.3 guiding question. Reuses the shared extension guard, the shared LLM, the shared `methodologyBlock`, and
the injection fence.

## Un-named reliance (not self-evident)
- **SUBSTRATE, not a shippable end-feature.** No browser client posts to it yet (Phase 2). Do not report it
  as a live user feature until the client wires it.
- **The suggested revision rewrites the rep's OWN draft — it never fabricates.** The prompt forbids inventing
  a prospect fact, price, statistic, or commitment absent from the conversation/draft. Do not loosen this to
  "make it more compelling" — a fabricated prospect commitment is the §3.4 honesty breach the whole product
  exists to avoid.
- **One methodology source, reused not forked.** The engine grounds via `methodologyBlock` (exported from
  salesReviewPrompt) — the same Sales KB / corpus / starter the in-app sales review uses. Do not inline a
  second copy of sales principles here (§A21 one-mechanism).
- **Pattern is now locked across two tools** (dissect + coach): text-in engine mirroring the C.A.R.E text-in
  pattern, pure exported parser for the honesty contract, shared guard on the route. The remaining tools
  (co-pilot, summarize) follow it.

## Flagged, not fixed (§3.3)
- None new. Co-pilot (draft the reply) + summarize + the standalone CLIENT package are sequenced Phase 2,
  recorded in project memory, not skipped.

## Residual (A36)
```json
[
  { "id": "RES-01", "item": "No browser client posts to /api/coach/extension/coach yet — the human-facing seam is unwired.", "why_skipped": "Phase 1b is verifiable server substrate; the client package (manifest/panel/adapters, incl. a draft input box) is Phase 2, unverifiable in this no-browser sandbox. Building the client first would be dead surface.", "confidence_it_does_not_matter": "high", "opened_at": "2026-08-08T04:25:00Z", "outcome": "OPENED — Phase 2 builds the client package + wires a draft box to this route." },
  { "id": "RES-02", "item": "methodologyBlock() is called with no company-corpus override, so the extension coach grounds in the KB/starter, not a team's own saved corpus.", "why_skipped": "The corpus override needs a DB read keyed on the company; deferred to keep Phase 1b focused. The KB/starter is a correct, non-broken grounding (§3.4 degraded-not-broken); the override is a per-company personalization (§5) to add later.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-08T04:25:00Z", "outcome": "OPENED — pass the company corpus to methodologyBlock when the extension coach is personalized per team." }
]
```
