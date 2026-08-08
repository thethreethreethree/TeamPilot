# BUILD — Suggested Response + conversation upload

### Suggested Response (merged action) — server
- **write-path:** `src/app/api/coach/extension/suggest/route.ts` — `{conversation, guidance?, lastSpeaker?}`;
  trimmed guidance non-empty → `generateSalesFormulate({intent: guidance})`, else
  `generateSalesCopilotReply({lastSpeaker})`. Guarded by `guardExtensionRequest` (schema). → `{reply, reasoning}`.
- **read-path:** `content.js renderResult(toolKey==="suggested")` renders reply + "Move"; `copyTextFor` returns
  the reply (not the reasoning). The panel points its one merged button here.
- **what:** dispatcher over the two existing, tested engines — behavior identical to the old buttons, surface merged.
- **why:** founder merged 3 buttons into 1 (2026-08-09); reuse avoids a new engine/prompt and keeps parity.

### Suggested Response — client (config + panel + worker)
- **write-path:** `extension-sales/config.js` SALES_TOOLS: one `suggested` tool → `/api/coach/extension/suggest`,
  `input.optional: true`. `content.js` run-guard exempts optional inputs (blank Run allowed).
  `background.js` sales-tool payload now forwards `guidance`.
- **read-path:** blank guidance reaches /suggest → co-pilot branch; typed guidance → formulate branch (proven by
  the suggest route test). The worker forward is guarded by the background-wiring test.
- **what:** the merged button + its optional guidance box, end-to-end reachable.
- **why:** without the worker forward + the optional-input exemption, the box would be dead config (A31).

### Upload conversation (file → text) — server
- **write-path:** `src/app/api/coach/extension/extract/route.ts` — multipart `file` → `extractText` (unpdf/jszip)
  → `{text, format, chars, truncated}`. Auth via `guardExtensionRequest` with NO schema (multipart), then
  `req.formData()`. 4MB cap + `formatFor` extension allowlist; errors mapped 400/413/415/422/500 (CWE-209).
- **read-path:** the returned `text` becomes the panel's `currentSelection` — the same input every tool consumes.
- **what:** the ingestion helper (no LLM) that lets a rep upload a chat export when the page can't be scanned.
- **why:** founder's PDF-upload flow; mirrors `coach/sales-session/extract` (A28) incl. its invariant allowlist.

### Upload conversation — client (worker multipart + panel)
- **write-path:** `content.js` "Upload conversation" button → hidden file input → `fileToBase64` → sends
  `{type:"sales-extract", endpoint, filename, mime, b64}`. `background.js` `sales-extract` handler rebuilds a
  FormData File and POSTs multipart (no Content-Type — fetch adds the boundary), via `salesExtractFetch`.
- **read-path:** on 2xx, `setSelection(data.text)` shows the preview + trims; 401 → "sign in + re-upload".
- **what:** the full base64→worker→multipart→extract→capture round-trip.
- **why:** a File can't cross `chrome.runtime.sendMessage`, so base64 in / rebuild in the worker.

### Shared guard reuse (drift-avoidance)
- **write-path:** `src/lib/api/extensionGuard.ts` — `schema` made OPTIONAL via overloads; no schema → run
  IP-guard + entitlement + per-user rate limit, return `body: null` (skip readBody). Existing callers (schema
  present) keep `body: T` unchanged.
- **read-path:** /extract calls it schema-less then reads formData itself; all existing tool routes unchanged.
- **why:** re-inlining the gate sequence in the multipart route is exactly the drift the guard was created to
  prevent (its own comment: "six copies drift").

### verification (A38)
- **write-path:** 5 test files added/updated (suggest route dispatch, extract validation, config-wiring tool
  count + reverse-drift, client-wiring optional-input, background-wiring guidance+extract). Invariant-audit
  allowlist entry for /extract (mirrors the sibling). `npm run check` exit 0 in check.md.
- **read-path:** superseded coach/copilot/formulate routes RETAINED (documented non-tool) not deleted — flagged.
