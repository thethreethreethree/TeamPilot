// C.A.R.E extension — background service worker.
//
// Receives the session token from the app's /extension/connect page via externally_connectable messaging,
// so "Sign in" is a real one-click connect (no manual token paste). Only pages listed in the manifest's
// externally_connectable.matches can reach this listener.

// Toolbar-icon click → inject (or toggle) the on-page panel. We inject config.js first so content.js can reuse
// its helpers (they share the same isolated world). activeTab grants the one-time host access on this click, so
// no broad "all sites" permission is needed. Some pages (chrome://, the Web Store, PDFs) disallow injection —
// swallow that error rather than throwing an unhandled rejection.
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.id) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["config.js", "adapters.js", "content.js"],
    });
  } catch (e) {
    // Injection blocked on this page — nothing we can do; the panel just won't open here.
    console.debug("C.A.R.E: cannot open panel on this page", e?.message);
  }
});

// WHY the tool calls live HERE and not in the content script: a content-script fetch runs in the page's
// context and is subject to CORS — host_permissions does NOT grant the CORS bypass to content scripts, only to
// the service worker. elostate.com would see Origin: https://<whatever-site> and (correctly) refuse it, so the
// tools would fail on essentially every real page. The service worker's fetch, with host_permissions, bypasses
// CORS. So the panel sends "care-tool" here; the worker holds the token, calls the API, and handles refresh.
const ALLOWED_ENDPOINT = /^\/api\/care\/extension\/[a-z]+$/; // no arbitrary paths/hosts (defence in depth)

// Silent refresh of the access token, shared by the JSON tool path (careFetch) AND the streaming path so the
// 401→refresh logic lives in ONE place (re-inlining per call site is exactly how the two drift). Returns the new
// access token on success, or null — and on a hard failure clears the session so the panel shows Sign in and the
// badge drops. `currentRefresh` may be rotated by a successful refresh.
//
// SINGLE-FLIGHT (repeated-sign-out fix, 2026-08-13): Supabase ROTATES the refresh token per use and has
// REUSE-DETECTION — reusing a consumed token invalidates the ENTIRE session. Concurrent 401s (a tool + the
// streaming fallback, or multiple tools after the ~1h access token expires) each fired their own refresh with
// the same token; the first rotated it, the rest reused the consumed one → Supabase killed the session →
// "kicked out again and again". Coalesce concurrent refreshes into ONE grant they all share.
let careRefreshInFlight = null;
function refreshCareAccessToken(base, currentRefresh) {
  if (!currentRefresh) return Promise.resolve(null);
  if (!careRefreshInFlight) {
    careRefreshInFlight = doCareRefresh(base, currentRefresh).finally(() => {
      careRefreshInFlight = null; // only one runs at a time, so this always clears the current in-flight refresh
    });
  }
  return careRefreshInFlight;
}

async function doCareRefresh(base, currentRefresh) {
  // Re-read the LATEST refresh token at refresh time (audit fix, 2026-08-13) — same fast/slow reuse-race fix as
  // the sales extension: callers capture their token at call-start, so a slow call that 401s after a fast call
  // already rotated it would replay the consumed token → Supabase reuse-detection → session killed. Read storage
  // HERE so a late refresher uses the freshly-rotated token.
  const latest = await chrome.storage.local.get("careRefreshToken");
  const refresh = latest.careRefreshToken || currentRefresh;
  try {
    const rr = await fetch(base + "/api/care/extension/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refresh }),
    });
    if (rr.ok) {
      const rd = await rr.json().catch(() => ({}));
      if (rd.access_token) {
        await chrome.storage.local.set({
          careToken: rd.access_token,
          careRefreshToken: rd.refresh_token || refresh,
        });
        return rd.access_token;
      }
      return null;
    }
    // Refresh itself failed → the session is truly gone; clear so the panel shows Sign in and drop the badge.
    await chrome.storage.local.remove(["careToken", "careRefreshToken"]);
    chrome.action.setBadgeText({ text: "" });
    return null;
  } catch {
    return null; // network hiccup on refresh; caller leaves the 401 to surface Sign in
  }
}

async function careFetch(endpoint, payload) {
  const { careToken, careRefreshToken, apiBase } = await chrome.storage.local.get([
    "careToken",
    "careRefreshToken",
    "apiBase",
  ]);
  const base = apiBase || "https://elostate.com";
  const call = async (token) => {
    const res = await fetch(base + endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    let data = {};
    try {
      data = await res.json();
    } catch {
      /* non-JSON body */
    }
    return { status: res.status, data };
  };

  let out = await call(careToken);

  // Silent refresh on expiry (audit A4), then retry once. Refresh runs here too (same CORS-free worker context).
  if (out.status === 401 && careRefreshToken) {
    const fresh = await refreshCareAccessToken(base, careRefreshToken);
    if (fresh) out = await call(fresh);
  }
  return out;
}

// ── Streaming AI Co-Pilot ────────────────────────────────────────────────────────────────────────────────
// Mirrors the Sales Coach streaming (2026-08-09). chrome.runtime.sendMessage is single-response, so streaming
// uses a long-lived Port: the panel connects "care-copilot-stream", posts {type:"start", …}, and we relay each
// SSE event back (delta → append to the forming reply; done → final split; error → panel falls back to the
// non-stream path). Only the Co-Pilot streams; the other tools keep their request path. C.A.R.E's output is
// unchanged — only the delivery.

function relayCareSseEvent(rawEvent, port) {
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
    return;
  }
  if (event === "delta") safePost(port, { type: "delta", text: String(parsed.text || "") });
  else if (event === "done") safePost(port, { type: "done", reply: parsed.reply, reasoning: parsed.reasoning });
  else if (event === "error") safePost(port, { type: "error", error: parsed.error, kind: parsed.kind });
}

// Post to a Port that may already be disconnected (the agent closed/minimized the panel mid-stream) without
// throwing — review Finding 1.1 Consequence B: a raw postMessage to a dead port throws, cascading through the
// reader's catch into more throws. A closed port just means nobody's listening; no-op.
function safePost(port, msg) {
  try {
    port.postMessage(msg);
  } catch {
    /* port closed — nobody listening */
  }
}

async function streamCareCopilot(endpoint, payload, port) {
  const { careToken, careRefreshToken, apiBase } = await chrome.storage.local.get([
    "careToken",
    "careRefreshToken",
    "apiBase",
  ]);
  const base = apiBase || "https://elostate.com";
  // Cancel the upstream LLM stream if the agent closes/minimizes the panel mid-generation (review Finding 1.1):
  // otherwise the worker reads the SSE body to EOF and the server keeps generating — real wasted metered AI
  // spend for output no one will see. onDisconnect → abort the fetch → reader rejects → stop. `aborted` also
  // suppresses the terminal error-post / disconnect (the client is already gone).
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
    res = await doFetch(careToken);
    if (res.status === 401 && careRefreshToken) {
      const fresh = await refreshCareAccessToken(base, careRefreshToken);
      if (fresh) res = await doFetch(fresh);
    }
  } catch {
    if (!aborted) safePost(port, { type: "error", status: 0, error: "network" });
    return;
  }
  if (aborted) return; // agent closed the panel during the fetch/refresh — nothing to stream to

  if (res.status === 401) {
    safePost(port, { type: "error", status: 401, error: "Your session expired." });
    return;
  }
  if (!res.ok || !res.body) {
    const snippet = await res.text().catch(() => "");
    safePost(port, { type: "error", status: res.status, error: snippet.slice(0, 300) || `HTTP ${res.status}` });
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      if (aborted) break; // agent closed/minimized mid-stream → stop reading (the fetch is already aborting)
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf("\n\n")) !== -1) {
        relayCareSseEvent(buffer.slice(0, idx), port);
        buffer = buffer.slice(idx + 2);
      }
    }
    if (!aborted && buffer.trim()) relayCareSseEvent(buffer, port);
  } catch {
    if (!aborted) safePost(port, { type: "error", error: "stream interrupted" });
  } finally {
    // Terminal guarantee: when the reader loop ends for ANY reason — normal done, a throw, OR a clean EOF where
    // the server was killed before emitting done (e.g. the 60s function cap) — disconnect the port so the
    // panel's onDisconnect fires the fallback. Skipped when `aborted` (the client already disconnected, so this
    // would only throw). If the client already got done + disconnected, this is a harmless no-op.
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
  if (port.name !== "care-copilot-stream") return;
  port.onMessage.addListener((message) => {
    if (!message || message.type !== "start") return;
    if (typeof message.endpoint !== "string" || !ALLOWED_ENDPOINT.test(message.endpoint)) {
      safePost(port, { type: "error", status: 400, error: "Unknown tool." });
      return;
    }
    const payload = { conversation: String(message.conversation || ""), stream: true };
    if (message.lastSpeaker === "agent" || message.lastSpeaker === "customer") {
      payload.lastSpeaker = message.lastSpeaker;
    }
    streamCareCopilot(message.endpoint, payload, port).catch(() => {
      safePost(port, { type: "error", error: "stream failed" });
    });
  });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  // The on-page panel can't open tabs itself. When its "Sign in" button asks, open the one-click connect page.
  if (message?.type === "open-connect") {
    chrome.storage.local.get("apiBase", ({ apiBase }) => {
      const base = apiBase || "https://elostate.com";
      chrome.tabs.create({ url: `${base}/extension/connect?ext=${chrome.runtime.id}` });
      sendResponse?.({ ok: true });
    });
    return true; // async
  }

  // Run a C.A.R.E tool on behalf of the panel (CORS-safe here). Validate the endpoint — never a caller-supplied
  // URL or host (open-proxy hygiene; the page can't reach this listener anyway, but defence in depth).
  if (message?.type === "care-tool") {
    if (typeof message.endpoint !== "string" || !ALLOWED_ENDPOINT.test(message.endpoint)) {
      sendResponse?.({ status: 400, data: { error: "Unknown tool." } });
      return; // sync response
    }
    // Forward only the known tool inputs (defence in depth — never relay arbitrary keys): every tool takes
    // `conversation`; Coach also takes the agent's `draft`, Formulate also takes their `intent`.
    const payload = { conversation: String(message.conversation || "") };
    if (typeof message.draft === "string" && message.draft) payload.draft = message.draft;
    if (typeof message.intent === "string" && message.intent) payload.intent = message.intent;
    // Co-Pilot response-mode signal (founder request 2026-07-23): who sent the last message. Only the
    // two meaningful, schema-valid values are relayed (the route defaults a missing value to reply).
    if (message.lastSpeaker === "agent" || message.lastSpeaker === "customer") {
      payload.lastSpeaker = message.lastSpeaker;
    }
    careFetch(message.endpoint, payload)
      .then((r) => sendResponse(r))
      .catch(() => sendResponse({ status: 0, data: { error: "network" } }));
    return true; // async
  }

  // Ingest RCD (Raw Conversation Data) captured from the page. Unlike the text tools, this carries the
  // full STRUCTURE (messages + per-message attribution + media metadata), so it has its own handler with
  // the endpoint PINNED here (never caller-supplied — open-proxy hygiene). Returns { conversationId,
  // uploads:[{ref, signedUrl, ...}] }; the panel then PUTs each media's bytes DIRECTLY to its Supabase
  // signed URL (CORS-permitted), so the bytes never traverse this worker or the API's ~4.5MB body limit.
  if (message?.type === "care-rcd-ingest") {
    const p = message.payload;
    if (!p || typeof p !== "object" || !Array.isArray(p.messages) || !p.messages.length) {
      sendResponse?.({ status: 400, data: { error: "Bad RCD payload." } });
      return; // sync
    }
    careFetch("/api/care/extension/rcd", p)
      .then((r) => sendResponse(r))
      .catch(() => sendResponse({ status: 0, data: { error: "network" } }));
    return true; // async
  }

  // Upload one media's BYTES to its Supabase signed URL (Phase 2c). The panel reads image bytes via
  // canvas (NO network in the content script — the CORS/security invariant) and base64-encodes them;
  // the worker (which holds the *.supabase.co host permission) does the actual cross-origin PUT. The
  // URL is PINNED to *.supabase.co so this can't be turned into an open PUT proxy (same hygiene as the
  // tool-endpoint pin). No Authorization header — the signed URL already carries its upload token.
  if (message?.type === "care-rcd-upload") {
    const url = message.signedUrl;
    const b64 = message.dataBase64;
    if (
      typeof url !== "string" ||
      !/^https:\/\/[a-z0-9-]+\.supabase\.co\//i.test(url) ||
      typeof b64 !== "string" ||
      !b64
    ) {
      sendResponse?.({ ok: false, error: "bad upload" });
      return; // sync
    }
    let bytes;
    try {
      bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    } catch {
      sendResponse?.({ ok: false, error: "decode" });
      return; // sync
    }
    fetch(url, {
      method: "PUT",
      body: bytes,
      headers: { "content-type": typeof message.contentType === "string" ? message.contentType : "application/octet-stream" },
    })
      .then((r) => sendResponse({ ok: r.ok, status: r.status }))
      .catch(() => sendResponse({ ok: false, error: "network" }));
    return true; // async
  }

  // Is the optional <all_urls> host permission (needed to fetch third-party image bytes) already granted?
  // chrome.permissions.contains lives in the worker (not the content script), so the panel asks via message.
  if (message?.type === "care-image-perm-status") {
    chrome.permissions
      .contains({ origins: ["*://*/*"] })
      .then((granted) => sendResponse({ granted: !!granted }))
      .catch(() => sendResponse({ granted: false }));
    return true; // async
  }

  // Open the extension's own permission page so the user can GRANT the optional host permission there. The
  // grant MUST happen in an extension page's click handler — chrome.permissions.request needs a user
  // gesture, and that gesture does NOT survive a content-script → worker sendMessage hop (MV3). So we can't
  // request it from here or from the panel; we open permission.html and let its button do it.
  if (message?.type === "care-open-image-permission") {
    chrome.tabs.create({ url: chrome.runtime.getURL("permission.html") });
    sendResponse?.({ ok: true });
    return true; // async
  }

  // care-rcd-fetch-and-upload (founder 2026-07-26): the FIX for cross-origin image capture. The content
  // script's canvas read fails on third-party images (CORS taint → SecurityError). The WORKER, once the
  // user grants the <all_urls> OPTIONAL host permission (via permission.html), CAN fetch those images
  // cross-origin — so it fetches the image URL here, then PUTs the bytes to the Supabase signed URL.
  // signedUrl is PINNED to *.supabase.co (destination can't be redirected — not an open proxy); imageUrl
  // must be http(s).
  if (message?.type === "care-rcd-fetch-and-upload") {
    const imageUrl = message.imageUrl;
    const signedUrl = message.signedUrl;
    if (
      typeof signedUrl !== "string" ||
      !/^https:\/\/[a-z0-9-]+\.supabase\.co\//i.test(signedUrl) ||
      typeof imageUrl !== "string" ||
      !/^https?:\/\//i.test(imageUrl)
    ) {
      sendResponse?.({ ok: false, error: "bad params" });
      return; // sync
    }
    (async () => {
      try {
        const imgRes = await fetch(imageUrl);
        if (!imgRes.ok) { sendResponse({ ok: false, error: "fetch " + imgRes.status }); return; }
        const buf = await imgRes.arrayBuffer();
        const ct = imgRes.headers.get("content-type") ||
          (typeof message.contentType === "string" ? message.contentType : "application/octet-stream");
        const put = await fetch(signedUrl, { method: "PUT", body: buf, headers: { "content-type": ct } });
        sendResponse({ ok: put.ok, status: put.status });
      } catch {
        sendResponse({ ok: false, error: "network" });
      }
    })();
    return true; // async
  }
});

// Keep the toolbar badge in sync with the session, wherever the token changes (connect handoff, panel
// disconnect, refresh failure). Content scripts can't call chrome.action, so the badge is owned here.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !("careToken" in changes)) return;
  const connected = !!changes.careToken.newValue;
  chrome.action.setBadgeText({ text: connected ? "✓" : "" });
  if (connected) chrome.action.setBadgeBackgroundColor({ color: "#16a34a" });
});

chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== "care-connect" || typeof message.token !== "string") {
    sendResponse?.({ ok: false, error: "bad message" });
    return;
  }
  const token = message.token.trim();
  if (!token) {
    sendResponse?.({ ok: false, error: "empty token" });
    return;
  }
  const refresh = typeof message.refreshToken === "string" ? message.refreshToken : null;
  chrome.storage.local.set({ careToken: token, careRefreshToken: refresh }, () => {
    // Small badge so the toolbar reflects the connected state at a glance.
    chrome.action.setBadgeText({ text: "✓" });
    chrome.action.setBadgeBackgroundColor({ color: "#16a34a" });
    sendResponse?.({ ok: true });
  });
  return true; // async sendResponse
});
