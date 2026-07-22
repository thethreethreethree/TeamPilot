// C.A.R.E extension — background service worker.
//
// Receives the session token from the app's /extension/connect page via externally_connectable messaging,
// so "Sign in" is a real one-click connect (no manual token paste). Only pages listed in the manifest's
// externally_connectable.matches can reach this listener.

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
