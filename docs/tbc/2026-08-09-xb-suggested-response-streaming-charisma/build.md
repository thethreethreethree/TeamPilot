# BUILD — Suggested Response streaming + progress + charismatic voice

### Shared suggest format module (A21 one mechanism)
- **write-path:** `src/lib/coach/extension/salesSuggestFormat.ts` — `REASONING_MARKER`, `reasoningInstruction()`,
  `splitReplyReasoning()` (pure split), `salesVoiceRule()` (charisma + no-dash), `stripAiDashes()`
  (deterministic dash sanitizer), `finalizeSuggestion()` (split + sanitize).
- **read-path:** both engines + the stream route import from here; `salesCopilot` re-exports the marker/split for
  existing importers. One source, so the streaming reader and both engines split + sanitize identically.
- **what:** the single wire-contract + voice + sanitizer for Suggested Response.
- **why:** formulate used JSON (un-streamable to a human); co-pilot used the marker — unifying lets one reader
  handle either, and puts the founder's voice + no-dash rules in one place so they can't drift.

### Engines — voice + finalize (quality untouched)
- **write-path:** `salesCopilot.ts` / `salesFormulate.ts` — both prompts now inject `salesVoiceRule()`; formulate
  switched from STRICT JSON to the marker format; both return `finalizeSuggestion(r.text)`. Added
  `buildSalesCopilotRequest` / `buildSalesFormulateRequest` (pure) so stream + non-stream assemble the prompt
  from one place.
- **read-path:** non-stream engine tests assert the prompts carry charisma + the no-dash rule and that the split
  handles marker/no-marker/marker-first; formulate's JSON→marker format asserted.
- **what:** same grounding + methodology (model/KB unchanged); only the voice, the output delimiter, and the
  finalize sanitizer changed.
- **why:** founder: charismatic, natural, no "---" — a prompt asks, the sanitizer guarantees. No quality cut.

### /suggest route — SSE stream branch
- **write-path:** `src/app/api/coach/extension/suggest/route.ts` — `stream:true` in the schema → a
  `text/event-stream` `ReadableStream` that yields content deltas via `streamSuggestDeltas` (companyId →
  `runBrainStream`; else `llmStream`), then a `done` event with `finalizeSuggestion(collected)`; empty →
  `error`. Non-stream JSON path unchanged.
- **read-path:** route test drives the SSE branch with a mocked `runBrainStream`, asserts delta events + a done
  event carrying the sanitized reply, and that the non-stream path is untouched.
- **what:** the server half of streaming, mirroring the briefing SSE pattern.
- **why:** stream the reply as it forms (perceived-speed fix) without changing what the engines produce.

### Worker — streaming Port relay
- **write-path:** `extension-sales/background.js` — `chrome.runtime.onConnect` for port `sales-suggest-stream`;
  `streamSalesSuggest` does token-load → fetch(`stream:true`) → one silent refresh+retry on 401 → reads the SSE
  body → `relaySalesSseEvent` posts delta/done/error to the panel. Extracted `refreshSalesAccessToken` so the
  JSON path (`withAuthRetry`) and the stream path share ONE refresh step.
- **read-path:** background-wiring test asserts the onConnect relay, the shared refresh, `stream:true`, the
  event types, and the SAME endpoint allowlist on the port.
- **what:** the CORS-free stream reader (a content-script fetch can't read a cross-origin stream body).
- **why:** MV3 single-response messaging can't stream; a Port can.

### Panel — progress floor + progressive render + fallback
- **write-path:** `extension-sales/content.js` — `startProgress` (staged "Reading… / Drafting…"); `runToolStreaming`
  connects the port, renders `stripDashesLive(replyBeforeMarker(acc))` as it forms, finalizes on done, and falls
  back to `runToolRequest` on connect-throw / error / disconnect; `runToolRequest` is the proven non-stream path
  now also showing the progress state. CSS: animated progress ellipsis + blinking caret, reduced-motion guarded.
- **read-path:** client-wiring test asserts the port connect, the marker split, the progress phases, the live
  dash-strip, and the fallback-to-runToolRequest on every failure edge.
- **what:** the rep sees an honest "working" state then the reply forming, never a dead spinner; streaming can't
  break the flow because it degrades to the proven request path.
- **why:** the founder's "it takes a long time" is a WAIT-experience problem; total time is set by the quality
  they want kept, so the fix is perceived-speed + honesty, not a faster (worse) model.
