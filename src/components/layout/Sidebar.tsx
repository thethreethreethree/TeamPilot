"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  ListChecks,
  Users,
  DollarSign,
  Megaphone,
  MessageSquare,
  MessageSquarePlus,
  BookOpen,
  ClipboardList,
  Brain,
  Settings,
  ChevronRight,
  LogOut,
  GitMerge,
  ShieldCheck,
  Sparkles,
  Beaker,
  Bell,
  Heart,
  Hourglass,
  X,
} from "lucide-react";
import { resolveCyclePhase } from "@/lib/cycle/phase";
import { cn } from "@/lib/utils";
import { createClient, supabaseEnabled } from "@/lib/supabase/client";
import { CONSTITUTION } from "@/lib/constitution";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { useUnreadNotifications } from "@/lib/notifications/useUnread";
import { LightbulbMark } from "@/components/brand/Logo";

const productionNav = [
  { label: "Command Center", href: "/dashboard", icon: LayoutDashboard },
  { label: "Team Chat", href: "/dashboard/chats", icon: MessageSquare },
  { label: "Tasks", href: "/dashboard/operations", icon: ListChecks },
  { label: "Team", href: "/dashboard/team", icon: Users },
  { label: "Living Diagnosis", href: "/dashboard/diagnose", icon: GitMerge },
  { label: "Problems", href: "/dashboard/problems", icon: ShieldCheck },
  { label: "Resolutions", href: "/dashboard/resolutions", icon: Sparkles },
  { label: "Company Brain", href: "/dashboard/brain", icon: Brain },
  { label: "Decision Dialogue", href: "/dashboard/decisions", icon: Brain },
];

const testingNav = [
  { label: "Smoke test", href: "/dashboard/smoke-test", icon: ClipboardList },
  { label: "My feedback", href: "/dashboard/feedback", icon: MessageSquare },
  { label: "Notifications", href: "/dashboard/notifications", icon: Bell },
];

const adminNav = [
  {
    label: "Feedback inbox",
    href: "/dashboard/admin/feedback",
    icon: MessageSquarePlus,
  },
  {
    label: "Coach readout",
    href: "/dashboard/admin/coach-readout",
    icon: BookOpen,
  },
  {
    label: "Team check",
    href: "/dashboard/admin/team-check",
    icon: Heart,
  },
];

const designPreviewNav = [
  { label: "Finance", href: "/dashboard/finance", icon: DollarSign },
  { label: "Marketing", href: "/dashboard/marketing", icon: Megaphone },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [companyName, setCompanyName] = useState("—");
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");
  // §3.4 cycle phase for the sidebar badge — so the founder /
  // admin always sees where they are in the 60-day proof window
  // without navigating to settings.
  const [cyclePhase, setCyclePhase] = useState<{
    phase: "control" | "intervention" | "ongoing";
    daysIntoCycle: number;
    daysRemainingInPhase: number;
    skippedControl: boolean;
  } | null>(null);
  const unread = useUnreadNotifications();
  // Mobile drawer state — controlled via a custom event the TopBar
  // hamburger dispatches. Closes when the user navigates (effect on
  // pathname) and on backdrop tap.
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    const onToggle = () => setMobileOpen((v) => !v);
    const onClose = () => setMobileOpen(false);
    window.addEventListener("elostate:toggle-sidebar", onToggle);
    window.addEventListener("elostate:close-sidebar", onClose);
    return () => {
      window.removeEventListener("elostate:toggle-sidebar", onToggle);
      window.removeEventListener("elostate:close-sidebar", onClose);
    };
  }, []);
  useEffect(() => {
    setMobileOpen(false); // close drawer on route change
  }, [pathname]);

  useEffect(() => {
    if (!supabaseEnabled) {
      setCompanyName("Demo Co");
      setUserName("Demo User");
      setUserRole("Demo Mode");
      return;
    }
    const supabase = createClient();
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select(
          "full_name, role, companies(name, cycle_started_at, cycle_control_skipped_at)"
        )
        .eq("id", auth.user.id)
        .maybeSingle();
      if (profile) {
        setUserName(profile.full_name ?? auth.user.email ?? "");
        setUserRole(profile.role ?? "");
        const company = profile.companies as {
          name?: string;
          cycle_started_at?: string;
          cycle_control_skipped_at?: string | null;
        } | null;
        if (company?.name) setCompanyName(company.name);
        if (company?.cycle_started_at) {
          const details = resolveCyclePhase({
            cycleStartedAt: company.cycle_started_at,
            cycleControlSkippedAt: company.cycle_control_skipped_at ?? null,
          });
          setCyclePhase({
            phase: details.phase,
            daysIntoCycle: details.daysIntoCycle,
            daysRemainingInPhase: details.daysRemainingInPhase,
            skippedControl: details.skippedControl,
          });
        }
      }
    })();
  }, []);

  const initials = (userName || "EX")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const signOut = async () => {
    if (supabaseEnabled) await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <>
    {/* Mobile backdrop — appears below the drawer, taps to close. */}
    {mobileOpen && (
      <div
        className="md:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-30"
        onClick={() => setMobileOpen(false)}
        aria-hidden
      />
    )}
    <aside
      className={cn(
        "fixed left-0 top-0 h-screen w-64 bg-surface border-r border-default flex flex-col z-40 transition-transform duration-200",
        "md:translate-x-0",
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      )}
      aria-label="Primary navigation"
    >
      {/* Logo — canonical bulb (amber, transparent) + ELOSTATE wordmark
          (Inter-Black for theme adaptability) + tagline + live/demo dot.
          The bulb image's native aspect is 255×354 (taller than wide),
          so width/height match the actual asset proportions to avoid
          stretching. */}
      <div className="px-6 py-6 border-b border-default">
        <Link
          href="/"
          aria-label="ELOSTATE — landing page"
          className="flex items-center gap-3 group"
        >
          <LightbulbMark
            width={28}
            height={39}
            className="flex-shrink-0 transition-transform group-hover:scale-105"
          />
          <div className="min-w-0">
            <span className="block text-base font-black text-primary tracking-tight leading-none">
              ELOSTATE
            </span>
            <div className="flex items-center gap-1.5 mt-1.5">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  supabaseEnabled ? "bg-ember-300 pulse-dot" : "bg-ember-500"
                }`}
              />
              <span className="text-[10px] text-muted uppercase tracking-widest">
                {supabaseEnabled ? "Live" : "Demo"}
              </span>
            </div>
          </div>
        </Link>
      </div>

      {/* Company pill — single-tap to company settings.
          (Multi-company switching isn't built; until it is, surfacing
          an affordance that opens a "switcher" the user can't use would
          be the UI overtaking the truth of what the System can do.) */}
      <div className="px-4 py-3 border-b border-default">
        <Link
          href="/dashboard/settings"
          aria-label="Edit company profile"
          title="Edit company profile"
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-surface-raised transition-colors group"
        >
          <div className="text-left min-w-0 flex-1">
            <p className="text-xs text-muted uppercase tracking-widest mb-0.5">Company</p>
            <p className="text-sm font-medium text-primary truncate">{companyName}</p>
            {/* §3.4 cycle phase badge — always-visible orientation
                for the admin so they know where in the 60-day proof
                window their company is. Uses the same tone vocabulary
                as the Settings panel: arc-cyan during control,
                emerald after. Skipped-control stays flagged forever
                per the §3.1 append-only contract. */}
            {cyclePhase && (
              <p
                title={
                  cyclePhase.phase === "control"
                    ? `Month 1 control · Coach unlocks in ${cyclePhase.daysRemainingInPhase} day${cyclePhase.daysRemainingInPhase === 1 ? "" : "s"}`
                    : cyclePhase.phase === "intervention"
                      ? `Month 2 single-variable intervention · ${cyclePhase.daysRemainingInPhase} days until proof checkpoint`
                      : "Past the §3.4 proof checkpoint — compounding window"
                }
                className={`inline-flex items-center gap-1 text-[10px] font-mono mt-0.5 ${
                  cyclePhase.phase === "control"
                    ? "text-arc-300"
                    : "text-emerald-300"
                }`}
              >
                <Hourglass className="w-2.5 h-2.5" aria-hidden />
                {cyclePhase.phase === "control" && `M1 · Day ${cyclePhase.daysIntoCycle}`}
                {cyclePhase.phase === "intervention" && `M2 · Day ${cyclePhase.daysIntoCycle}`}
                {cyclePhase.phase === "ongoing" && `Day ${cyclePhase.daysIntoCycle} · compounding`}
                {cyclePhase.skippedControl && (
                  <span className="text-accent-text">· skipped</span>
                )}
              </p>
            )}
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-muted group-hover:text-secondary transition-colors" />
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="px-3 mb-2 text-[10px] text-muted uppercase tracking-widest">
          Production
        </p>
        {productionNav.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                isActive
                  ? "bg-[#FACC15]/15 text-brand border border-[#FACC15]/30"
                  : "text-secondary hover:text-primary hover:bg-surface-raised"
              )}
            >
              <Icon
                className={cn(
                  "w-4 h-4 flex-shrink-0",
                  isActive ? "text-brand" : "text-muted"
                )}
              />
              {item.label}
              {isActive && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#FACC15]" />
              )}
            </Link>
          );
        })}

        {/* Testing — visible to all signed-in users. Admins also see
            the Feedback inbox below. */}
        <div className="pt-4">
          <p className="px-3 mb-2 text-[10px] text-muted uppercase tracking-widest">
            Testing
          </p>
          {testingNav.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            const showUnreadDot =
              item.href === "/dashboard/notifications" && unread;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                  isActive
                    ? "bg-[#FACC15]/15 text-brand border border-[#FACC15]/30"
                    : "text-secondary hover:text-primary hover:bg-surface-raised"
                )}
              >
                <span className="relative flex-shrink-0">
                  <Icon
                    className={cn(
                      "w-4 h-4",
                      isActive ? "text-brand" : "text-muted"
                    )}
                  />
                  {showUnreadDot && (
                    <span
                      className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#FACC15] ring-2 ring-base"
                      aria-label="Unread notifications"
                    />
                  )}
                </span>
                {item.label}
              </Link>
            );
          })}
          {(userRole === "admin" || userRole === "CEO" || userRole === "COO") &&
            adminNav.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                    isActive
                      ? "bg-[#FACC15]/15 text-brand border border-[#FACC15]/30"
                      : "text-secondary hover:text-primary hover:bg-surface-raised"
                  )}
                >
                  <Icon
                    className={cn(
                      "w-4 h-4 flex-shrink-0",
                      isActive ? "text-brand" : "text-muted"
                    )}
                  />
                  {item.label}
                </Link>
              );
            })}
        </div>

        <div className="pt-4">
          <p className="px-3 mb-2 text-[10px] text-muted uppercase tracking-widest flex items-center gap-1.5">
            <Beaker className="w-3 h-3 text-violet-400" />
            Design preview
          </p>
          {designPreviewNav.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                  isActive
                    ? "bg-violet-500/10 text-violet-300 border border-violet-500/30"
                    : "text-muted hover:text-secondary hover:bg-surface-raised"
                )}
              >
                <Icon className="w-4 h-4 text-muted" />
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="pt-4">
          <p className="px-3 mb-2 text-[10px] text-muted uppercase tracking-widest">
            System
          </p>
          <Link
            href="/dashboard/settings"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-secondary hover:text-primary hover:bg-surface-raised transition-all duration-150"
          >
            <Settings className="w-4 h-4 text-muted" />
            Settings
          </Link>
        </div>
      </nav>

      {/* Theme switcher — placed above the constitution badge so it's
          always reachable without scrolling. Compact variant keeps the
          sidebar density consistent. */}
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <span className="text-[10px] text-muted uppercase tracking-widest">
          Theme
        </span>
        <ThemeToggle />
      </div>

      {/* Constitution version badge */}
      <div className="px-4 pt-1 pb-1 border-t border-default">
        <Link
          href="/dashboard/settings"
          className="block pt-2 text-[10px] text-muted hover:text-muted transition-colors font-mono"
          title={`Last amendment: ${CONSTITUTION.lastAmendmentId} (${CONSTITUTION.lastAmendmentDate})`}
        >
          Constitution v{CONSTITUTION.version} · {CONSTITUTION.amendmentCount} amendments
        </Link>
      </div>

      {/* User footer */}
      <div className="px-4 py-4 border-t border-default">
        <div className="flex items-center gap-3 px-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#FACC15] to-[#FDE047] flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-primary truncate">
              {userName || "Loading…"}
            </p>
            <p className="text-xs text-muted truncate">{userRole || "Executive Access"}</p>
          </div>
          <button
            onClick={signOut}
            title="Sign out"
            aria-label="Sign out"
            className="p-1.5 rounded-lg text-muted hover:text-red-400 hover:bg-surface-raised transition-colors"
          >
            <LogOut aria-hidden="true" className="w-4 h-4" />
          </button>
        </div>
      </div>
      {/* Close button — only shown on mobile when the drawer is open. */}
      {mobileOpen && (
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
          className="md:hidden absolute top-3 right-3 p-2 rounded-lg text-muted hover:text-primary hover:bg-surface-raised"
        >
          <X className="w-4 h-4" aria-hidden />
        </button>
      )}
    </aside>
    </>
  );
}
