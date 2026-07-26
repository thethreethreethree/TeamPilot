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
    try {
      const rr = await fetch(base + "/api/care/extension/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: careRefreshToken }),
      });
      if (rr.ok) {
        const rd = await rr.json().catch(() => ({}));
        if (rd.access_token) {
          await chrome.storage.local.set({
            careToken: rd.access_token,
            careRefreshToken: rd.refresh_token || careRefreshToken,
          });
          out = await call(rd.access_token);
        }
      } else {
        // Refresh itself failed → the session is truly gone; clear so the panel shows Sign in and drop the badge.
        await chrome.storage.local.remove(["careToken", "careRefreshToken"]);
        chrome.action.setBadgeText({ text: "" });
      }
    } catch {
      /* leave out as the 401; the panel will prompt Sign in */
    }
  }
  return out;
}

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

  // care-rcd-fetch-and-upload (founder 2026-07-26): the FIX for cross-origin image capture. The content
  // script's canvas read fails on third-party images (CORS taint → SecurityError). The WORKER, once the
  // user grants the <all_urls> OPTIONAL host permission, CAN fetch those images cross-origin — so it
  // fetches the image URL here, then PUTs the bytes to the Supabase signed URL. signedUrl is PINNED to
  // *.supabase.co (destination can't be redirected — not an open proxy); imageUrl must be http(s).
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
