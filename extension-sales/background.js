// Sales Coach extension — background service worker.
//
// Ported from ../extension/background.js (the C.A.R.E extension) and adapted for sales: the RCD-capture and
// image-permission handlers are DROPPED (the sales extension has only the 4-5 text tools, no conversation
// capture), the message types and storage keys are the sales ones, and the tool-endpoint allowlist is the
// coach namespace. Same architecture: the on-page panel sends "sales-tool" here and the worker (which holds
// host_permissions, so its fetch bypasses CORS — a content-script fetch cannot) calls the API and handles
// token refresh.
//
// ⚠️ RUNTIME-UNVERIFIED (no browser in the build sandbox). Structurally parity-checked against the working
// C.A.R.E worker; every Chrome-API path must be confirmed LIVE by the founder — same posture as the C.A.R.E
// client's adapters/worker.

// Toolbar-icon click → inject (or toggle) the on-page panel. config.js first so content.js can reuse its
// helpers (shared isolated world). activeTab grants one-time host access on this click, so no broad
// permission is needed. Some pages (chrome://, the Web Store, PDFs) disallow injection — swallow that.
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.id) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["config.js", "adapters.js", "content.js"],
    });
  } catch (e) {
    console.debug("Sales Coach: cannot open panel on this page", e?.message);
  }
});

// WHY the tool calls live HERE, not in the content script: a content-script fetch runs in the page's context
// and is subject to CORS — host_permissions does NOT grant the CORS bypass to content scripts, only to the
// service worker. So the panel sends "sales-tool" here; the worker holds the token, calls the API, refreshes.
const ALLOWED_ENDPOINT = /^\/api\/coach\/extension\/[a-z]+$/; // no arbitrary paths/hosts (defence in depth)

async function readJson(res) {
  // Read the body ONCE as text, then try JSON. On a framework error (500/504) the body is an HTML/text page,
  // not our JSON {error} — capture a snippet as `_nonjson` so the panel/console can show the REAL cause instead
  // of a generic "something went wrong". (res.json() would consume the body and lose it on a parse failure.)
  const text = await res.text().catch(() => "");
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { _nonjson: text.slice(0, 300) };
  }
}

// Silent refresh of the access token, shared by the JSON/upload path (withAuthRetry) AND the streaming path so
// the 401→refresh logic lives in ONE place (re-inlining it per call site is exactly how the two drift). Returns
// the new access token on success, or null — and on a hard failure clears the session so the panel shows Sign
// in and the badge drops. `currentRefresh` is the refresh token we hold; a successful refresh may rotate it.
async function refreshSalesAccessToken(base, currentRefresh) {
  if (!currentRefresh) return null;
  try {
    const rr = await fetch(base + "/api/coach/extension/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: currentRefresh }),
    });
    if (rr.ok) {
      const rd = await rr.json().catch(() => ({}));
      if (rd.access_token) {
        await chrome.storage.local.set({
          salesCoachToken: rd.access_token,
          salesCoachRefreshToken: rd.refresh_token || currentRefresh,
        });
        return rd.access_token;
      }
      return null;
    }
    // Refresh itself failed → the session is truly gone; clear so the panel shows Sign in, drop the badge.
    await chrome.storage.local.remove(["salesCoachToken", "salesCoachRefreshToken"]);
    chrome.action.setBadgeText({ text: "" });
    return null;
  } catch {
    return null; // network hiccup on refresh; caller leaves the 401 to surface Sign in
  }
}

// Shared token load + silent one-shot refresh-retry around a caller-provided `call(base, token)`. Both the JSON
// tool path and the multipart upload path go through this, so the 401→refresh→retry logic lives in ONE place.
// Runs in the CORS-free worker context.
// Readable host (a dev-server host, or "elostate.com") from a base URL, for actionable network errors.
function hostLabel(base) {
  try {
    return new URL(base).host;
  } catch {
    return String(base || "");
  }
}

async function withAuthRetry(call) {
  const { salesCoachToken, salesCoachRefreshToken, apiBase } = await chrome.storage.local.get([
    "salesCoachToken",
    "salesCoachRefreshToken",
    "apiBase",
  ]);
  const base = apiBase || "https://elostate.com";
  try {
    let out = await call(base, salesCoachToken);
    if (out.status === 401 && salesCoachRefreshToken) {
      const fresh = await refreshSalesAccessToken(base, salesCoachRefreshToken);
      if (fresh) out = await call(base, fresh);
    }
    return out;
  } catch {
    // The fetch never reached a server (offline, DNS, connection refused, or a stale `apiBase` dev override whose
    // local server isn't running). Name the host + whether a custom override is in play so the panel shows an
    // ACTIONABLE failure instead of a mystery "network" (an honest failure the user can act on). This is
    // the exact confusion that made a stale local-dev override look like an outage.
    return { status: 0, data: { error: "network", host: hostLabel(base), custom: !!apiBase } };
  }
}

// JSON tool call (summarize/dissect/suggest).
async function salesFetch(endpoint, payload) {
  return withAuthRetry(async (base, token) => {
    const res = await fetch(base + endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    return { status: res.status, data: await readJson(res) };
  });
}

// Multipart file call — the conversation-upload path (server extracts the text). A File cannot cross
// chrome.runtime.sendMessage, so the panel base64-encodes the bytes and we rebuild them into a FormData File
// here. Do NOT set Content-Type — fetch adds the multipart boundary itself; setting it breaks the upload.
async function salesExtractFetch(endpoint, filename, mime, b64) {
  return withAuthRetry(async (base, token) => {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const form = new FormData();
    form.append("file", new File([bytes], filename || "conversation", { type: mime || "application/octet-stream" }));
    const res = await fetch(base + endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    return { status: res.status, data: await readJson(res) };
  });
}

// ── Streaming Suggested Response ─────────────────────────────────────────────────────────────────────────
// A chrome.runtime.sendMessage is single-response, so streaming uses a long-lived Port instead: the panel
// connects "sales-suggest-stream", posts {type:"start", …}, and we relay each SSE event back as a port message
// (delta → append to the forming reply; done → final split; error → panel falls back to the non-stream path).
// WHY here and not the content script: same reason as the JSON tools — a content-script fetch is subject to
// CORS; only the worker (holding host_permissions) can read the cross-origin stream body.

// Parse ONE SSE event block ("event: X\ndata: {json}") and relay it to the panel as a typed port message.
function relaySalesSseEvent(rawEvent, port) {
  let event = "message";
  let data = "";
  for (const line of rawEvent.split("\n")) {
    const t = line.replace(/^\s+/, "");
    if (t.startsWith("event:")) event = t.slice(6).trim();
    else if (t.startsWith("data:")) data += t.slice(5).trim();
  }
  if (!data) return;
  let parsed;
  try {
    parsed = JSON.parse(data);
  } catch {
    return; // skip a malformed event
  }
  if (event === "delta") safePost(port, { type: "delta", text: String(parsed.text || "") });
  else if (event === "done") safePost(port, { type: "done", reply: parsed.reply, reasoning: parsed.reasoning });
  else if (event === "error") safePost(port, { type: "error", error: parsed.error, kind: parsed.kind });
}

// Post to a Port that may already be disconnected (the rep closed/minimized the panel mid-stream) without
// throwing — review Finding 1.1 Consequence B: a raw postMessage to a dead port throws, and the throw cascaded
// through the reader's catch into a second/third throw. A closed port just means nobody's listening; no-op.
function safePost(port, msg) {
  try {
    port.postMessage(msg);
  } catch {
    /* port closed — nobody listening */
  }
}

async function streamSalesSuggest(endpoint, payload, port) {
  const { salesCoachToken, salesCoachRefreshToken, apiBase } = await chrome.storage.local.get([
    "salesCoachToken",
    "salesCoachRefreshToken",
    "apiBase",
  ]);
  const base = apiBase || "https://elostate.com";
  // Cancel the upstream LLM stream if the rep closes/minimizes the panel mid-generation (review Finding 1.1):
  // without this the worker keeps reading the SSE body to EOF and the server keeps generating — real wasted
  // metered AI spend for output no one will see. onDisconnect → abort the fetch → reader.read() rejects → we
  // stop. `aborted` also suppresses the terminal error-post / disconnect (the client is already gone).
  const controller = new AbortController();
  let aborted = false;
  port.onDisconnect.addListener(() => {
    aborted = true;
    try {
      controller.abort();
    } catch {
      /* already aborted */
    }
  });
  const doFetch = (tok) =>
    fetch(base + endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        Authorization: `Bearer ${tok}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

  let res;
  try {
    res = await doFetch(salesCoachToken);
    // A 401 comes back as the response status BEFORE the body streams, so we can silently refresh + retry once
    // here (a mid-stream 401 is not a thing). Same one-shot refresh the JSON path uses.
    if (res.status === 401 && salesCoachRefreshToken) {
      const fresh = await refreshSalesAccessToken(base, salesCoachRefreshToken);
      if (fresh) res = await doFetch(fresh);
    }
  } catch {
    if (!aborted) safePost(port, { type: "error", status: 0, error: "network" });
    return;
  }
  if (aborted) return; // rep closed the panel during the fetch/refresh — nothing to stream to

  if (res.status === 401) {
    safePost(port, { type: "error", status: 401, error: "Your session expired." });
    return;
  }
  if (!res.ok || !res.body) {
    // Non-2xx or no stream body → surface the status; the panel falls back to the non-stream request, which
    // renders the real error (§3.4 honesty — never a silent empty).
    const snippet = await res.text().catch(() => "");
    safePost(port, { type: "error", status: res.status, error: snippet.slice(0, 300) || `HTTP ${res.status}` });
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      if (aborted) break; // rep closed/minimized mid-stream → stop reading (the fetch is already aborting)
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf("\n\n")) !== -1) {
        relaySalesSseEvent(buffer.slice(0, idx), port);
        buffer = buffer.slice(idx + 2);
      }
    }
    if (!aborted && buffer.trim()) relaySalesSseEvent(buffer, port); // flush a trailing event, no final blank line
  } catch {
    if (!aborted) safePost(port, { type: "error", error: "stream interrupted" });
  } finally {
    // Terminal guarantee: when the reader loop ends for ANY reason — normal done, a throw, OR a clean EOF where
    // the server was killed before emitting done (e.g. the 60s function cap) — disconnect the port so the
    // panel's onDisconnect fires. Skipped when `aborted` (the client already disconnected, so this would only
    // throw). If the client already got done + disconnected, this is a harmless no-op.
    if (!aborted) {
      try {
        port.disconnect();
      } catch {
        /* already gone */
      }
    }
  }
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "sales-suggest-stream") return;
  port.onMessage.addListener((message) => {
    if (!message || message.type !== "start") return;
    // Same endpoint allowlist as the JSON path — never a caller-supplied URL/host (open-proxy hygiene).
    if (typeof message.endpoint !== "string" || !ALLOWED_ENDPOINT.test(message.endpoint)) {
      safePost(port, { type: "error", status: 400, error: "Unknown tool." });
      return;
    }
    const payload = { conversation: String(message.conversation || ""), stream: true };
    if (typeof message.guidance === "string" && message.guidance) payload.guidance = message.guidance;
    if (message.lastSpeaker === "agent" || message.lastSpeaker === "customer") {
      payload.lastSpeaker = message.lastSpeaker;
    }
    streamSalesSuggest(message.endpoint, payload, port).catch(() => {
      safePost(port, { type: "error", error: "stream failed" });
    });
  });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  // The on-page panel can't open tabs itself. When its "Sign in" button asks, open the one-click connect page.
  if (message?.type === "open-connect") {
    chrome.storage.local.get("apiBase", ({ apiBase }) => {
      const base = apiBase || "https://elostate.com";
      chrome.tabs.create({ url: `${base}/extension/connect?ext=${chrome.runtime.id}&product=sales` });
      sendResponse?.({ ok: true });
    });
    return true; // async
  }

  // Run a Sales Coach tool on behalf of the panel (CORS-safe here). Validate the endpoint — never a
  // caller-supplied URL/host (open-proxy hygiene; the page can't reach this listener anyway, defence in depth).
  if (message?.type === "sales-tool") {
    if (typeof message.endpoint !== "string" || !ALLOWED_ENDPOINT.test(message.endpoint)) {
      sendResponse?.({ status: 400, data: { error: "Unknown tool." } });
      return; // sync response
    }
    // Forward only the known tool inputs (defence in depth — never relay arbitrary keys): every tool takes
    // `conversation`; Suggested Response also takes the optional `guidance` (the rep's draft/intent); the
    // co-pilot path (blank guidance) uses `lastSpeaker`.
    const payload = { conversation: String(message.conversation || "") };
    if (typeof message.guidance === "string" && message.guidance) payload.guidance = message.guidance;
    // Co-Pilot response-mode signal: who sent the last message. Only the schema-valid values are relayed
    // (the route defaults a missing value to reply).
    if (message.lastSpeaker === "agent" || message.lastSpeaker === "customer") {
      payload.lastSpeaker = message.lastSpeaker;
    }
    salesFetch(message.endpoint, payload)
      .then((r) => sendResponse(r))
      .catch(() => sendResponse({ status: 0, data: { error: "network" } }));
    return true; // async
  }

  // Upload a conversation file (PDF/DOCX/TXT) → server extracts the text. The panel base64-encodes the bytes
  // (a File can't cross sendMessage); we rebuild + POST multipart here (CORS-free). Same endpoint allowlist.
  if (message?.type === "sales-extract") {
    if (typeof message.endpoint !== "string" || !ALLOWED_ENDPOINT.test(message.endpoint)) {
      sendResponse?.({ status: 400, data: { error: "Unknown endpoint." } });
      return; // sync
    }
    if (typeof message.b64 !== "string" || !message.b64) {
      sendResponse?.({ status: 400, data: { error: "No file data." } });
      return; // sync
    }
    salesExtractFetch(message.endpoint, String(message.filename || ""), String(message.mime || ""), message.b64)
      .then((r) => sendResponse(r))
      .catch(() => sendResponse({ status: 0, data: { error: "network" } }));
    return true; // async
  }
});

// Keep the toolbar badge in sync with the session, wherever the token changes (connect handoff, panel
// disconnect, refresh failure). Content scripts can't call chrome.action, so the badge is owned here.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !("salesCoachToken" in changes)) return;
  const connected = !!changes.salesCoachToken.newValue;
  chrome.action.setBadgeText({ text: connected ? "✓" : "" });
  if (connected) chrome.action.setBadgeBackgroundColor({ color: "#16a34a" });
});

// Connect handoff: the app's /extension/connect page (only origins in externally_connectable.matches can
// reach this) sends the rep's session token after they click "Sign in". Message type is DISTINCT
// ("sales-connect") so the same connect page can serve both extensions by product.
chrome.runtime.onMessageExternal.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== "sales-connect" || typeof message.token !== "string") {
    sendResponse?.({ ok: false, error: "bad message" });
    return;
  }
  const token = message.token.trim();
  if (!token) {
    sendResponse?.({ ok: false, error: "empty token" });
    return;
  }
  const refresh = typeof message.refreshToken === "string" ? message.refreshToken : null;
  chrome.storage.local.set({ salesCoachToken: token, salesCoachRefreshToken: refresh }, () => {
    chrome.action.setBadgeText({ text: "✓" });
    chrome.action.setBadgeBackgroundColor({ color: "#16a34a" });
    sendResponse?.({ ok: true });
  });
  return true; // async sendResponse
});
