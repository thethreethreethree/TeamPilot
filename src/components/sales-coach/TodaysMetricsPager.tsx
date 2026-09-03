"use client";

import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { RepArena } from "./RepArena";
import { TodaysMetrics } from "./doorlog/TodaysMetrics";

/**
 * TodaysMetricsPager — the Macro Mode "Today's Metrics" tab as ONE module with TWO pages (founder spec 2026-09-04):
 * the gamified rep dashboard (the Arena) as the DEFAULT landing page, and the original door Today's-Metrics field
 * read. Switched by a top segmented toggle, arrow keys (WAI-ARIA tabs), AND a finger-follow swipe.
 *
 * The swipe TRACKS the finger (drag-follow, not snap-on-release): the track translates with the drag and snaps to
 * the nearest page on release. Touch is handled natively (non-passive touchmove) so a horizontal-locked drag can
 * preventDefault — but the axis is locked on the first move, so a vertical gesture is left entirely to the pane's
 * own scroll (the drag never engages, nothing is prevented). Edge drags rubber-band (×0.35) instead of showing blank.
 *
 * Layout: fills the shell's flex-1 min-h-0 slot. Track width:200% with two 50% panes. Pane 0 wraps RepArena in an
 * overflow-y-auto scroller (ra-wrap doesn't scroll itself); pane 1 holds TodaysMetrics (its own scroll).
 */

const PAGES = [
  { key: "progress", label: "Progress" },
  { key: "metrics", label: "Metrics" },
] as const;

const AXIS_LOCK_PX = 8; // movement past this decides the gesture's axis (horizontal drag vs vertical scroll)
const EDGE_RESISTANCE = 0.35; // drag past an end rubber-bands at this fraction
const SNAP_MIN_PX = 50; // floor for the release distance that commits a page change (jsdom has no layout width)

export function TodaysMetricsPager() {
  const [page, setPage] = useState(0); // 0 = Progress (gamified, the default), 1 = Metrics
  const [dragPx, setDragPx] = useState(0); // live horizontal offset while the finger is down
  const [dragging, setDragging] = useState(false); // true = follow the finger (transition off)

  const viewport = useRef<HTMLDivElement | null>(null);
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const axisRef = useRef<null | "h" | "v">(null);
  const widthRef = useRef(0);
  const pageRef = useRef(0);
  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  // Native touch listeners (attached once): touchmove is NON-passive so a horizontal-locked drag can preventDefault.
  useEffect(() => {
    const vp = viewport.current;
    if (!vp) return;

    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      startRef.current = { x: t.clientX, y: t.clientY };
      axisRef.current = null;
      widthRef.current = vp.clientWidth;
    };
    const onMove = (e: TouchEvent) => {
      const s = startRef.current;
      const t = e.touches[0];
      if (!s || !t) return;
      const dx = t.clientX - s.x;
      const dy = t.clientY - s.y;
      if (axisRef.current === null) {
        if (Math.abs(dx) < AXIS_LOCK_PX && Math.abs(dy) < AXIS_LOCK_PX) return; // not enough to decide yet
        axisRef.current = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
      }
      if (axisRef.current !== "h") return; // vertical gesture → leave the pane's scroll alone (nothing prevented)
      e.preventDefault(); // horizontal drag owns the gesture now
      const atStartEdge = pageRef.current === 0 && dx > 0;
      const atEndEdge = pageRef.current === PAGES.length - 1 && dx < 0;
      setDragging(true);
      setDragPx(atStartEdge || atEndEdge ? dx * EDGE_RESISTANCE : dx);
    };
    const onEnd = (e: TouchEvent) => {
      const s = startRef.current;
      startRef.current = null;
      const wasHorizontal = axisRef.current === "h";
      axisRef.current = null;
      setDragging(false);
      setDragPx(0);
      const t = e.changedTouches[0];
      if (!s || !t || !wasHorizontal) return;
      const dx = t.clientX - s.x;
      const threshold = Math.max(widthRef.current * 0.22, SNAP_MIN_PX);
      if (Math.abs(dx) > threshold) {
        setPage((p) => Math.max(0, Math.min(PAGES.length - 1, p + (dx < 0 ? 1 : -1))));
      }
    };

    vp.addEventListener("touchstart", onStart, { passive: true });
    vp.addEventListener("touchmove", onMove, { passive: false });
    vp.addEventListener("touchend", onEnd, { passive: true });
    vp.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      vp.removeEventListener("touchstart", onStart);
      vp.removeEventListener("touchmove", onMove);
      vp.removeEventListener("touchend", onEnd);
      vp.removeEventListener("touchcancel", onEnd);
    };
  }, []);

  // WAI-ARIA tabs contract: declaring role=tablist means Arrow keys move between tabs (roving tabindex below).
  const onTabKeyDown = (e: ReactKeyboardEvent) => {
    const n = PAGES.length;
    let next = page;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (page + 1) % n;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (page - 1 + n) % n;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = n - 1;
    else return;
    e.preventDefault();
    setPage(next);
    tabs.current[next]?.focus();
  };

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col bg-base">
      {/* Segmented toggle — the primary, accessible control (swipe is the enhancement). */}
      <div
        role="tablist"
        aria-label="Dashboard view"
        className="flex flex-shrink-0 gap-1 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2"
      >
        {PAGES.map((p, i) => (
          <button
            key={p.key}
            ref={(el) => {
              tabs.current[i] = el;
            }}
            role="tab"
            type="button"
            aria-selected={page === i}
            tabIndex={page === i ? 0 : -1} // roving tabindex: only the selected tab is in the tab order (WAI-ARIA)
            onClick={() => setPage(i)}
            onKeyDown={onTabKeyDown}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
              page === i ? "bg-brand text-white" : "bg-white/5 text-muted hover:text-primary"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Pager viewport — the swipe surface (native listeners above). overflow-hidden clips the off-screen pane. */}
      <div ref={viewport} className="min-h-0 flex-1 overflow-hidden">
        <div
          className="flex h-full duration-300 ease-out motion-reduce:transition-none"
          style={{
            width: "200%",
            transform: `translateX(calc(-${page * 50}% + ${dragPx}px))`,
            transition: dragging ? "none" : "transform 300ms ease-out", // follow the finger; animate the snap
          }}
        >
          {/* Pane 0 — the gamified Arena (needs a scroll parent). */}
          <div
            role="tabpanel"
            aria-label="Progress"
            aria-hidden={page !== 0}
            className="h-full overflow-y-auto"
            style={{ width: "50%" }}
          >
            <RepArena />
          </div>

          {/* Pane 1 — the original door Today's-Metrics (brings its own scroll). */}
          <div
            role="tabpanel"
            aria-label="Metrics"
            aria-hidden={page !== 1}
            className="flex h-full flex-col"
            style={{ width: "50%" }}
          >
            <TodaysMetrics />
          </div>
        </div>
      </div>
    </div>
  );
}
