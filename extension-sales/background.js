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

async function salesFetch(endpoint, payload) {
  const { salesCoachToken, salesCoachRefreshToken, apiBase } = await chrome.storage.local.get([
    "salesCoachToken",
    "salesCoachRefreshToken",
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

  let out = await call(salesCoachToken);

  // Silent refresh on expiry, then retry once — via the coach refresh route (built; shares
  // refreshExtensionSession with the C.A.R.E route). Runs here (CORS-free worker context).
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
          out = await call(rd.access_token);
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
    // `conversation`; coach also takes the rep's `draft`, formulate their `intent`, copilot the `lastSpeaker`.
    const payload = { conversation: String(message.conversation || "") };
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
