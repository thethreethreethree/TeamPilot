"use client";

import { useState } from "react";
import { Bell, BellOff, X } from "lucide-react";
import { useNotificationSubscription } from "@/lib/notifications/useNotificationSubscription";

/**
 * EnableNotificationsBanner — Team Chat PWA notification opt-in UX.
 *
 * Renders a small, dismissable banner above the chat list inviting
 * the user to enable push notifications. The banner is intentionally
 * NOT a permission auto-prompt (that's a hostile UX pattern and modern
 * browsers throttle/block them anyway). The user clicks "Enable" →
 * we trigger Notification.requestPermission() → if granted, register
 * the push subscription.
 *
 * Visibility logic:
 *   - Hidden when push isn't supported (older browsers, iOS pre-16.4)
 *   - Hidden when user has already subscribed
 *   - Hidden when user has previously denied (no spamming a "please
 *     enable" prompt — they decided)
 *   - Hidden when the user has dismissed the banner this session
 *     (localStorage flag)
 *   - Visible when status is "default" — never asked, browser-supported
 *
 * iOS Safari note: this banner can render in browser-tab Safari but
 * the actual permission grant will fail because iOS requires the
 * PWA to be installed first. A future iteration could detect that
 * case and show a different message ("Install Team Chat first to
 * enable notifications"). For Phase 2.1 we let the error surface
 * through the hook's error state.
 */

const DISMISS_KEY = "team-chat-notifications-banner-dismissed";

export function EnableNotificationsBanner() {
  const { status, supported, error, subscribe } = useNotificationSubscription();
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });

  if (!supported) return null;
  if (status === "loading" || status === "subscribed") return null;
  if (status === "denied") return null;
  if (dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // localStorage blocked (e.g. private browsing) — banner just
      // re-appears on next mount. Not blocking.
    }
  };

  return (
    <div
      className="mb-3 flex items-start gap-2.5 rounded-lg border border-ember-400/30 bg-ember-400/[0.05] px-3 py-2.5"
      role="region"
      aria-label="Notifications opt-in"
    >
      <Bell className="w-4 h-4 text-brand mt-0.5 flex-shrink-0" aria-hidden />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-primary leading-relaxed">
          {status === "error" ? (
            <>
              Couldn&apos;t enable notifications: {error ?? "unknown error"}.{" "}
              <button
                type="button"
                onClick={() => void subscribe()}
                className="text-brand hover:text-ember-500 underline underline-offset-2"
              >
                Try again
              </button>
            </>
          ) : status === "subscribing" ? (
            <>Asking for permission…</>
          ) : (
            <>
              Want to know when teammates message you? Enable notifications
              so the Team Chat PWA can ping you on this device.
            </>
          )}
        </p>
        {status !== "subscribing" && status !== "error" && (
          <div className="mt-1.5 flex items-center gap-3">
            <button
              type="button"
              onClick={() => void subscribe()}
              className="text-[11px] font-semibold text-[#09090B] bg-ember-400 hover:bg-ember-500 px-2.5 py-1 rounded-md transition-colors"
            >
              Enable notifications
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="text-[11px] text-muted hover:text-secondary inline-flex items-center gap-1"
            >
              <BellOff className="w-3 h-3" aria-hidden />
              Not now
            </button>
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss notifications banner"
        className="text-muted hover:text-secondary p-0.5 flex-shrink-0"
      >
        <X className="w-3.5 h-3.5" aria-hidden />
      </button>
    </div>
  );
}
