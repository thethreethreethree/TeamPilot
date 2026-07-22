"use client";

import { useEffect } from "react";

/**
 * PWA-only viewport scale lock.
 *
 * WHY: the global viewport is WCAG 1.4.4-compliant — pinch-zoom is allowed everywhere, because disabling it in
 * the browser locks out low-vision users (Android Chrome honors `user-scalable=no`; only iOS Safari ignores it).
 * But in an INSTALLED PWA (standalone display mode), a scale lock is the expected native-app feel and there's no
 * browser chrome to fall back on. So we re-apply the lock at runtime ONLY when we detect standalone mode —
 * getting the native feel where it belongs without failing accessibility on the open web.
 *
 * This runs after hydration (a split-second where zoom is enabled in the PWA before the lock lands — imperceptible
 * and harmless). Input auto-zoom on iOS is already prevented by 16px input sizing, independent of this.
 */
export function PwaScaleLock() {
  useEffect(() => {
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      // iOS Safari exposes PWA standalone via this non-standard flag rather than display-mode.
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (!standalone) return;

    const vp = document.querySelector('meta[name="viewport"]');
    if (vp) {
      vp.setAttribute(
        "content",
        "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
      );
    }
  }, []);

  return null;
}
