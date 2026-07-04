"use client";

import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { formatDate, formatTime } from "@/lib/utils";
import { useState, useEffect } from "react";

interface TopBarProps {
  title: string;
  subtitle?: string;
}

/**
 * Page header. Intentionally minimal — the fake search/notifications/refresh
 * buttons it used to carry were "surface, don't overtake" violations (Rule 2):
 * affordances that imply capability the product does not have. They will return
 * only when they back real functionality.
 */
export default function TopBar({ title, subtitle }: TopBarProps) {
  const [now, setNow] = useState<Date | null>(null);
  // The hamburger toggles the ELOSTATE dashboard sidebar. Sales Coach runs in
  // its own full-screen shell with its own nav (desktop sidebar / mobile bottom
  // tab bar), so that sidebar isn't there — the button did nothing. Hide it on
  // Sales Coach routes (founder 2026-07-04: "hamburger not working").
  const pathname = usePathname() ?? "";
  const inSalesCoach = pathname.startsWith("/dashboard/sales-coach");

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const openMenu = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("elostate:toggle-sidebar"));
    }
  };

  return (
    // The pt-[env(safe-area-inset-top)] class below pushes the bar's
    // content BELOW the iOS status bar zone when the PWA runs in
    // standalone with viewport-fit=cover. On Android/desktop where
    // the inset is 0px, no visual change. Tailwind arbitrary value
    // syntax is more reliable than a React inline style for env()
    // CSS functions — the JIT compiler emits a real CSS rule with
    // the env() function, where inline styles can sometimes get
    // string-sanitized in transit.
    //
    // The Tailwind JIT scans source files including comments for
    // arbitrary-value class names, so DO NOT write the bracketed
    // class with literal "..." placeholders here — that gets
    // compiled into a broken CSS rule (padding-top: env(...);) and
    // fails Turbopack's CSS parse. Spell the env() arg out in full.
    //
    // min-h-* (instead of h-*) so the bar grows tall enough to
    // contain BOTH the safe-area buffer AND the original h-11/h-16
    // content area. With box-sizing: border-box (the default) and
    // a fixed height, the padded-down content would have squeezed.
    <header
      className="pt-[env(safe-area-inset-top)] min-h-11 md:min-h-16 border-b border-default bg-base/80 backdrop-blur-sm flex items-center justify-between px-3 md:px-6 sticky top-0 z-30 gap-2 md:gap-3"
    >
      <div className="flex items-center gap-2 min-w-0">
        {!inSalesCoach && (
          <button
            type="button"
            onClick={openMenu}
            aria-label="Open menu"
            // p-2.5 + 5x5 icon = ~40px tap target (close to WCAG 44).
            // Previously p-1.5 made the hit area ~28px which fat-finger
            // hits adjacent elements on touch.
            className="md:hidden p-2.5 -ml-1 rounded-lg text-muted hover:text-primary hover:bg-surface-raised flex-shrink-0"
          >
            <Menu className="w-5 h-5" aria-hidden />
          </button>
        )}
        <div className="min-w-0">
          <h1 className="text-sm md:text-lg font-semibold text-primary truncate leading-tight">
            {title}
          </h1>
          {/* Subtitle hidden on mobile — every dashboard page has its
              own context bar directly below the TopBar, so the
              subtitle was duplicating information at the cost of ~20px
              of vertical real estate on every screen. */}
          {subtitle && (
            <p className="hidden md:block text-xs text-muted truncate">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden md:flex items-center gap-2 text-xs text-muted bg-surface border border-default rounded-lg px-3 py-1.5">
          <span>{now ? formatDate(now) : "—"}</span>
          <span className="text-muted">·</span>
          <span className="text-secondary font-mono">
            {now ? formatTime(now) : "—"}
          </span>
        </div>
      </div>
    </header>
  );
}
