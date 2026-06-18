"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useTheme } from "@/components/theme/ThemeProvider";

/**
 * Learning Mode is two states:
 *
 *   - `enabled`: persistent user preference (profiles.
 *     learning_mode_enabled). When true, the lightbulb FAB renders
 *     in the dashboard chrome. Per migration 0051 — also forces
 *     dark mode at toggle-on time, since the lightbulb-on-dark
 *     metaphor is the brand made literal.
 *
 *   - `active`: transient session state. True when the user has
 *     clicked the lightbulb FAB to be IN learning mode RIGHT NOW
 *     (every LearningHint pulses, hovers show popovers). Not
 *     persisted — every fresh dashboard load starts with the
 *     lightbulb dark, the user clicks once to light it.
 *
 * Constraint: `active` only renders effects when the resolved theme
 * is dark. If the user is in light mode, the FAB hides and hints
 * stay dormant. The Settings page surfaces this explicitly so the
 * gate is honest, not surprising.
 */
/** The full context a hint provides — used both for the structured
 *  popover render AND as seed context when the user clicks "Ask Jeff
 *  what this does." Jeff reads these fields to answer follow-up
 *  questions about THIS specific feature. */
export type LearningHintContext = {
  title: string;
  whatItIs: string;
  why: string;
  how: string;
  principle?: string;
  category?: string;
};

type LearningModeContextValue = {
  enabled: boolean;
  active: boolean;
  /** Resolved theme is dark — only when this is true do hints
   *  actually render. */
  isDark: boolean;
  /** Combined "should hints render right now" — enabled && active
   *  && isDark. Components import this and skip the popover work
   *  when false. */
  shouldRender: boolean;
  toggleEnabled: () => Promise<void>;
  setActive: (next: boolean) => void;
  /** When a hint's "Ask Jeff what this does" button is clicked, the
   *  hint calls this with its own context. The provider opens the
   *  Ask Jeff slide-out and seeds it with the feature. */
  askJeff: (context: LearningHintContext) => void;
  /** Slide-out state — the panel reads this. Null = closed. */
  askJeffContext: LearningHintContext | null;
  closeAskJeff: () => void;
};

const LearningModeContext = createContext<LearningModeContextValue | null>(
  null
);

export function LearningModeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { resolved, setPreference } = useTheme();
  const [enabled, setEnabled] = useState(false);
  const [active, setActive] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [askJeffContext, setAskJeffContext] =
    useState<LearningHintContext | null>(null);

  // Initial load — pull the user's preference once.
  useEffect(() => {
    let cancelled = false;
    void fetch("/api/me/learning-mode")
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          setLoaded(true);
          return;
        }
        const data = await res.json();
        setEnabled(Boolean(data.enabled));
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const isDark = resolved === "dark";

  // If the user switches to light mode (e.g., via ThemeToggle) while
  // active, retract the pulses. The next switch back to dark will
  // require another lightbulb click. This makes the dark-mode-only
  // contract self-enforcing.
  useEffect(() => {
    if (!isDark && active) setActive(false);
  }, [isDark, active]);

  const toggleEnabled = useCallback(async () => {
    const next = !enabled;
    setEnabled(next);
    // When enabling, force dark mode — the lightbulb metaphor only
    // lands against a dark surface. When disabling, leave the theme
    // alone (the user may have chosen dark for their own reasons).
    if (next && resolved !== "dark") {
      setPreference("dark");
    }
    try {
      await fetch("/api/me/learning-mode", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
    } catch {
      // Best-effort. The next page load will reconcile from the
      // server. We don't roll back the local toggle because that
      // would feel buggier than a silent retry on next mutation.
    }
    if (!next) setActive(false);
  }, [enabled, resolved, setPreference]);

  const shouldRender = enabled && active && isDark;

  const askJeff = useCallback(
    (ctx: LearningHintContext) => setAskJeffContext(ctx),
    []
  );
  const closeAskJeff = useCallback(() => setAskJeffContext(null), []);

  const value = useMemo(
    () => ({
      enabled,
      active,
      isDark,
      shouldRender,
      toggleEnabled,
      setActive,
      askJeff,
      askJeffContext,
      closeAskJeff,
    }),
    [
      enabled,
      active,
      isDark,
      shouldRender,
      toggleEnabled,
      askJeff,
      askJeffContext,
      closeAskJeff,
    ]
  );

  // Render nothing until we've checked the server preference —
  // prevents a flash where the FAB appears, then disappears on a
  // user whose preference was already false.
  if (!loaded) return <>{children}</>;
  return (
    <LearningModeContext.Provider value={value}>
      {children}
    </LearningModeContext.Provider>
  );
}

export function useLearningMode(): LearningModeContextValue {
  const ctx = useContext(LearningModeContext);
  if (!ctx) {
    // Fallback when used outside the provider — every value is
    // off, every mutation is a no-op. Lets components opt in to
    // Learning Mode without forcing a provider higher up.
    return {
      enabled: false,
      active: false,
      isDark: false,
      shouldRender: false,
      toggleEnabled: async () => {},
      setActive: () => {},
      askJeff: () => {},
      askJeffContext: null,
      closeAskJeff: () => {},
    };
  }
  return ctx;
}
