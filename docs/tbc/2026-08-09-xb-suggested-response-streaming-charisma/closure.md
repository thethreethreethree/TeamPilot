# CLOSURE

## What shipped
Three founder-driven changes to the Sales Coach "Suggested Response", all with the model, KB, and prompt
grounding left untouched (the founder was firm: no quality sacrifice for speed):
1. **Streaming** — the reply now forms word-by-word. `/suggest` gained a `text/event-stream` branch (mirroring
   the briefing SSE + `runBrainStream` pattern), the worker relays it over a `sales-suggest-stream` Port, and
   the panel renders it as it arrives.
2. **Honest progress state** — a staged "Reading the conversation… / Drafting your response…" indicator replaces
   the dead spinner, so the wait reads as active work.
3. **Charismatic, natural, no-dash voice** — a shared `salesVoiceRule()` centers charisma (the founder's core
   note) and forbids em/en/triple dashes, backed by a deterministic `stripAiDashes` sanitizer so the no-dash
   rule is guaranteed, not merely requested.

Streaming can never break the working flow: it degrades to the proven non-stream request path on any failure,
and the progress state is a pure-client floor. The full gate output + exit code is in check.md.

## Un-named reliance (A35) — clauses this build leaned on but didn't headline
- **Gate parity (runBrainStream vs the non-stream sales path)**: the stream path is only behavior-safe because
  `runBrainStream` gates on `guidanceEnabled` exactly as the non-stream `runBrainCall` does for the sales
  engines (which pass no `controlExempt`). Verified by reading both before wiring. If a future change made the
  sales non-stream path `controlExempt`, the stream path would need the same exemption or it would diverge.
- **Serverless stream lifetime**: the SSE `ReadableStream` runs inside the function; `maxDuration = 60` already
  covers it (unchanged). The worker's `getReader()` loop keeps the MV3 service worker alive for the stream's
  duration (a pending read is an active task) — the standard MV3 streaming assumption.
- **Formulate consumer set**: switching formulate from JSON to the marker format is safe because
  `generateSalesFormulate` / `parseFormulateReply` are consumed ONLY by the suggest route (verified) — the
  route's `{reply, reasoning}` contract is unchanged; only the internal delimiter moved.

## Residuals
```json
[
  {
    "id": "R1-streaming-runtime-unverified",
    "item": "The streaming path (content.js Port render + progress + fallback; background.js onConnect relay + SSE read) is RUNTIME-UNVERIFIED — no browser/Chrome APIs in the build sandbox. Locked by source-wiring tests, not executed live.",
    "why_skipped": "The extension client can't run here; the established, documented posture for both extensions.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-08-09T09:50:00Z",
    "outcome": "OPENED — founder live-confirm: (a) Suggested Response reply visibly streams in; (b) the staged progress text shows while waiting; (c) no em dashes appear in the final reply; (d) if the network/stream fails, the panel still returns a suggestion (fallback). The one genuinely new mechanism is the MV3 Port SSE relay; everything else mirrors the briefing stream + the working JSON tool path."
  },
  {
    "id": "R2-mirror-to-care",
    "item": "The streaming + progress + charismatic-voice improvements are sales-only. The C.A.R.E co-pilot shares generateCareReply and could get the same streaming/progress treatment, but its voice is service-philosophy-driven (not sales-charisma), so the voice rule must NOT be blindly ported.",
    "why_skipped": "Founder asked specifically about Sales Coach latency; C.A.R.E voice is a different personality (care, not sales charisma).",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-08-09T09:52:00Z",
    "outcome": "OPENED — propose to the founder: stream C.A.R.E co-pilot too (same perceived-speed win), but keep its care-voice; do not import salesVoiceRule."
  }
]
```
