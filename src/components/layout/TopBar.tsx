"use client";

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

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="h-16 border-b border-default bg-base/80 backdrop-blur-sm flex items-center justify-between px-6 sticky top-0 z-30">
      <div>
        <h1 className="text-lg font-semibold text-primary">{title}</h1>
        {subtitle && (
          <p className="text-xs text-muted">{subtitle}</p>
        )}
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
