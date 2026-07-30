"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, X } from "lucide-react";

/**
 * VersionWatcher — the structural cure for the recurring "I keep seeing the old version" reports.
 *
 * A running client (especially an installed iOS PWA, which resumes its last bundle instead of re-fetching)
 * can be arbitrarily older than what's deployed. Content-hashed chunks + a max-age=0 HTML don't help if the
 * app never actually reloads the document. This watcher makes staleness VISIBLE + one-tap fixable:
 *
 *   - NEXT_PUBLIC_BUILD_COMMIT is baked into THIS bundle at build time (next.config).
 *   - We fetch /api/health (build.commit = the currently-deployed commit) on mount + whenever the app
 *     regains focus (the exact moment a resumed PWA is most likely stale).
 *   - If the two commits are both present AND differ → the running app is old → show a reload prompt.
 *
 * False-positive safe: does NOTHING unless BOTH commits are present and non-empty (so local dev / off-Vercel
 * builds, where the baked value is "", never nag). Never auto-reloads — the user chooses, so it can't
 * interrupt work. Dismissible; re-checks on the next focus.
 */

const BAKED = (process.env.NEXT_PUBLIC_BUILD_COMMIT ?? "").trim();

export function VersionWatcher() {
  const [stale, setStale] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const checkingRef = useRef(false);
  const lastCheckRef = useRef(0);

  const check = useCallback(async () => {
    // No baked commit (local/off-Vercel) → nothing to compare against; stay silent.
    if (!BAKED) return;
    if (checkingRef.current) return;
    // Throttle: at most once per 30s regardless of focus churn.
    const now = Date.now();
    if (now - lastCheckRef.current < 30_000) return;
    lastCheckRef.current = now;
    checkingRef.current = true;
    try {
      const res = await fetch("/api/health", { cache: "no-store" });
      if (!res.ok) return;
      const d = await res.json();
      const live = String(d?.build?.commit ?? "").trim();
      if (live && live !== BAKED) setStale(true);
    } catch {
      /* network hiccup — try again on the next focus */
    } finally {
      checkingRef.current = false;
    }
  }, []);

  useEffect(() => {
    void check();
    const onFocus = () => {
      if (document.visibilityState === "visible") void check();
    };
    window.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
    };
  }, [check]);

  if (!stale || dismissed) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-0 z-[80] flex items-center gap-3 justify-center px-4 py-2.5 bg-ember-400 text-[#09090B] text-xs font-semibold shadow-[0_-4px_20px_-6px_rgba(0,0,0,0.4)] mb-[env(safe-area-inset-bottom)]"
    >
      <RefreshCw className="w-3.5 h-3.5 shrink-0" aria-hidden />
      <span>A new version of the app is available.</span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="rounded-md bg-[#09090B] text-ember-300 px-3 py-1 font-bold hover:bg-black transition-colors"
      >
        Reload
      </button>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => setDismissed(true)}
        className="ml-1 opacity-70 hover:opacity-100"
      >
        <X className="w-3.5 h-3.5" aria-hidden />
      </button>
    </div>
  );
}
