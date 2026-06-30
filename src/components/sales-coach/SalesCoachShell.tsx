"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  GraduationCap,
  Home,
  MessageSquare,
  Mic,
  Settings,
  Users,
} from "lucide-react";

/**
 * SalesCoachShell — the dedicated app shell for the Sales Coach product
 * (founder request 2026-06-28). Mirrors the C.A.R.E pattern (§A21): own
 * brand header, own left nav, "← Back to ELOSTATE" footer — so Sales
 * Coach reads as its own product.
 *
 * Implementation note (flagged in the build report): unlike CareShell
 * (a normal flex div), this is a FIXED full-viewport overlay so it
 * reliably covers the Elostate sidebar/chrome regardless of route-
 * specific CSS — I couldn't fully reverse-engineer how /care hides the
 * Elostate sidebar, so this guarantees replacement instead of relying
 * on it.
 *
 * UNTESTED at runtime.
 */

type NavItem = { label: string; href: string; icon: typeof Home };

const NAV: NavItem[] = [
  { label: "Home", href: "/dashboard/sales-coach", icon: Home },
  { label: "Sessions", href: "/dashboard/sales-coach/sessions", icon: Mic },
  {
    label: "Team Chat",
    href: "/dashboard/sales-coach/team-chat",
    icon: MessageSquare,
  },
  { label: "Analytics", href: "/dashboard/sales-coach/analytics", icon: BarChart3 },
  { label: "Team", href: "/dashboard/sales-coach/team", icon: Users },
  {
    label: "Coach Assessment",
    href: "/dashboard/sales-coach/coach-assessment",
    icon: ClipboardCheck,
  },
  { label: "Settings", href: "/dashboard/sales-coach/settings", icon: Settings },
];

export function SalesCoachShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="fixed inset-0 z-[60] flex bg-base overflow-hidden">
      {collapsed ? (
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          aria-label="Expand Sales Coach navigation"
          title="Expand navigation"
          className="w-6 flex-shrink-0 bg-ember-400/[0.08] border-r border-ember-400/40 flex items-center justify-center text-brand hover:text-primary hover:bg-ember-400/20 transition-colors"
        >
          <ChevronRight className="w-4 h-4" aria-hidden />
        </button>
      ) : (
        <aside className="w-56 flex-shrink-0 bg-[#0B1620] text-white/90 border-r border-white/[0.06] flex flex-col h-full">
          {/* Brand */}
          <div className="px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
            <div className="flex items-start gap-2">
              <div className="w-7 h-7 rounded-md bg-ember-400 flex items-center justify-center shrink-0">
                <GraduationCap className="w-4 h-4 text-[#09090B]" aria-hidden />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold tracking-tight leading-none">
                  Sales Coach
                </p>
                <p className="text-[9px] uppercase tracking-widest text-white/40 mt-0.5">
                  Live Coaching · Growth Reviews
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCollapsed(true)}
                aria-label="Collapse Sales Coach navigation"
                title="Collapse navigation"
                className="text-white/40 hover:text-white/90 p-1 -mt-0.5 -mr-1 rounded hover:bg-white/5 shrink-0"
              >
                <ChevronLeft className="w-3.5 h-3.5" aria-hidden />
              </button>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
            {NAV.map((item) => {
              const Icon = item.icon;
              const active =
                pathname === item.href ||
                (item.href !== "/dashboard/sales-coach" &&
                  pathname.startsWith(item.href + "/"));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    active
                      ? "bg-white/10 text-white"
                      : "text-white/70 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" aria-hidden />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Back to ELOSTATE */}
          <div className="px-2 pt-2 border-t border-white/[0.06] pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 px-3 py-2 rounded-md text-[11px] text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden />
              Back to ELOSTATE
            </Link>
          </div>
        </aside>
      )}

      <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {children}
      </main>
    </div>
  );
}
