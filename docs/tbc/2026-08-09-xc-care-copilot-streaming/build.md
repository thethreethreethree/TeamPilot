# BUILD — C.A.R.E AI Co-Pilot: streaming + progress (care voice unchanged)

### C.A.R.E co-pilot route — SSE stream branch
- **write-path:** `src/app/api/care/extension/copilot/route.ts` — `stream:true` in the schema → a
  `text/event-stream` `ReadableStream` yielding content deltas via `llmStream` (company-less, matching the
  non-stream `generateCareReply` call here), then a `done` event with the marker-split `{reply, reasoning}`;
  empty → `error`. `systemPrompt` + `userMessage` hoisted so both deliveries send the identical prompt. NO
  sanitizer / voice change.
- **read-path:** copilot.route test drives the SSE branch with a mocked `llmStream`, asserts delta events + a
  done event carrying the split reply, and that the non-stream engine is NOT called on the stream path.
- **what:** the server half of streaming for the C.A.R.E co-pilot.
- **why:** founder chose to mirror the sales perceived-speed win to C.A.R.E; company-less path → `llmStream`.

### C.A.R.E worker — streaming Port relay
- **write-path:** `extension/background.js` — `chrome.runtime.onConnect` for port `care-copilot-stream`;
  `streamCareCopilot` does token-load → fetch(`stream:true`) → one silent refresh+retry on 401 → reads the SSE
  body → `relayCareSseEvent` posts delta/done/error. Extracted `refreshCareAccessToken` so `careFetch` and the
  stream path share ONE refresh step. Same `ALLOWED_ENDPOINT` gate on the port.
- **read-path:** extensionWorker test asserts the onConnect relay, the shared refresh, `stream:true`, the event
  types, the SSE read, and the endpoint allowlist on the port.
- **what:** the CORS-free stream reader for C.A.R.E (a content-script fetch can't read a cross-origin stream).
- **why:** MV3 single-response messaging can't stream; a Port can. Mirrors the sales worker.

### C.A.R.E panel — progress + progressive render + fallback (copilot only)
- **write-path:** `extension/content.js` — `startProgressCare` (staged "Reading… / Drafting…"),
  `replyBeforeMarkerCare`, and `runCopilotStreaming` (connect the port, render the forming reply, finalize via
  `renderResult` on done, fall back to `runTool(tool, undefined, true)` on connect-throw / error / disconnect).
  `runTool` gained a `noStream` param; only `tool.key === "copilot"` takes the stream branch — every other tool
  is unchanged.
- **read-path:** extensionWorker test (content.js half) asserts the port connect, the marker, the progress
  phases, and the fallback-to-request-path on failure.
- **what:** the rep sees the co-pilot reply forming with an honest progress state; streaming can't break the
  flow because it degrades to the proven request path (which renders the result OR the real error).
- **why:** mirror the sales UX to C.A.R.E while keeping C.A.R.E's own care voice and its other tools intact.
