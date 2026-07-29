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

function isPref(v: unknown): v is ThemePreference {
  return v === "light" || v === "dark" || v === "system";
}

/**
 * Decide which preference a freshly-loaded device should adopt, given the local
 * cache and the DB (per-user override + company default). Pure so it is unit-testable.
 *
 * Rules (founder 2026-07-28 — company default + per-user override):
 * - A device that ALREADY has an explicit local choice wins; never override it.
 * - No local choice → a personal DB preference (saved on another device) wins AND is
 *   cached locally (it is a real choice, so caching it makes future loads flash-free).
 * - Else the company default applies but is NOT cached, so the device keeps tracking
 *   later company-default changes instead of freezing the first one it saw.
 */
export function reconcileTheme(args: {
  localRaw: string | null;
  dbPref: ThemePreference | null;
  companyDefault: ThemePreference | null;
}): { preference: ThemePreference | null; shouldCache: boolean } {
  const { localRaw, dbPref, companyDefault } = args;
  if (isPref(localRaw)) return { preference: null, shouldCache: false };
  if (isPref(dbPref)) return { preference: dbPref, shouldCache: true };
  if (isPref(companyDefault)) return { preference: companyDefault, shouldCache: false };
  return { preference: null, shouldCache: false };
}

/** Persist the user's theme choice cross-device (guarded, fire-and-forget). */
function persistThemePreference(preference: ThemePreference): void {
  try {
    void fetch("/api/me/theme", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preference }),
    }).catch(() => {
      /* offline / unauthenticated / migration pending — non-fatal */
    });
  } catch {
    /* fetch unavailable — non-fatal */
  }
}

function applyToDom(mode: ResolvedTheme) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", mode);
  // Hint to the browser's UI (form controls, scrollbars) about the mode.
  document.documentElement.style.colorScheme = mode;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // SSR-safe initial state. We deliberately do NOT read localStorage in
  // the useState initializer: that would diverge from the server's render
  // (where localStorage is undefined) and trigger React's hydration
  // mismatch warning on the very next interactive surface (the toggle
  // pill highlighting a different option than what the server painted).
  //
  // The DOM's data-theme attribute is already correct because the
  // pre-paint inline script in layout.tsx set it before React mounted —
  // so the page LOOKS right from frame zero. Only this React state is
  // out of sync, and we rectify it in the post-mount effect below.
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [resolved, setResolved] = useState<ResolvedTheme>("dark");

  // After mount: pull the actual stored preference and resolved mode.
  // This may flip the toggle's active pill by one frame on first load,
  // which is an acceptable trade for eliminating the hydration warning.
  useEffect(() => {
    let cancelled = false;
    let localRaw: string | null = null;
    try {
      localRaw = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      /* storage unavailable — keep default */
    }
    const stored: ThemePreference = isPref(localRaw) ? localRaw : "system";
    const actual = resolve(stored);
    setPreferenceState(stored);
    setResolved(actual);
    // The pre-paint script already set data-theme, but if storage was
    // changed since that paint (another tab), re-sync the DOM now.
    applyToDom(actual);

    // If this device has NO explicit choice, reconcile from the DB: a personal
    // preference saved on another device, else the company default. Guarded — any
    // failure (offline, unauthenticated, migration 0201 pending) leaves the
    // localStorage-only behavior above intact (A34, non-breaking).
    if (localRaw === null) {
      (async () => {
        try {
          const res = await fetch("/api/me/theme");
          if (!res.ok || cancelled) return;
          // Re-read localStorage: the user may have picked a theme WHILE this fetch
          // was in flight (setPreference writes it synchronously). If so, their choice
          // wins — applying the DB/company value now would silently revert it. Passing
          // the FRESH value to reconcileTheme makes it skip when a local choice exists.
          let freshRaw: string | null = null;
          try {
            freshRaw = window.localStorage.getItem(STORAGE_KEY);
          } catch {
            /* storage unavailable */
          }
          if (freshRaw !== null || cancelled) return;
          const data = (await res.json()) as {
            preference?: ThemePreference | null;
            companyDefault?: ThemePreference | null;
          };
          const { preference: chosen, shouldCache } = reconcileTheme({
            localRaw: freshRaw,
            dbPref: isPref(data.preference) ? data.preference : null,
            companyDefault: isPref(data.companyDefault) ? data.companyDefault : null,
          });
          if (cancelled || !chosen) return;
          setPreferenceState(chosen);
          const r = resolve(chosen);
          setResolved(r);
          applyToDom(r);
          if (shouldCache) {
            try {
              window.localStorage.setItem(STORAGE_KEY, chosen);
            } catch {
              /* non-fatal */
            }
          }
        } catch {
          /* keep localStorage-only behavior */
        }
      })();
    }
    return () => {
      cancelled = true;
    };
  }, []);

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
    // Persist cross-device (guarded, fire-and-forget). A failure — offline,
    // unauthenticated, or migration 0201 pending — is non-fatal: the choice
    // already applied this session via state + localStorage above.
    persistThemePreference(next);
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
