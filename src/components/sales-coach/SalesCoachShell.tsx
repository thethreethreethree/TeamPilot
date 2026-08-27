"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
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
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  GraduationCap,
  Home,
  Library,
  MessageSquare,
  Mic,
  Presentation,
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
  /** Rep-facing destination HIDDEN FROM MANAGERS — its content is relocated for managers (founder 2026-08-28:
   *  Analytics is merged into the Coach Assessment card, so a manager sees it there, not as a separate item; reps
   *  keep their own Analytics self-view). */
  repOnly?: boolean;
  /** Destination OUTSIDE this fixed-overlay shell (e.g. the extension download page). Opens in a new tab
   *  (target=_blank) so the Sales Coach app stays open behind it, and is excluded from active-state —
   *  mirrors the C.A.R.E "Browser extension" nav entry (CareShell.tsx). */
  external?: boolean;
};

/** A grouped run of nav items under an optional section header. A `collapsible` section renders its header as a
 *  toggle button (chevron) that shows/hides its items — see CareShell's "C.A.R.E Tools" expander (A28). */
type NavSection = { header?: string; items: NavItem[]; collapsible?: boolean };

// Founder decision 2026-08-12 (annotated mockup): the sidebar groups Coach Assessment / Analytics / Sessions
// under a COLLAPSIBLE "Manager Dashboard", and Roleplay / One Liners / Team under a COLLAPSIBLE "Team Tools".
// Home stays top-level ABOVE the groups; Team Chat / KPI Analytics / Browser extension / Settings stay top-level
// BELOW them. This re-introduces the grouping that was briefly flattened on 2026-08-01 — the material difference
// the founder now asked for is that the two groups are COLLAPSIBLE (the 07-31 grouping wasn't), mirroring
// CareShell's "C.A.R.E Tools" expander (A28 — align to the existing affordance, don't invent a new one).
// Item gating is unchanged: Coach Assessment + Team stay managerOnly (server-gated), so a rep never sees them;
// a group filtered down to zero visible items for a rep is dropped whole (filterManagerNavSections) so no bare
// header shows (AMD-006 L3). The mockup's "1. / 2. / 3." denote ORDER, not literal numbering — items are not
// number-prefixed (consistent with the rest of the product's nav). "One Liners" is the universal label; route
// path kept as /strategy so existing links don't break.
// Meeting Coach (Team-Sync) go-live gate (founder 2026-08-23). NEXT_PUBLIC_* is inlined at build time, so the nav
// entry only appears once the founder sets NEXT_PUBLIC_MEETING_COACH_ENABLED=true (AFTER applying migrations 0237 +
// 0238) and redeploys — the feature never advertises before its DB is in place (§1.5.3). See docs/MEETING-COACH-GO-LIVE.md.
const MEETING_COACH_ENABLED = process.env.NEXT_PUBLIC_MEETING_COACH_ENABLED === "true";

const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { label: "Home", href: "/dashboard/sales-coach", icon: Home },
      ...(MEETING_COACH_ENABLED
        ? [{ label: "Meeting Coach", href: "/dashboard/meeting-coach", icon: Presentation }]
        : []),
    ],
  },
  {
    header: "Manager Dashboard",
    collapsible: true,
    items: [
      { label: "Coach Assessment", href: "/dashboard/sales-coach/coach-assessment", icon: ClipboardCheck, managerOnly: true },
      // Analytics is merged INTO the Coach Assessment card for managers (founder 2026-08-28) — so it's rep-only here;
      // reps keep their own Analytics self-view, managers find each rep's skill scores on the assessment card.
      { label: "Analytics", href: "/dashboard/sales-coach/analytics", icon: BarChart3, repOnly: true },
      { label: "Sessions", href: "/dashboard/sales-coach/sessions", icon: Mic },
    ],
  },
  {
    header: "Team Tools",
    collapsible: true,
    items: [
      { label: "Roleplay", href: "/dashboard/sales-coach/roleplay", icon: Target },
      { label: ONE_LINERS_LABEL, href: "/dashboard/sales-coach/strategy", icon: Library },
      // Training (founder 2026-08-26): a manager sees the team brief + every rep's focuses; a rep sees their OWN
      // trainings on their portal. NOT managerOnly — the page role-branches (manager team-read → 403 falls back to
      // the rep's own /my-training), so both roles get a working destination (AMD-006 L3).
      { label: "Training", href: "/dashboard/sales-coach/training", icon: GraduationCap },
      { label: "Team", href: "/dashboard/sales-coach/team", icon: Users, managerOnly: true },
    ],
  },
  {
    items: [
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

// Macro Mode focus (founder 2026-08-18): the desktop mirror of the mobile home hiding two cards. When a rep is
// in Macro Mode, these two non-door-to-door sidebar entries hide — "Live AI Coach & Sessions" (/sessions) and
// "One Liners" (/strategy). Exactly those two, only in Macro Mode.
const MACRO_HIDDEN_HREFS = new Set([
  "/dashboard/sales-coach/sessions",
  "/dashboard/sales-coach/strategy",
]);

/** Active-state for a nav item: exact match, or a child route under it (except Home, which would match
 *  everything). External items never show active (they open a new tab). Shared by the sidebar sections. */
function isNavItemActive(item: NavItem, pathname: string): boolean {
  return (
    !item.external &&
    (pathname === item.href ||
      (item.href !== "/dashboard/sales-coach" && pathname.startsWith(item.href + "/")))
  );
}

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

// Macro Mode bottom nav — a door-to-door rep gets a focused 4-tab bar. Founder revision 2026-08-23 (annotated
// mockup): promote the two door-to-door DATA surfaces into the nav for one-tap access — Pitch Performance
// (report card) + Today's Metrics — replacing the old Team Chat + AI Agent tabs; Role Play moves to the last
// slot. The two promoted surfaces are correspondingly REMOVED from the Macro home grid (true move, not a
// duplicate) — see the macroOn branch in dashboard/sales-coach/page.tsx. Team Chat stays reachable on desktop +
// the non-macro mobile nav; the Live AI Coach lives on the Sessions page (Home → cards) rather than a tab.
const MACRO_MOBILE_TABS: NavItem[] = [
  { label: "Home", href: "/dashboard/sales-coach", icon: Home },
  { label: "Pitch Performance", href: "/dashboard/sales-coach/doors/report-card", icon: Mic },
  { label: "Today's Metrics", href: "/dashboard/sales-coach/doors/todays-metrics", icon: BarChart3 },
  { label: "Role Play", href: "/dashboard/sales-coach/roleplay", icon: Target },
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
  const managerSections = filterManagerNavSections(NAV_SECTIONS, isSalesCoachManager);
  // Macro Mode: hide the two focus-out entries, kept live via a custom event the dashboard toggle fires, so the
  // sidebar reacts the instant Macro Mode flips (no reload). Initial value comes from the macro-mode route.
  const [macroOn, setMacroOn] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch("/api/coach/sales-session/macro-mode")
      .then((r) => (r.ok ? r.json() : { enabled: false }))
      .then((d) => alive && setMacroOn(Boolean(d.enabled)))
      .catch(() => {});
    const onChange = (e: Event) => setMacroOn(Boolean((e as CustomEvent<boolean>).detail));
    window.addEventListener("elostate:macro-mode", onChange);
    return () => {
      alive = false;
      window.removeEventListener("elostate:macro-mode", onChange);
    };
  }, []);
  const visibleSections = macroOn
    ? managerSections
        // Hide the two focus-out entries — but NOT one the rep is currently ON: hiding the user's own location
        // would violate the same AMD-006 L3 rule the collapsible groups honor below.
        .map((s) => ({
          ...s,
          items: s.items.filter((i) => !MACRO_HIDDEN_HREFS.has(i.href) || isNavItemActive(i, pathname)),
        }))
        .filter((s) => s.items.length > 0)
    : managerSections;

  // Collapsible-group open state, keyed by section header. Default COLLAPSED (founder follow-up 2026-08-12:
  // "make it collapse by default") — EXCEPT the group containing the current route, which starts OPEN so a
  // collapse never hides the user's OWN location (AMD-006 L3). This mirrors CareShell's `useState(toolsActive)`
  // exactly. The chevron lets a user open either group; the effect below re-opens the active group on later
  // navigation INTO it. Not persisted — a fresh load restores the collapsed-except-active default.
  // SalesCoachShell is a persistent App-Router LAYOUT, so the initializer fires once (with the initial route);
  // the effect handles subsequent navigation (Cmd+K, an in-page link, browser back).
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const s of NAV_SECTIONS)
      if (s.collapsible && s.header)
        init[s.header] = s.items.some((i) => isNavItemActive(i, pathname));
    return init;
  });
  const activeGroupHeader = visibleSections.find(
    (s) => s.collapsible && s.header && s.items.some((i) => isNavItemActive(i, pathname))
  )?.header;
  useEffect(() => {
    if (activeGroupHeader)
      setOpenGroups((m) => (m[activeGroupHeader] ? m : { ...m, [activeGroupHeader]: true }));
  }, [activeGroupHeader]);
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

          {/* Nav — grouped into sections (founder mockup 2026-08-12). An ungrouped section (Home; the
              Team Chat/KPI/extension/Settings run) renders its items flat. A `collapsible` section (Manager
              Dashboard, Team Tools) renders its header as a toggle button with a chevron, and shows its items —
              indented under a left rule — only when open. Mirrors CareShell's "C.A.R.E Tools" expander (A28). */}
          <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
            {visibleSections.map((section, si) => {
              const renderedItems = section.items.map((item) => {
                const Icon = item.icon;
                const active = isNavItemActive(item, pathname);
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
              });

              // Collapsible group — header toggle + chevron; items shown only when open. The header reads as
              // active (brighter) when the current route is inside the group, so a collapsed group still signals
              // "you are in here" (AMD-006 L3).
              if (section.collapsible && section.header) {
                const header = section.header;
                const open = openGroups[header] ?? false;
                const groupActive = section.items.some((i) =>
                  isNavItemActive(i, pathname)
                );
                return (
                  <div key={header} className="space-y-0.5">
                    <button
                      type="button"
                      onClick={() =>
                        setOpenGroups((m) => ({ ...m, [header]: !(m[header] ?? false) }))
                      }
                      aria-expanded={open}
                      // Founder revision 2026-08-12: these headers gate whole tool GROUPS, so make them clearly
                      // more apparent than a normal nav item — bumped from a tiny 10px label to text-sm bold
                      // uppercase, brighter, with a bit more vertical presence. Still uppercase + tracked so they
                      // read as section headers, not clickable items.
                      className={`w-full flex items-center gap-2 px-3 pt-3 pb-1.5 rounded-md text-sm font-bold uppercase tracking-wide transition-colors ${
                        groupActive
                          ? "text-white"
                          : "text-white/80 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      <span className="flex-1 text-left">{header}</span>
                      {open ? (
                        <ChevronDown className="w-4 h-4 shrink-0" aria-hidden />
                      ) : (
                        <ChevronRight className="w-4 h-4 shrink-0" aria-hidden />
                      )}
                    </button>
                    {open && (
                      <div className="ml-2 mt-0.5 mb-1 space-y-0.5 border-l border-white/10 pl-2">
                        {renderedItems}
                      </div>
                    )}
                  </div>
                );
              }

              // Ungrouped section — flat list (Home; the bottom Team Chat/KPI/extension/Settings run).
              return (
                <div key={section.header ?? `group-${si}`} className="space-y-0.5">
                  {section.header && (
                    <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-white/50">
                      {section.header}
                    </p>
                  )}
                  {renderedItems}
                </div>
              );
            })}
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
        {(macroOn ? MACRO_MOBILE_TABS : MOBILE_TABS).map((tab) => {
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
