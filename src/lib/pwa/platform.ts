/**
 * Shared PWA platform detection.
 *
 * Extracted so every install surface agrees on "is this iOS Safari?" and "is
 * it already installed?" (§A21 — one source, not a per-component fork). Before
 * this, InstallTeamChatBanner had the correct Safari-narrowed check while
 * InstallPrompt used a broader iPhone/iPad UA test that mis-fired on iOS
 * Chrome/Firefox (audit F2). Both now import from here.
 */

export type PwaPlatform = "chrome" | "ios-safari" | "other";

/**
 * Which install path applies. "ios-safari" ONLY when the browser is real
 * Safari on iOS — the Share → Add to Home Screen flow is Safari-specific, so
 * Chrome (CriOS), Firefox (FxiOS), and Edge (EdgiOS) on iOS are excluded.
 */
export function detectPwaPlatform(): PwaPlatform {
  if (typeof window === "undefined") return "other";
  const ua = window.navigator.userAgent;
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) &&
    !(window as unknown as { MSStream?: unknown }).MSStream;
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  if (isIOS && isSafari) return "ios-safari";
  // Chromium browsers fire beforeinstallprompt; callers lean on that event as
  // the real signal rather than UA sniffing.
  return "chrome";
}

/** True when the page is running as an installed standalone PWA. */
export function isPwaInstalled(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // Safari's non-standard flag for home-screen apps.
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
      true
  );
}
