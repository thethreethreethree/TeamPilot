"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, X } from "lucide-react";

/**
 * InstallPrompt — PWA install affordance for the welcome (landing)
 * and login pages only. Per the user's directive, the dashboard
 * doesn't surface this; it's reserved for the entry surfaces where
 * a first-time visitor would consider installing.
 *
 * Behavior:
 *   1. Registers the service worker on mount (Chrome requires an
 *      active SW before it will fire `beforeinstallprompt`).
 *   2. Captures the `beforeinstallprompt` event and stashes it for
 *      later use (calling prompt() before user gesture is blocked).
 *   3. Shows a brand-styled button when the event is available.
 *   4. After install, the button hides itself; we listen for
 *      `appinstalled` and also fall back to checking
 *      `display-mode: standalone`.
 *   5. Dismiss button lets the user hide for the session (sessionStorage
 *      flag). The browser's own banner discipline handles longer-term
 *      suppression.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "elostate.install_prompt.dismissed_session";

export function InstallPrompt({
  iosHref = "/install",
  appName = "ELOSTATE",
}: {
  /** Where the iOS "How to install" link points. */
  iosHref?: string;
  /** App name shown in the prompt copy. */
  appName?: string;
} = {}) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  // iOS Safari never fires beforeinstallprompt, so the native button below
  // would never appear there. Detect iOS (not already installed) and offer the
  // manual "Add to Home Screen" walkthrough instead (§3.4 — don't leave iOS
  // users with a dead affordance; AMD-006 L3 — the /install page must be
  // reachable, not stranded behind a direct URL).
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    // Register the service worker so Chrome will fire the install
    // event. Safari iOS doesn't fire beforeinstallprompt but still
    // honors the manifest via "Add to Home Screen" from the share
    // sheet, so the manifest is the win there.
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* SW registration failure is non-fatal — page works without it */
      });
    }

    // Already installed? Don't show the prompt.
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(display-mode: standalone)").matches
    ) {
      setInstalled(true);
    }

    if (
      typeof window !== "undefined" &&
      window.sessionStorage.getItem(DISMISS_KEY) === "1"
    ) {
      setDismissed(true);
    }

    // iOS detection: iPhone/iPod/iPad UA, plus iPadOS 13+ which reports as
    // "MacIntel" but is touch-capable. Standalone (already installed) is
    // excluded via the check above.
    const ua = window.navigator.userAgent.toLowerCase();
    const iOS =
      /iphone|ipad|ipod/.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // Safari's non-standard flag for home-screen apps.
      (window.navigator as Navigator & { standalone?: boolean }).standalone ===
        true;
    if (iOS && !standalone) setIsIos(true);

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const result = await deferred.userChoice;
    if (result.outcome === "accepted") {
      setInstalled(true);
    }
    setDeferred(null);
  };

  const dismiss = () => {
    try {
      window.sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* private browsing — non-fatal */
    }
    setDismissed(true);
  };

  if (installed || dismissed) return null;

  // iOS Safari path — no native event, so link to the manual walkthrough.
  if (!deferred && isIos) {
    return (
      <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:bottom-6 md:max-w-sm z-50 glass-card p-4 border border-ember-400/40 shadow-glow mb-[env(safe-area-inset-bottom)]">
        <div className="flex items-start gap-3">
          <Download
            className="w-4 h-4 text-brand mt-0.5 flex-shrink-0"
            aria-hidden
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-primary mb-1">
              Install {appName}
            </p>
            <p className="text-[11px] text-secondary leading-relaxed mb-3">
              On iPhone, add it to your home screen from the browser — opens
              like a native app. Here&apos;s the quick how-to.
            </p>
            <div className="flex items-center gap-2">
              <Link
                href={iosHref}
                className="flex items-center gap-1.5 text-xs font-semibold bg-ember-400 hover:bg-ember-500 text-[#09090B] px-3 py-1.5 rounded-md transition-colors"
              >
                <Download className="w-3 h-3" aria-hidden />
                How to install
              </Link>
              <button
                type="button"
                onClick={dismiss}
                className="text-xs text-muted hover:text-secondary"
              >
                Not now
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss"
            className="text-muted hover:text-secondary p-0.5 flex-shrink-0"
          >
            <X className="w-3.5 h-3.5" aria-hidden />
          </button>
        </div>
      </div>
    );
  }

  if (!deferred) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:bottom-6 md:max-w-sm z-50 glass-card p-4 border border-ember-400/40 shadow-glow mb-[env(safe-area-inset-bottom)]">
      <div className="flex items-start gap-3">
        <Download
          className="w-4 h-4 text-brand mt-0.5 flex-shrink-0"
          aria-hidden
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-primary mb-1">
            Install {appName}
          </p>
          <p className="text-[11px] text-secondary leading-relaxed mb-3">
            Add to your device — opens like a native app, faster start,
            works as a home-screen icon. No store needed.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={install}
              className="flex items-center gap-1.5 text-xs font-semibold bg-ember-400 hover:bg-ember-500 text-[#09090B] px-3 py-1.5 rounded-md transition-colors"
            >
              <Download className="w-3 h-3" aria-hidden />
              Install
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="text-xs text-muted hover:text-secondary"
            >
              Not now
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="text-muted hover:text-secondary p-0.5 flex-shrink-0"
        >
          <X className="w-3.5 h-3.5" aria-hidden />
        </button>
      </div>
    </div>
  );
}
