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
  let data = {};
  try {
    data = await res.json();
  } catch {
    /* non-JSON body */
  }
  return data;
}

// Shared token load + silent one-shot refresh-retry around a caller-provided `call(base, token)`. Both the JSON
// tool path and the multipart upload path go through this, so the 401→refresh→retry logic lives in ONE place
// (re-inlining it per call site is exactly how the two drift). Runs in the CORS-free worker context.
async function withAuthRetry(call) {
  const { salesCoachToken, salesCoachRefreshToken, apiBase } = await chrome.storage.local.get([
    "salesCoachToken",
    "salesCoachRefreshToken",
    "apiBase",
  ]);
  const base = apiBase || "https://elostate.com";
  let out = await call(base, salesCoachToken);

  if (out.status === 401 && salesCoachRefreshToken) {
    try {
      const rr = await fetch(base + "/api/coach/extension/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: salesCoachRefreshToken }),
      });
      if (rr.ok) {
        const rd = await rr.json().catch(() => ({}));
        if (rd.access_token) {
          await chrome.storage.local.set({
            salesCoachToken: rd.access_token,
            salesCoachRefreshToken: rd.refresh_token || salesCoachRefreshToken,
          });
          out = await call(base, rd.access_token);
        }
      } else {
        // Refresh itself failed → the session is truly gone; clear so the panel shows Sign in, drop the badge.
        await chrome.storage.local.remove(["salesCoachToken", "salesCoachRefreshToken"]);
        chrome.action.setBadgeText({ text: "" });
      }
    } catch {
      /* leave out as the 401; the panel will prompt Sign in */
    }
  }
  return out;
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
    // `conversation`; Suggested Response also takes the optional `guidance` (the rep's draft/intent), and the
    // co-pilot path uses `lastSpeaker`. (`draft`/`intent` retained for any legacy caller of the old routes.)
    const payload = { conversation: String(message.conversation || "") };
    if (typeof message.guidance === "string" && message.guidance) payload.guidance = message.guidance;
    if (typeof message.draft === "string" && message.draft) payload.draft = message.draft;
    if (typeof message.intent === "string" && message.intent) payload.intent = message.intent;
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
