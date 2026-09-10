"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * MobileHomePager — the swipeable two-page Home for a Macro-Mode rep (docs/2ND MAIN PANEL DASKBOARD; founder
 * "Door Tracker Screen" mockup, 2026-09-10). Page 0 is the door tracker; swiping left reaches the original
 * Macro home (page 1). Two dots below track the position; a hint tells the rep the other page is there.
 *
 * Founder decisions (INSPECTION.md): open on page 0 every launch — the index is NOT persisted (reset on cold
 * load / first open, which a fresh mount gives us), and the Home bottom-tab snaps back to page 0 (Q6/Q8). The
 * swipe is native horizontal scroll-snap (no gesture library) — each page scrolls vertically inside itself, the
 * track scrolls horizontally between them, so the two axes don't fight.
 */
export function MobileHomePager({ pages }: { pages: ReactNode[] }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  // Open on page 0 on every mount — a fresh mount is exactly "cold load / first open / navigated back" (Q6).
  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollLeft = 0;
    setActive(0);
  }, []);

  // Home bottom-tab → snap back to page 0 (Q8). SalesCoachShell fires this when Home is tapped while already
  // on the home route (Next.js won't remount the page in that case, so an event is how we hear about it).
  useEffect(() => {
    const toHome = () => {
      const el = scrollerRef.current;
      if (el) {
        // scrollTo isn't present in every environment (e.g. jsdom) — fall back to scrollLeft.
        if (typeof el.scrollTo === "function") el.scrollTo({ left: 0, behavior: "smooth" });
        else el.scrollLeft = 0;
      }
      setActive(0);
    };
    window.addEventListener("elostate:home-tab", toHome);
    return () => window.removeEventListener("elostate:home-tab", toHome);
  }, []);

  const onScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el || el.clientWidth === 0) return;
    setActive(Math.round(el.scrollLeft / el.clientWidth));
  }, []);

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="flex-1 min-h-0 flex overflow-x-auto overflow-y-hidden snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {pages.map((p, i) => (
          <div key={i} className="w-full shrink-0 snap-start overflow-y-auto">
            {p}
          </div>
        ))}
      </div>

      {/* Pager dots + a hint at where the other page is (mockup). */}
      <div className="shrink-0 pt-1.5 pb-1">
        <div className="flex items-center justify-center gap-1.5" aria-hidden>
          {pages.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 w-1.5 rounded-full transition-colors ${i === active ? "bg-ember-400" : "bg-white/20"}`}
            />
          ))}
        </div>
        <p className="text-center text-[10px] uppercase tracking-[0.12em] text-muted mt-1.5">
          {active === 0 ? "Swipe left for your home screen" : "Swipe right for your door tracker"}
        </p>
      </div>
    </div>
  );
}
