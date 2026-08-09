# CLOSURE

## What shipped
The Sales Coach streaming + progress win, mirrored to the **C.A.R.E AI Co-Pilot** — as a PURE DELIVERY change:
the co-pilot's prompt and output are byte-unchanged (C.A.R.E keeps its own care voice; the sales charisma rule
and the dash sanitizer were deliberately NOT imported, per the founder's constraint). The `/api/care/extension/copilot`
route gained a `text/event-stream` branch (`llmStream`, company-less like its non-stream call), the C.A.R.E
worker relays it over a `care-copilot-stream` Port with a shared refresh step, and the panel renders the reply
as it forms with a staged "Reading… / Drafting…" progress state. Only the `copilot` tool streams; every other
C.A.R.E tool is untouched. Full gate output + exit code in check.md.

## Un-named reliance (A35) — clauses this build leaned on but didn't headline
- **Company-less LLM path**: the C.A.R.E copilot route calls `generateCareReply` WITHOUT a companyId (grounding
  is injected as a prompt string, not via the brain), so the stream path uses `llmStream` directly — matching
  the non-stream dispatch exactly. If a future change made this route company-scoped, the stream would need
  `runBrainStream` (as sales does) or it would diverge.
- **Serverless stream lifetime**: `maxDuration = 60` (unchanged) covers the SSE `ReadableStream`; the worker's
  `getReader()` loop keeps the MV3 service worker alive for the stream's duration.
- **Only-copilot-streams invariant**: the other C.A.R.E tools' `.strict()` schemas would reject a `stream` key,
  and their client render branches are untouched — the mirror is scoped to the one tool by `tool.key === "copilot"`.

## Residuals
```json
[
  {
    "id": "R1-care-streaming-runtime-unverified",
    "item": "The C.A.R.E streaming path (content.js runCopilotStreaming + progress + fallback; background.js onConnect relay + SSE read) is RUNTIME-UNVERIFIED — no browser/Chrome APIs in the sandbox. Locked by source-wiring tests, not executed live.",
    "why_skipped": "The extension client can't run here; the established, documented posture for both extensions.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-08-09T10:15:00Z",
    "outcome": "OPENED — founder live-confirm: reload the C.A.R.E extension, run AI Co-Pilot, confirm (a) the reply visibly streams in, (b) the progress state shows while waiting, (c) the other C.A.R.E tools still work unchanged, (d) a stream failure still returns a reply (fallback)."
  }
]
```
