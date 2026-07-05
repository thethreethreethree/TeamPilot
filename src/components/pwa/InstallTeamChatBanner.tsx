"use client";

import { useEffect, useState } from "react";
import { Download, Share, Smartphone, X } from "lucide-react";
import {
  detectPwaPlatform,
  isPwaInstalled,
  type PwaPlatform,
} from "@/lib/pwa/platform";
import { LearningHint } from "@/components/learning/LearningHint";

/**
 * InstallTeamChatBanner — surface for installing the Team Chat PWA
 * from the dashboard home page.
 *
 * Renders one of three states:
 *
 *  - Hidden:
 *      - User is already running inside the installed PWA (no value
 *        prompting install when they're already in it)
 *      - User has dismissed this banner (localStorage flag)
 *      - Browser doesn't support PWA install AT ALL (older Firefox, etc.)
 *
 *  - Chrome / Edge / Android one-click install:
 *      - We capture the `beforeinstallprompt` event the browser fires
 *        when the page meets installability criteria (manifest + SW +
 *        HTTPS, all already in place via /dashboard/layout.tsx)
 *      - "Install Team Chat" button calls .prompt() on the captured
 *        event, browser shows native install dialog
 *      - On accept, browser fires `appinstalled` event → we hide
 *
 *  - iOS Safari instructional:
 *      - iOS doesn't support beforeinstallprompt — users MUST go
 *        through Share → Add to Home Screen manually
 *      - We detect iOS Safari and surface step-by-step instructions
 *        with the actual Share icon so users know what to look for
 *
 * The banner is dismissable. Dismiss state persists in localStorage so
 * it doesn't keep re-prompting after the user has opted out.
 */

const DISMISS_KEY = "team-chat-install-banner-dismissed";

// Platform type + detection now live in the shared util so this banner and
// InstallPrompt agree on "is this iOS Safari / already installed?" (§A21).
type Platform = PwaPlatform;

// beforeinstallprompt is non-standard but widely supported in
// Chromium browsers. We type-narrow to the methods we actually use.
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: ReadonlyArray<string>;
  prompt(): Promise<void>;
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
}

export function InstallTeamChatBanner() {
  const [platform, setPlatform] = useState<Platform>("other");
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState<boolean>(false);
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });
  // iOS users see a deeper expanded view with step-by-step instructions
  // when they click "How to install" — keeps the default state compact.
  const [iosExpanded, setIosExpanded] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setPlatform(detectPwaPlatform());
    setInstalled(isPwaInstalled());

    const handleBeforeInstall = (e: Event) => {
      // Prevent the auto-prompt — we want to surface install via the
      // banner button, not browser-chrome popup. Capture the event so
      // we can replay it on user click.
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  // Hide rules:
  //   - Already installed → don't nag
  //   - User dismissed → respect the choice
  //   - Chrome platform but no install event captured yet → page is
  //     either not installable (missing criteria) or already-installed
  //     state hasn't fired. Hide rather than show a button that does
  //     nothing.
  //   - "other" platform → no install path we support
  if (installed) return null;
  if (dismissed) return null;
  if (platform === "other") return null;
  if (platform === "chrome" && !installEvent) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // localStorage blocked — banner just re-appears next mount.
    }
  };

  const install = async () => {
    if (!installEvent) return;
    try {
      await installEvent.prompt();
      const choice = await installEvent.userChoice;
      if (choice.outcome === "accepted") {
        // appinstalled event will also fire and set installed=true;
        // this is belt-and-suspenders so the banner hides immediately
        // even on browsers that don't fire appinstalled reliably.
        setInstalled(true);
      }
      setInstallEvent(null);
    } catch {
      // Some browsers throw if prompt() is called more than once;
      // silent recovery — banner will hide on the next user dismiss
      // or app-install event.
    }
  };

  return (
    <div
      className="flex items-start gap-3 rounded-xl border border-ember-400/30 bg-ember-400/[0.05] px-4 py-3"
      role="region"
      aria-label="Install Team Chat as an app"
    >
      {/* Branded icon preview — a miniature of the chat-bubble app
          icon. Matches what the user will see on their home screen
          after install, so the visual identity transfer is explicit. */}
      <div
        aria-hidden
        className="flex items-center justify-center w-10 h-10 rounded-lg bg-[#09090B] flex-shrink-0"
      >
        <Smartphone className="w-5 h-5 text-ember-400" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-primary">
          Install Team Chat as an app
        </p>
        <p className="text-xs text-secondary leading-relaxed mt-0.5">
          Add Team Chat to your home screen for one-tap access, push
          notifications, and a fullscreen experience.
        </p>

        {platform === "chrome" && installEvent && (
          <div className="mt-2 flex items-center gap-3">
            <LearningHint
              as="inline-block"
              category="PWA · Team Chat"
              title="Install Team Chat"
              whatItIs="Installs Team Chat as a standalone app via the browser's native install dialog — home-screen icon, fullscreen window, and the push notifications that only a real installed app can receive."
              why="Team Chat is most useful when it can reach you: installed, it can deliver push notifications and open in one tap instead of hunting for a tab. That's the difference between a chat you check and one that reaches you."
              how="Click Install and confirm in the browser prompt. 'Not now' dismisses the banner and remembers your choice so it won't keep nagging."
              principle="Notifications only matter if the app is installed to receive them.">
              <button
                type="button"
                onClick={() => void install()}
                className="flex items-center gap-1.5 text-xs font-semibold text-[#09090B] bg-ember-400 hover:bg-ember-500 px-3 py-1.5 rounded-md transition-colors"
              >
                <Download className="w-3.5 h-3.5" aria-hidden />
                Install
              </button>
            </LearningHint>
            <button
              type="button"
              onClick={dismiss}
              className="text-xs text-muted hover:text-secondary"
            >
              Not now
            </button>
          </div>
        )}

        {platform === "ios-safari" && (
          <div className="mt-2">
            <LearningHint
              as="inline-block"
              category="PWA · Team Chat"
              title="How to install on iPhone"
              whatItIs="Expands step-by-step instructions for adding Team Chat to your iPhone home screen through Safari's Share sheet."
              why="iOS doesn't offer the one-tap install other browsers do — the only route is the manual Share → Add to Home Screen flow. These steps, with the actual Share icon shown, make that path findable instead of a hidden secret."
              how="Tap to expand, then follow the three steps. Tap again to collapse them once you're done."
              principle="When a platform hides the path, show it plainly rather than assume people know it.">
              <button
                type="button"
                onClick={() => setIosExpanded((v) => !v)}
                className="text-xs font-semibold text-brand hover:text-ember-500"
              >
                {iosExpanded ? "Hide instructions" : "How to install on iPhone"}
              </button>
            </LearningHint>
            {iosExpanded && (
              <ol className="mt-2 text-xs text-secondary leading-relaxed space-y-1.5 list-decimal list-inside">
                <li>
                  Tap the{" "}
                  <span className="inline-flex items-center gap-1 align-middle">
                    <Share className="w-3 h-3 text-brand" aria-hidden />
                    <span className="text-primary font-medium">Share</span>
                  </span>{" "}
                  button at the bottom of Safari (or top on iPad)
                </li>
                <li>
                  Scroll the action sheet and tap{" "}
                  <span className="text-primary font-medium">
                    Add to Home Screen
                  </span>
                </li>
                <li>
                  Tap{" "}
                  <span className="text-primary font-medium">Add</span> in the
                  top-right corner
                </li>
              </ol>
            )}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss install banner"
        className="text-muted hover:text-secondary p-0.5 flex-shrink-0"
      >
        <X className="w-4 h-4" aria-hidden />
      </button>
    </div>
  );
}
