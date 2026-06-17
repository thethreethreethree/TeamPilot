/**
 * Mic permission helpers. Browser detection + actionable
 * recovery instructions when the customer has previously denied
 * permission and the browser is caching the denial silently.
 *
 * Per the user's report 2026-06-17: the generic "click the lock
 * icon" instruction failed because some browsers don't show the
 * lock affordance when permission was set without an explicit
 * prompt (e.g., chrome://flags / OS-level / extension blocking).
 * This module gives browser-specific instructions so the
 * customer can find the actual control.
 */

export type BrowserKind =
  | "chrome"
  | "edge"
  | "safari-desktop"
  | "safari-ios"
  | "firefox"
  | "android-chrome"
  | "unknown";

/**
 * Best-effort browser identification from the user agent. Used
 * only for help-text personalization; never for feature gating.
 */
export function detectBrowser(): BrowserKind {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent;

  // iOS Safari (Mobile Safari) — covers iPhones and iPads. iPad
  // running iPadOS 13+ identifies as Macintosh in the UA but the
  // platform check catches it.
  const iosByPlatform =
    typeof navigator.platform === "string" &&
    (navigator.platform === "iPhone" ||
      navigator.platform === "iPad" ||
      navigator.platform === "iPod");
  const iosByUa = /iPhone|iPad|iPod/i.test(ua);
  if (iosByPlatform || iosByUa) return "safari-ios";

  // Android Chrome
  if (/Android/.test(ua) && /Chrome/.test(ua)) return "android-chrome";

  // Edge (Chromium)
  if (/Edg\//.test(ua)) return "edge";

  // Firefox (covers Firefox Mobile too)
  if (/Firefox/.test(ua)) return "firefox";

  // Desktop Safari (excludes Chrome which also contains Safari in
  // its UA)
  if (/Safari/.test(ua) && !/Chrome/.test(ua)) return "safari-desktop";

  // Desktop Chrome / Brave / Opera (all Chromium-based; treat
  // them as Chrome for instruction purposes)
  if (/Chrome/.test(ua)) return "chrome";

  return "unknown";
}

/**
 * Returns browser-specific step-by-step recovery instructions
 * for re-enabling a denied microphone permission. Used by the
 * VoiceSurface error panel.
 */
export function getRecoverySteps(browser: BrowserKind): string[] {
  switch (browser) {
    case "chrome":
    case "edge":
      return [
        "Click the icon to the LEFT of the URL (lock 🔒, info 'i', or 'View site information').",
        "Find Microphone in the dropdown.",
        "Switch from Block to Allow.",
        "Refresh this page and try the call again.",
        "If the icon doesn't show Microphone: open chrome://settings/content/microphone in a new tab, find this site, change Block → Allow.",
      ];
    case "android-chrome":
      return [
        "Tap the lock icon to the left of the URL.",
        "Tap Permissions → Microphone.",
        "Switch to Allow.",
        "Reload the page and try the call again.",
      ];
    case "safari-desktop":
      return [
        "Safari menu (top-left) → Settings for This Website…",
        "Find Microphone, change to Allow.",
        "Refresh this page and try the call again.",
        "Alternative: Safari → Settings → Websites → Microphone, find this site, change to Allow.",
      ];
    case "safari-ios":
      return [
        "Open the iOS Settings app (outside Safari).",
        "Scroll to Safari → Microphone.",
        "Make sure Microphone is set to Allow (not Deny).",
        "Also check Settings → Privacy & Security → Microphone → Safari is enabled.",
        "Return here, refresh the page, and try the call again.",
      ];
    case "firefox":
      return [
        "Click the lock icon to the left of the URL.",
        "Click the > arrow next to Connection secure → More Information.",
        "Permissions tab → find Use the Microphone → uncheck Use Default → switch to Allow.",
        "Refresh this page and try the call again.",
      ];
    default:
      return [
        "Find your browser's site-information control (usually a lock icon next to the URL).",
        "Locate Microphone permissions for this site and switch to Allow.",
        "Refresh the page and try the call again.",
      ];
  }
}

/**
 * Check the current microphone permission state without
 * actually requesting it. Returns null if the Permissions API
 * isn't available (older Safari).
 */
export async function checkMicPermission(): Promise<
  PermissionState | null
> {
  if (
    typeof navigator === "undefined" ||
    !navigator.permissions ||
    typeof navigator.permissions.query !== "function"
  ) {
    return null;
  }
  try {
    // The PermissionName type doesn't include "microphone" in
    // some TS lib versions but every shipping browser accepts
    // it. Cast through unknown rather than narrowing the type.
    const result = await navigator.permissions.query({
      name: "microphone" as PermissionName,
    });
    return result.state;
  } catch {
    return null;
  }
}
