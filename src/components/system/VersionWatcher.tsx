"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";

/**
 * VersionWatcher — the structural cure for the recurring "I keep seeing the old version" reports.
 *
 * A running client (especially an installed iOS PWA, which resumes its last bundle instead of re-fetching)
 * can be arbitrarily older than what's deployed. Content-hashed chunks + a max-age=0 HTML don't help if the
 * app never actually reloads the document. This watcher detects staleness and FORCES the update:
 *
 *   - NEXT_PUBLIC_BUILD_COMMIT is baked into THIS bundle at build time (next.config).
 *   - We fetch /api/health (build.commit = the currently-deployed commit) on mount + whenever the app
 *     regains focus (the exact moment a resumed PWA is most likely stale).
 *   - If the two commits are both present AND differ → the running app is old → AUTO-RELOAD it.
 *
 * FORCED update (founder 2026-08-13: clients were stuck on old mobile builds, breaking the capture fix). The
 * earlier version only PROMPTED and left it to the user, so stale clients persisted. Now it reloads itself.
 *
 * Two guards make the force SAFE:
 *   1. NEVER auto-reload while a live recording is in progress (`document.body[data-recording]`, set by
 *      LiveCoachingPanel + CARE useVoiceMode) — interrupting a call would destroy the recording, the exact
 *      failure the capture fix exists to prevent. During a call the banner stays as a manual option; the moment
 *      recording ends ('elostate:recording-ended') — or on the next focus check — the held update is applied.
 *   2. RELOAD AT MOST ONCE PER DEPLOYED COMMIT (sessionStorage). If we reload and come back STILL stale against
 *      the SAME live commit, the reload didn't take — a persistent commit/env drift (e.g. two Vercel projects
 *      serving different commits) — so we STOP auto-reloading and show the manual banner instead of looping
 *      forever. If sessionStorage is unavailable (private mode), we can't guard the loop → degrade to the manual
 *      banner rather than risk it.
 *
 * False-positive safe: does NOTHING unless BOTH commits are present and non-empty (so local dev / off-Vercel
 * builds, where the baked value is "", never reload).
 */

const BAKED = (process.env.NEXT_PUBLIC_BUILD_COMMIT ?? "").trim();
const RELOAD_KEY = "elostate-vw-reloaded-for";

const isRecordingActive = () =>
  typeof document !== "undefined" && document.body.dataset.recording === "1";

/**
 * The safety-critical decision, extracted PURE so it can be unit-tested (the component itself can't be, node-env).
 * Return true → force a reload now. Every guard that returns false is a real safety property:
 *   - need both commits (false-positive safety on local/off-Vercel builds)
 *   - already current → nothing to do
 *   - a call is recording → never interrupt it
 *   - already reloaded for THIS live commit and still stale → a persistent drift; stop, don't loop
 */
export function shouldForceReload(args: {
  baked: string;
  live: string;
  alreadyTriedThisCommit: boolean;
  recordingActive: boolean;
}): boolean {
  if (!args.baked || !args.live) return false;
  if (args.live === args.baked) return false;
  if (args.recordingActive) return false;
  if (args.alreadyTriedThisCommit) return false;
  return true;
}

export function VersionWatcher() {
  const [stale, setStale] = useState(false);
  const [reloading, setReloading] = useState(false);
  const checkingRef = useRef(false);
  const lastCheckRef = useRef(0);
  const reloadTimerRef = useRef<number | null>(null);
  const liveCommitRef = useRef<string>("");

  const scheduleReload = useCallback(() => {
    if (reloadTimerRef.current !== null) return; // already scheduled
    const live = liveCommitRef.current;
    // Loop guard: reload at most once per deployed commit. sessionStorage survives the reload; after a SUCCESSFUL
    // update the fresh bundle's BAKED === live → not stale → we never get here again. If we DO get here again for
    // the same live commit, the reload didn't take (persistent commit/env drift) → stop, don't loop. Storage
    // unavailable (private mode) → treat as already-tried so we DON'T auto-reload (safe: manual banner remains).
    let alreadyTried: boolean;
    try {
      alreadyTried = sessionStorage.getItem(RELOAD_KEY) === live;
    } catch {
      alreadyTried = true;
    }
    if (!shouldForceReload({ baked: BAKED, live, alreadyTriedThisCommit: alreadyTried, recordingActive: isRecordingActive() })) {
      return; // held for a recording, already tried, or nothing to do — the banner (manual) stays
    }
    try {
      sessionStorage.setItem(RELOAD_KEY, live);
    } catch {
      /* best-effort; the recording/commit guards above already gated us */
    }
    setReloading(true);
    // A short beat so the "Updating…" banner is visible and any in-flight tap settles.
    reloadTimerRef.current = window.setTimeout(() => {
      if (isRecordingActive()) {
        reloadTimerRef.current = null; // started recording during the beat — abort, wait for recording-ended
        setReloading(false);
        return;
      }
      window.location.reload();
    }, 1500);
  }, []);

  // `autoReload` distinguishes the two update paths (founder 2026-08-13):
  //   PRIMARY   — on the initial view / active session: only DETECT staleness → show the Reload banner. Never
  //               yank a session the user is in the middle of.
  //   SECONDARY — on a REOPEN/REVISIT (the app was hidden, then made visible again — the exact iOS-PWA-resume
  //               moment): if they didn't hit Reload, apply the update automatically.
  const check = useCallback(
    async (autoReload: boolean, bypassThrottle = false) => {
      // No baked commit (local/off-Vercel) → nothing to compare against; stay silent.
      if (!BAKED) return;
      if (checkingRef.current) return;
      // Throttle background/focus churn to at most once per 30s — but a GENUINE reopen/revisit bypasses it, so the
      // secondary auto-update reliably fires on reopen even if the last check was <30s ago (otherwise a quick
      // background→return would be throttled and the update would silently not apply — the founder's exact goal).
      const now = Date.now();
      if (!bypassThrottle && now - lastCheckRef.current < 30_000) return;
      lastCheckRef.current = now;
      checkingRef.current = true;
      try {
        const res = await fetch("/api/health", { cache: "no-store" });
        if (!res.ok) return;
        const d = await res.json();
        const live = String(d?.build?.commit ?? "").trim();
        if (live && live !== BAKED) {
          liveCommitRef.current = live;
          setStale(true); // banner (primary) — always
          if (autoReload) scheduleReload(); // secondary — only on a reopen/revisit
        }
      } catch {
        /* network hiccup — try again on the next revisit */
      } finally {
        checkingRef.current = false;
      }
    },
    [scheduleReload],
  );

  useEffect(() => {
    // Initial view → detect + banner only (no auto-reload of the current session).
    void check(false);
    const wasHidden = { current: false };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        wasHidden.current = true;
        return;
      }
      // Became visible. A true REOPEN/REVISIT is visible-after-hidden — apply the secondary auto-update there,
      // bypassing the throttle so a quick return still checks fresh + updates.
      const revisited = wasHidden.current;
      wasHidden.current = false;
      void check(revisited, revisited);
    };
    // A recording that was holding a revisit-triggered update has ended → apply it now.
    const onRecordingEnded = () => scheduleReload();
    window.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("elostate:recording-ended", onRecordingEnded);
    return () => {
      window.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("elostate:recording-ended", onRecordingEnded);
    };
  }, [check, scheduleReload]);

  if (!stale) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-0 z-[80] flex items-center gap-3 justify-center px-4 py-2.5 bg-ember-400 text-[#09090B] text-xs font-semibold shadow-[0_-4px_20px_-6px_rgba(0,0,0,0.4)] mb-[env(safe-area-inset-bottom)]"
    >
      <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${reloading ? "animate-spin" : ""}`} aria-hidden />
      <span>
        {reloading
          ? "Updating to the latest version…"
          : "A new version of the app is available."}
      </span>
      {/* PRIMARY path — tap to update now. Also the ONLY path while a call is recording (the secondary auto-reload
          is held then) or if the once-per-commit loop guard stopped the auto-reload. */}
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="rounded-md bg-[#09090B] text-ember-300 px-3 py-1 font-bold hover:bg-black transition-colors"
      >
        Reload
      </button>
    </div>
  );
}
