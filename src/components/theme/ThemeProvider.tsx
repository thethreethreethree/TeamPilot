"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

/**
 * Theme system — three-state switcher: system | light | dark.
 *
 * Architecture:
 * - The pre-paint script in layout.tsx already set `data-theme` on <html>
 *   before this component mounts. That prevents the flash. This provider's
 *   job is to (a) keep the user's preference in React state, (b) write to
 *   localStorage on change, (c) re-resolve "system" mode when the OS pref
 *   changes mid-session, and (d) expose a context the toggle reads from.
 *
 * - We track BOTH the user's preference (`system`/`light`/`dark`) and the
 *   resolved mode (`light`/`dark`). The UI shows the preference; the page
 *   styling uses the resolved mode. They diverge whenever pref==='system'.
 *
 * - localStorage key is versioned (`execos.theme.v1`) so we can ship a
 *   breaking redesign later without inheriting stale state.
 */

export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "execos.theme.v1";

type ThemeContextValue = {
  /** What the user explicitly chose (or 'system'). */
  preference: ThemePreference;
  /** What's currently painted. */
  resolved: ResolvedTheme;
  setPreference: (p: ThemePreference) => void;
  /** Convenience for toggle buttons that only flip light↔dark. */
  toggle: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveSystem(): ResolvedTheme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

function resolve(pref: ThemePreference): ResolvedTheme {
  if (pref === "light" || pref === "dark") return pref;
  return resolveSystem();
}

function applyToDom(mode: ResolvedTheme) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", mode);
  // Hint to the browser's UI (form controls, scrollbars) about the mode.
  document.documentElement.style.colorScheme = mode;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Read initial preference from localStorage. The DOM is already correct
  // (pre-paint script did that work) so we just mirror the state into React.
  const [preference, setPreferenceState] = useState<ThemePreference>(() => {
    if (typeof window === "undefined") return "system";
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "light" || stored === "dark" || stored === "system") {
        return stored;
      }
    } catch {
      // localStorage unavailable — fall through to default.
    }
    return "system";
  });

  const [resolved, setResolved] = useState<ResolvedTheme>(() =>
    resolve(preference)
  );

  // Re-resolve when the OS preference changes — only matters if user is
  // on 'system'. Without this, a user who flips their OS to dark mode at
  // night sees no change in our app until reload.
  useEffect(() => {
    if (preference !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const handler = () => {
      const next = resolveSystem();
      setResolved(next);
      applyToDom(next);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    const nextResolved = resolve(next);
    setResolved(nextResolved);
    applyToDom(nextResolved);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage write failed (private browsing, quota) — non-fatal. The
      // change still applies this session; it just won't persist.
    }
  }, []);

  const toggle = useCallback(() => {
    // Flip the *resolved* mode. If the user is currently on 'system' and
    // the resolved value is dark, this moves them to an explicit 'light'.
    // This is the behavior people expect from a one-click toggle — they
    // want the screen to flip, not to argue about preferences.
    setPreference(resolved === "dark" ? "light" : "dark");
  }, [resolved, setPreference]);

  const value = useMemo<ThemeContextValue>(
    () => ({ preference, resolved, setPreference, toggle }),
    [preference, resolved, setPreference, toggle]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Defensive — if a component reaches for the theme outside the
    // provider, render decisions that depend on it would silently break.
    // Throwing here surfaces the bug at the call site.
    throw new Error("useTheme must be used inside <ThemeProvider>");
  }
  return ctx;
}
