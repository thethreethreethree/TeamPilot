"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Users, Upload, CalendarClock, ShieldCheck } from "lucide-react";

/**
 * Schedule Management System — the sub-nav shared across the schedule surfaces (Phase 5). Self-contained
 * (does not touch the app Sidebar): tabs between the grid, the roster, and the file import. Active tab is
 * derived from the path.
 */

const TABS = [
  { href: "/dashboard/schedule/grid", label: "Schedule", icon: CalendarDays },
  { href: "/dashboard/schedule", label: "Roster", icon: Users, exact: true },
  { href: "/dashboard/schedule/timeoff", label: "Time Off", icon: CalendarClock },
  { href: "/dashboard/schedule/coverage", label: "Coverage", icon: ShieldCheck },
  { href: "/dashboard/schedule/import", label: "Import", icon: Upload },
] as const;

export function ScheduleNav() {
  const path = usePathname();
  return (
    <nav className="flex items-center gap-1 mb-4">
      {TABS.map((t) => {
        const active = "exact" in t && t.exact ? path === t.href : path === t.href || path.startsWith(`${t.href}/`);
        const Icon = t.icon;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              active ? "bg-ember-400/10 text-primary" : "text-secondary hover:bg-surface"
            }`}
          >
            <Icon className="w-4 h-4" aria-hidden />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
