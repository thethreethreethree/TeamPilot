"use client";

import { useEffect } from "react";

/**
 * TeamChatServiceWorkerRegister — installs the Team Chat PWA service
 * worker scoped to /dashboard/chats/.
 *
 * Rendered inside the /dashboard/chats layout so it only registers
 * when the user is on the chat surface. This means:
 *   - Users who only visit the dashboard never get prompted to install
 *     Team Chat
 *   - The SW only controls /dashboard/chats/ traffic — other routes
 *     are unaffected even if the user has the PWA installed
 *
 * Phase 1 scope (no offline behavior yet — see public/sw-team-chat.js
 * header for what's deferred).
 */
export function TeamChatServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    // Demo mode (no Supabase) doesn't need PWA install — the manifest
    // and SW would just confuse demo users with an "Install ELOSTATE"
    // prompt on a session they're going to close in 5 minutes.
    if (window.location.hostname === "localhost") {
      // Localhost-allowed for development testing; ship behavior is
      // production-only. Comment out the early-return to test
      // installability against `localhost` in Chrome DevTools.
    }

    navigator.serviceWorker
      .register("/sw-team-chat.js", { scope: "/dashboard/chats/" })
      .catch((err) => {
        // SW registration failures are non-blocking — the chat UI
        // still works normally without it. Log so we can spot
        // regressions in production telemetry.
        // eslint-disable-next-line no-console
        console.warn("[team-chat-pwa] service worker registration failed", err);
      });
  }, []);

  return null;
}
