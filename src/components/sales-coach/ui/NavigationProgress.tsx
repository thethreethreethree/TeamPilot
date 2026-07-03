"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useLinkStatus } from "next/link";

/**
 * NavigationProgress — the top progress bar for Sales Coach route transitions
 * (the second half of the extracted build's "complete loading coverage":
 * NavigationProgress for link/route navigation, LoadingButton for actions).
 *
 * Prop/context-driven off Next's useLinkStatus (Next 16), NOT a global router
 * event API (App Router has none). Each instrumented <Link> renders a
 * <LinkProgress/> child that reports THAT link's pending state up to a shared
 * counter; the bar shows while any instrumented link's navigation is in flight
 * — so it appears DURING a slow transition, not just after it settles.
 *
 * Scope: wired to the Sales Coach sidebar nav (the primary "click and wait"
 * navigation). In-page links (session rows, etc.) can opt in later by dropping
 * a <LinkProgress/> inside their <Link>.
 */

type Ctx = { active: boolean; inc: () => void; dec: () => void };
const NavCtx = createContext<Ctx | null>(null);

export function NavProgressProvider({ children }: { children: ReactNode }) {
  const [count, setCount] = useState(0);
  const inc = useCallback(() => setCount((c) => c + 1), []);
  const dec = useCallback(() => setCount((c) => Math.max(0, c - 1)), []);
  return (
    <NavCtx.Provider value={{ active: count > 0, inc, dec }}>
      {children}
    </NavCtx.Provider>
  );
}

/**
 * Rendered INSIDE a <Link>. useLinkStatus only reports the nearest parent
 * Link's pending state, so this must be a Link descendant. Renders nothing —
 * it only feeds the shared counter.
 */
export function LinkProgress() {
  const { pending } = useLinkStatus();
  const ctx = useContext(NavCtx);
  useEffect(() => {
    if (!ctx || !pending) return;
    ctx.inc();
    return () => ctx.dec();
  }, [pending, ctx]);
  return null;
}

/**
 * The animated bar. nprogress-style: eases toward ~88% while pending, snaps to
 * 100% and fades on completion. Place it at the top of the scroll/content area
 * (a `relative` ancestor); it's absolutely positioned and non-interactive.
 */
export function NavProgressBar() {
  const ctx = useContext(NavCtx);
  const active = ctx?.active ?? false;
  const [visible, setVisible] = useState(false);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (active) {
      // Start visibly filled so even an instant transition shows a chunk.
      setVisible(true);
      setWidth(25);
      const t1 = setTimeout(() => setWidth(55), 150);
      const t2 = setTimeout(() => setWidth(80), 500);
      const t3 = setTimeout(() => setWidth(92), 1200);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    }
    // Completion: snap to 100% and HOLD long enough to be seen (a fast nav
    // was closing in ~280ms before — too quick to notice), then fade.
    setWidth(100);
    const t = setTimeout(() => {
      setVisible(false);
      setWidth(0);
    }, 550);
    return () => clearTimeout(t);
  }, [active]);

  if (!visible) return null;
  return (
    <div
      className="pointer-events-none absolute top-0 inset-x-0 h-1 z-[70]"
      aria-hidden
    >
      <div
        className="h-full rounded-r-full bg-gradient-to-r from-ember-200 via-ember-400 to-ember-500 shadow-[0_0_14px_3px_rgba(250,204,21,0.95)] transition-[width] duration-300 ease-out"
        style={{ width: `${width}%` }}
      />
    </div>
  );
}
