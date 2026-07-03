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
      setVisible(true);
      setWidth(8);
      const t1 = setTimeout(() => setWidth(65), 120);
      const t2 = setTimeout(() => setWidth(88), 450);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
    // Completion: finish the bar, then fade it out.
    setWidth(100);
    const t = setTimeout(() => {
      setVisible(false);
      setWidth(0);
    }, 280);
    return () => clearTimeout(t);
  }, [active]);

  if (!visible) return null;
  return (
    <div
      className="pointer-events-none absolute top-0 inset-x-0 h-0.5 z-[70]"
      aria-hidden
    >
      <div
        className="h-full bg-gradient-to-r from-ember-300 to-ember-500 shadow-[0_0_8px_rgba(250,204,21,0.7)] transition-[width] duration-300 ease-out"
        style={{ width: `${width}%` }}
      />
    </div>
  );
}
