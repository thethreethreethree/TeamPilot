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

// The on-page panel (a content script) can't open tabs itself. When its "Sign in" button asks, open the
// one-click connect page with this extension's id so the app can hand the session straight back.
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "open-connect") {
    chrome.storage.local.get("apiBase", ({ apiBase }) => {
      const base = apiBase || "https://elostate.com";
      chrome.tabs.create({ url: `${base}/extension/connect?ext=${chrome.runtime.id}` });
      sendResponse?.({ ok: true });
    });
    return true; // async
  }
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
