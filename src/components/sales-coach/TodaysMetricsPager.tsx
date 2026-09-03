"use client";

import { useRef, useState, type TouchEvent } from "react";
import { RepArena } from "./RepArena";
import { TodaysMetrics } from "./doorlog/TodaysMetrics";

/**
 * TodaysMetricsPager — the Macro Mode "Today's Metrics" tab as ONE module with TWO swipeable pages (founder spec
 * 2026-09-04): the gamified rep dashboard (the Arena) as the DEFAULT landing page, and the original door
 * Today's-Metrics field read. Switched by a top segmented toggle AND a horizontal swipe (both, founder-chosen).
 *
 * Why both controls: a swipe alone is invisible + inaccessible (AMD-006 layer-4). The toggle is the primary,
 * tappable/keyboard control; the swipe is the enhancement. The swipe uses a start/end delta (mirrors
 * CareRadialHome) with NO preventDefault, so each pane's native vertical scroll is untouched — only a
 * horizontal-dominant fling flips the page.
 *
 * Layout: this fills the shell's content slot (flex-1 min-h-0). Track is width:200% with two 50% panes translated
 * by page. Pane 0 wraps RepArena in an overflow-y-auto scroller (ra-wrap doesn't scroll itself); pane 1 holds
 * TodaysMetrics, which brings its own flex-1 min-h-0 overflow-y-auto.
 */

const PAGES = [
  { key: "progress", label: "Progress" },
  { key: "metrics", label: "Metrics" },
] as const;

const SWIPE_MIN_PX = 50; // a fling must move at least this far horizontally to count
const SWIPE_H_RATIO = 1.5; // ...and be this much more horizontal than vertical (so it never hijacks scroll)

export function TodaysMetricsPager() {
  const [page, setPage] = useState(0); // 0 = Progress (gamified, the default), 1 = Metrics
  const start = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = (e: TouchEvent) => {
    const t = e.touches[0];
    start.current = t ? { x: t.clientX, y: t.clientY } : null;
  };
  const onTouchEnd = (e: TouchEvent) => {
    const s = start.current;
    start.current = null;
    const t = e.changedTouches[0];
    if (!s || !t) return;
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy) * SWIPE_H_RATIO) return; // scroll / tap, not a swipe
    setPage((p) => Math.max(0, Math.min(PAGES.length - 1, p + (dx < 0 ? 1 : -1)))); // left → next, right → prev
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
            role="tab"
            type="button"
            aria-selected={page === i}
            onClick={() => setPage(i)}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
              page === i ? "bg-brand text-white" : "bg-white/5 text-muted hover:text-primary"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Pager viewport — the swipe surface. overflow-hidden clips the off-screen pane. */}
      <div className="min-h-0 flex-1 overflow-hidden" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div
          className="flex h-full transition-transform duration-300 ease-out motion-reduce:transition-none"
          style={{ width: "200%", transform: `translateX(-${page * 50}%)` }}
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
