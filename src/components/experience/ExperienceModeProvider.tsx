"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ExperienceMode } from "@/lib/experience/mode";

/**
 * Experience Mode — the per-user complexity dial (migration 0110).
 *
 *   - 'standard': simplified. AI outputs are short + plain-language; advanced
 *     UI panels collapse behind "show more". The default for new users.
 *   - 'expert': the full system (today's behavior). Everything shown.
 *
 * Persistent per-user preference (profiles.experience_mode), loaded once from
 * /api/me/experience-mode. Mirrors LearningModeProvider's shape. Standard is a
 * FLOOR not a ceiling — components in Standard still expose a one-click drill-in;
 * this provider only carries the preference, the "show full reasoning" affordance
 * lives in each surface.
 *
 * The ExperienceMode TYPE comes from @/lib/experience/mode (A13 vocabulary-once);
 * server components / prompt builders read the mode from the DB via
 * getExperienceMode() there. This provider is the CLIENT-side read for UI gating.
 */

type ExperienceModeContextValue = {
  mode: ExperienceMode;
  isStandard: boolean;
  isExpert: boolean;
  /** Whether the initial server read has completed. Components can avoid a
   *  flash by treating !loaded as "don't assume either mode yet". */
  loaded: boolean;
  setMode: (next: ExperienceMode) => Promise<void>;
  toggle: () => Promise<void>;
};

const ExperienceModeContext = createContext<ExperienceModeContextValue | null>(
  null
);

export function ExperienceModeProvider({
  children,
  initialMode,
}: {
  children: React.ReactNode;
  /** The mode read SERVER-SIDE in the layout, so the first client paint already
   *  matches the user's real mode (no Expert flicker, no hydration mismatch —
   *  audit F1 fix). Omitted → 'standard', the never-over-serve default, and the
   *  background fetch still reconciles. */
  initialMode?: ExperienceMode;
}) {
  // Start from the server-read mode when we have it — SSR and hydration then agree
  // on the same first paint. Falls back to 'standard' (never over-serve complexity
  // to a user whose preference we haven't loaded).
  const [mode, setModeState] = useState<ExperienceMode>(initialMode ?? "standard");
  // If the server already told us the mode, we are effectively loaded from frame 1;
  // the fetch below still runs to reconcile a mid-session change, but nothing gates
  // on a flicker window anymore.
  const [loaded, setLoaded] = useState(initialMode !== undefined);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/me/experience-mode")
      .then(async (res) => {
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          setModeState(data.mode === "expert" ? "expert" : "standard");
        }
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setMode = useCallback(async (next: ExperienceMode) => {
    setModeState(next); // optimistic
    try {
      await fetch("/api/me/experience-mode", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: next }),
      });
    } catch {
      // Best-effort — the next page load reconciles from the server. We don't
      // roll back the local toggle (a silent retry reads less buggy than a flip-back).
    }
  }, []);

  const toggle = useCallback(
    () => setMode(mode === "expert" ? "standard" : "expert"),
    [mode, setMode]
  );

  const value = useMemo(
    () => ({
      mode,
      isStandard: mode === "standard",
      isExpert: mode === "expert",
      loaded,
      setMode,
      toggle,
    }),
    [mode, loaded, setMode, toggle]
  );

  return (
    <ExperienceModeContext.Provider value={value}>
      {children}
    </ExperienceModeContext.Provider>
  );
}

export function useExperienceMode(): ExperienceModeContextValue {
  const ctx = useContext(ExperienceModeContext);
  if (!ctx) {
    // Fallback outside the provider: Standard, mutations are no-ops. Lets a
    // component opt into the dial without forcing a provider higher up.
    return {
      mode: "standard",
      isStandard: true,
      isExpert: false,
      loaded: false,
      setMode: async () => {},
      toggle: async () => {},
    };
  }
  return ctx;
}
