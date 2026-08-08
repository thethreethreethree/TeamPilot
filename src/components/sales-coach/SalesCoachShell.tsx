"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useIsSalesCoachManager } from "@/lib/hooks/useCurrentUserRole";
import { filterManagerNavSections } from "@/lib/nav/managerNav";
import { ONE_LINERS_LABEL } from "@/lib/coach/labels";
import { LearningModeFab } from "@/components/learning/LearningModeFab";
import {
  NavProgressProvider,
  NavProgressBar,
  LinkProgress,
} from "@/components/sales-coach/ui/NavigationProgress";
import {
  ArrowLeft,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  GraduationCap,
  Home,
  Library,
  MessageSquare,
  Mic,
  Puzzle,
  Settings,
  Target,
  TrendingUp,
  Users,
  Video,
  User,
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

type NavItem = {
  label: string;
  href: string;
  icon: typeof Home;
  /** Manager-only destination (server-gated: sales_coach_role='admin' OR company admin). Hidden from
   *  the nav for reps so a staff user never clicks a nav item that bounces them (AMD-006 L3). */
  managerOnly?: boolean;
  /** Destination OUTSIDE this fixed-overlay shell (e.g. the extension download page). Opens in a new tab
   *  (target=_blank) so the Sales Coach app stays open behind it, and is excluded from active-state —
   *  mirrors the C.A.R.E "Browser extension" nav entry (CareShell.tsx). */
  external?: boolean;
};

/** A grouped run of nav items under an optional section header. */
type NavSection = { header?: string; items: NavItem[] };

// Founder decision 2026-08-01: the sidebar is a FLAT list in the founder's July-28 PDF order (the earlier
// 2026-07-31 grouping into "Manager Dashboard"/"Team Tools" was reverted at the founder's request). One
// headerless section renders as a flat list — no section headers, no per-item numbering. Item gating is
// unchanged (Coach Assessment + Team stay server-gated / manager-only; hidden from a rep's nav — AMD-006 L3).
// "One Liners" is the universal label now (was a Standard-only relabel of "Strategy"); route path kept as
// /strategy so existing links don't break. Team Chat + KPI Analytics are kept (real features built AFTER the
// July-28 list) after Team, before Settings.
const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { label: "Home", href: "/dashboard/sales-coach", icon: Home },
      { label: "Coach Assessment", href: "/dashboard/sales-coach/coach-assessment", icon: ClipboardCheck, managerOnly: true },
      { label: "Analytics", href: "/dashboard/sales-coach/analytics", icon: BarChart3 },
      { label: "Sessions", href: "/dashboard/sales-coach/sessions", icon: Mic },
      { label: "Roleplay", href: "/dashboard/sales-coach/roleplay", icon: Target },
      { label: ONE_LINERS_LABEL, href: "/dashboard/sales-coach/strategy", icon: Library },
      { label: "Team", href: "/dashboard/sales-coach/team", icon: Users, managerOnly: true },
      { label: "Team Chat", href: "/dashboard/sales-coach/team-chat", icon: MessageSquare },
      { label: "KPI Analytics", href: "/dashboard/sales-coach/kpi", icon: TrendingUp },
      // Browser extension — mirrors the C.A.R.E sidebar's "Browser extension" nav entry (founder request:
      // surface the Sales Coach extension the same way C.A.R.E does, not only as inline page cards). Opens the
      // download + install page in a new tab (external → leaves this fixed-overlay shell cleanly).
      { label: "Browser extension", href: "/extension/download-sales", icon: Puzzle, external: true },
      { label: "Settings", href: "/dashboard/sales-coach/settings", icon: Settings },
    ],
  },
];

// Mobile bottom tab bar (founder 2026-07-04 PWA design). Per the founder's
// annotated mockup: the "Practice" slot → Analytics, "Feedback" slot → Team
// Chat (Roleplay + Pitch Performance are Home cards, not tabs). Team is dropped
// on mobile (lives on the website version).
const MOBILE_TABS: NavItem[] = [
  { label: "Home", href: "/dashboard/sales-coach", icon: Home },
  { label: "Analytics", href: "/dashboard/sales-coach/analytics", icon: BarChart3 },
  { label: "Sessions", href: "/dashboard/sales-coach/sessions", icon: Video },
  {
    label: "Team Chat",
    href: "/dashboard/sales-coach/team-chat",
    icon: MessageSquare,
  },
  { label: "Account", href: "/dashboard/sales-coach/settings", icon: User },
];

export function SalesCoachShell({
  children,
  // Module hard-lock (0207): true for a single-module (sales_coach-locked) account — it can't return to the
  // ELOSTATE hub (the middleware redirects it straight back), so the "Back to ELOSTATE" link is hidden.
  locked = false,
}: {
  children: React.ReactNode;
  locked?: boolean;
}) {
  const pathname = usePathname() ?? "";
  const [collapsed, setCollapsed] = useState(false);
  // Hide manager-only desktop nav items (Team, Coach Assessment — server-gated) from reps so a staff
  // user never clicks a nav entry that bounces them (AMD-006 L3). isManager is false while loading →
  // items stay hidden until confirmed (safe direction). MOBILE_TABS has no manager items, so it's unaffected.
  const isSalesCoachManager = useIsSalesCoachManager();
  // Filter manager-only items WITHIN each section, then drop any section left empty (so a rep never sees a
  // bare "Manager Dashboard" heading with nothing under it — AMD-006 L3). Shared + tested helper.
  const visibleSections = filterManagerNavSections(NAV_SECTIONS, isSalesCoachManager);
  return (
    <NavProgressProvider>
    <div className="fixed inset-0 z-[60] flex flex-col md:flex-row bg-base overflow-hidden">
      {collapsed ? (
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          aria-label="Expand Sales Coach navigation"
          title="Expand navigation"
          className="w-6 flex-shrink-0 bg-ember-400/[0.08] border-r border-ember-400/40 hidden md:flex items-center justify-center text-brand hover:text-primary hover:bg-ember-400/20 transition-colors"
        >
          <ChevronRight className="w-4 h-4" aria-hidden />
        </button>
      ) : (
        <aside className="w-56 flex-shrink-0 bg-brand-shell text-white/90 border-r border-white/[0.06] hidden md:flex flex-col h-full">
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
                <p className="text-[9px] uppercase tracking-widest text-white/50 mt-0.5">
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

          {/* Nav — grouped into sections (founder mockup 2026-07-31). Each section renders its header (when
              present) then its items; an ungrouped section (Home; the Team Chat/KPI/Settings run) has no
              header. */}
          <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
            {visibleSections.map((section, si) => (
              <div key={section.header ?? `group-${si}`} className="space-y-0.5">
                {section.header && (
                  <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-white/50">
                    {section.header}
                  </p>
                )}
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active =
                    !item.external &&
                    (pathname === item.href ||
                      (item.href !== "/dashboard/sales-coach" &&
                        pathname.startsWith(item.href + "/")));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      {...(item.external
                        ? { target: "_blank", rel: "noopener noreferrer" }
                        : {})}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        active
                          ? "bg-white/10 text-white"
                          : "text-white/70 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      <LinkProgress />
                      <Icon className="w-4 h-4 shrink-0" aria-hidden />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>

          {/* Back to ELOSTATE — hidden for a module-locked account (it can't reach the hub; the middleware
              redirects it straight back, so the link would be a dead loop). */}
          {!locked && (
            <div className="px-2 pt-2 border-t border-white/[0.06] pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <Link
                href="/dashboard"
                className="flex items-center gap-2 px-3 py-2 rounded-md text-[11px] text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" aria-hidden />
                Back to ELOSTATE
              </Link>
            </div>
          )}
        </aside>
      )}

      <main className="relative flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Route-transition progress bar, pinned to the top of the content
            area (founder 2026-07-03). Driven by the sidebar links' pending
            state via useLinkStatus. */}
        <NavProgressBar />
        {children}
      </main>

      {/* Learning Mode lightbulb — the dashboard layout renders one too, but it
          sits at z-40 BEHIND this z-[60] shell overlay, so it's invisible in
          Sales Coach. Render it here (inside the shell's stacking context) so
          the lightbulb is reachable, exactly like Elostate (§A21 — SAME
          provider/context from the parent dashboard layout, no second
          provider; the Ask Jeff panel + hint popovers already surface above the
          shell via z-[60] / a body portal). */}
      {/* Mobile bottom tab bar — the PWA nav (founder 2026-07-04). A flex
          sibling below <main> in the mobile column layout, so content sits
          above it with no overlap; hidden on desktop (the sidebar takes over). */}
      <nav className="md:hidden flex-shrink-0 flex items-stretch justify-around bg-brand-shell border-t border-white/[0.08] pt-1.5 pb-[max(0.4rem,env(safe-area-inset-bottom))]">
        {MOBILE_TABS.map((tab) => {
          const Icon = tab.icon;
          const active =
            pathname === tab.href ||
            (tab.href !== "/dashboard/sales-coach" &&
              pathname.startsWith(tab.href + "/"));
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 py-1 text-[10px] font-medium transition-colors ${
                active ? "text-brand" : "text-white/50 hover:text-white/80"
              }`}
            >
              <LinkProgress />
              <Icon className="w-5 h-5" aria-hidden />
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <LearningModeFab />
    </div>
    </NavProgressProvider>
  );
}
