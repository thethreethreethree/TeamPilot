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
  ChevronLeft,
  Heart,
  Hourglass,
  Building2,
  X,
} from "lucide-react";
import { resolveCyclePhase } from "@/lib/cycle/phase";
import { LearningHint } from "@/components/learning/LearningHint";
import { cn } from "@/lib/utils";
import { createClient, supabaseEnabled } from "@/lib/supabase/client";
import { CONSTITUTION } from "@/lib/constitution";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { useUnreadNotifications } from "@/lib/notifications/useUnread";
import { LightbulbMark } from "@/components/brand/Logo";
import { FeedbackPanel } from "@/components/feedback/FeedbackPanel";

type NavHint = {
  whatItIs: string;
  why: string;
  how: string;
  principle?: string;
};

const productionNav: Array<{
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  hint: NavHint;
}> = [
  {
    label: "Command Center",
    href: "/dashboard",
    icon: LayoutDashboard,
    hint: {
      whatItIs:
        "The operational hub. The §3.1 chain at a glance: open tasks, signals, problems, resolutions, held rate. Plus C.A.R.E support state when the tenant has support activity. Today's open questions on demand. Where-to-focus suggestion based on actual chain state.",
      why: "Every other team-software product surfaces 'activity' on the home page. ELOSTATE surfaces CONSEQUENCE — held rate, surfaced problems, durability due. The hub answers 'what's worth attending to today' instead of 'what happened recently'.",
      how: "Land here when starting a session or returning from a context shift. Read the stats top-down, then check the where-to-focus suggestion if you're unsure where to go next. Click any stat card to drill into its module.",
      principle:
        "The hub measures consequence. Activity belongs in the modules; the hub asks whether the team is producing durable outcomes.",
    },
  },
  {
    label: "Team Chat",
    href: "/dashboard/chats",
    icon: MessageSquare,
    hint: {
      whatItIs:
        "Topic-threaded team conversations with participants, @mentions, reactions, and Coach v5 communication coaching on every draft. Each topic is a self-contained reasoning space. Decision Dialogues can open inline inside any topic.",
      why: "Slack is for talking; this is for deciding what matters. Every message becomes part of the §3.1 chain — mentions become events, conversations get linked to tasks and decisions, and the Coach surfaces sharper drafts before the team commits a phrasing it'll regret.",
      how: "Open or create a topic for any work that involves the team. The composer coaches you while you type. @mentions notify; everything threads. When a topic surfaces an actual decision, open the Decision Dialogue inside the thread rather than fragmenting the reasoning across tools.",
      principle:
        "Conversation is the substrate. The discipline is in capturing the reasoning, not in moving faster.",
    },
  },
  {
    label: "Tasks",
    href: "/dashboard/operations",
    icon: ListChecks,
    hint: {
      whatItIs:
        "The Operations board: every task with status, priority, assignee, due date, blocker reason. Status transitions are validated server-side; tasks can't skip states. Blocker reason is required when status='Blocked' — the System refuses to leave a task blocked with no stated reason.",
      why: "Most task systems optimize for 'how many tickets did we close.' This one asks 'did the work resolve the underlying problem?' A closed ticket whose underlying problem reopens within 7 days is failure, not success — and the §3.5 durability tracking on Resolutions enforces that.",
      how: "Use the board for the work-in-flight view. Use task detail when you need to see the reasoning chain that spawned the task. Blockers without stated reasons are a smell — fix the data, not just the work.",
      principle:
        "Tickets are units of work; reasoning is the unit of capability. A team that closes 100 tickets without recording reasoning is busier, not better.",
    },
  },
  {
    label: "Team",
    href: "/dashboard/team",
    icon: Users,
    hint: {
      whatItIs:
        "The roster: every team member with role (CEO / COO / admin / member / support agent), invitations, and revocations. New invites are sent via the Invite flow with role assignment at invite time.",
      why: "Roles aren't decoration here — they shape what each user sees and can do across the System. Admin role gates leadership readouts. Support agent role gates the C.A.R.E inbox. Getting the role right at invite time prevents downstream confusion.",
      how: "Add a teammate via Invite — pick role, send. They get an invitation email; clicking it brings them through profile setup. Revoke when someone leaves. Update roles via the row controls when responsibilities change.",
      principle:
        "Role is permissioning that's also pedagogy. A user's role signals what part of the System they're responsible for.",
    },
  },
  {
    label: "Living Diagnosis",
    href: "/dashboard/diagnose",
    icon: GitMerge,
    hint: {
      whatItIs:
        "The full §3.1 chain in motion: events → signals → problems → resolutions → new events. The page shows the signal stream (what the System has noticed) with the data sources and observation timestamps. It's the chain made visible.",
      why: "Most products hide the work the System is doing behind a 'magic AI' framing. ELOSTATE refuses that — the chain IS the product. Showing it explicitly means the team can audit what signals exist, where they came from, and whether the System is picking up real patterns or noise.",
      how: "Browse signals when you're investigating a specific suspicion ('did the System pick up the meeting overrun last Tuesday?'). The signal kinds tell you which event sources are emitting. A signal stream that's mostly one kind is a tenant that's only exercising one part of the System.",
      principle:
        "Diagnosis works backward from the record. The chain page is the record made navigable.",
    },
  },
  {
    label: "Problems",
    href: "/dashboard/problems",
    icon: ShieldCheck,
    hint: {
      whatItIs:
        "The problem board: every named problem the team is aware of, split by status (draft / surfaced / dismissed / resolved). Draft problems are still being earned; surfaced problems have crossed the §3.2 evidence threshold and are ready for action.",
      why: "The Understanding Gate (§3.2) is the System's structural refusal to promote a half-understood problem. The board makes the gate visible — you see what the team is articulating, what's earned the right to be acted on, and what got dismissed (with the reason captured).",
      how: "Draft a problem by writing what you're observing + linking the supporting signals. The gate tells you what's still missing before it can surface. Don't fight the gate — gather more signal or sharpen the diagnosis.",
      principle:
        "A problem promoted before it has earned the right to be named is the most expensive kind of work. The gate is the discipline encoded.",
    },
  },
  {
    label: "Resolutions",
    href: "/dashboard/resolutions",
    icon: Sparkles,
    hint: {
      whatItIs:
        "The resolution corpus: every closed problem with action taken, reasoning (≥40 chars required), expected outcome, observed outcome, and durability state (held / reopened / partial / inconclusive). The team's playbook, derived from what actually worked.",
      why: "Closing a ticket without recording the reasoning is the failure mode every productivity tool ships. The resolution corpus is the institutional memory the team usually loses to turnover. Browse it when the same kind of problem comes back; the prior reasoning is right there.",
      how: "Walk through unreviewed resolutions whose durability check is overdue — the §3.5 measurement is the single most important metric the System tracks. Browse by category to see patterns. Export when assembling a postmortem or a strategy doc.",
      principle:
        "Tickets close; reasoning compounds. A team that records the WHY behind every resolution gets better at the work over time. A team that doesn't, rediscovers the same fixes.",
    },
  },
  {
    label: "Company Brain",
    href: "/dashboard/brain",
    icon: Brain,
    hint: {
      whatItIs:
        "The per-tenant learning composition layer. The Brain reads your team's accumulated patterns, durable resolutions, and characteristic failure modes — and composes them into the system prompt of every AI call. After the §3.4 control window, every AI output is shaped by THIS team's record, not a generic template.",
      why: "Generic AI tools give every customer the same answer. The Brain is what makes ELOSTATE's AI specific to your team. The control window (month-1 silent baseline) exists so the Brain has real data to compose from before it starts speaking. Without the wait, the Brain would be guessing.",
      how: "Read the learning summary periodically to see what patterns the System has noticed about your team. Unlock the control window manually only if you have a real reason (and the override gets recorded with your reason; future review can assess whether the early unlock helped).",
      principle:
        "An AI shaped by your team's actual record is fundamentally different from an AI prompted with your industry. The wait is the feature.",
    },
  },
  {
    label: "Decision Dialogue",
    href: "/dashboard/decisions",
    icon: Brain,
    hint: {
      whatItIs:
        "Structured four-phase reasoning for decisions that deserve more than a Slack reply: Situation → Your Read → System Response → Decide (adopt yours / adopt System's / hybrid / defer). The System never asserts before you've spoken.",
      why: "Most decisions in teams get reasoning attached AFTER the fact, in the form of post-hoc narrative. Decision Dialogue forces the reasoning to be captured BEFORE resolution — and lets the System weigh in with explicit WHY only after you've stated yours. The reasoning is the transferable asset; the dialogue captures it.",
      how: "Open a Dialogue when a decision is worth more than 5 minutes of thought. Walk through the phases honestly — write your actual diagnosis, your actual proposal. Engage the System's response; don't just accept it. Decide. The record survives the meeting.",
      principle:
        "The System asks first, suggests second, never asserts. The reasoning is transferred to the human, not retained by the machine.",
    },
  },
  {
    label: "My growth",
    href: "/dashboard/my-growth",
    icon: Heart,
    hint: {
      whatItIs:
        "Your personal development surface — 30-day rolling read of your resolutions (with durability outcomes), Co-Pilot edit magnitudes (in C.A.R.E), Coach grades over time. Personal, not surveillance: each member sees their own; admin readouts aggregate at team level without per-agent identification per §A18.",
      why: "Most team-tools optimize for leadership readouts and treat individual development as an afterthought. My growth flips that — the individual's view of their own pattern is the highest-leverage learning surface in the System. The admin equivalent stays separate so this surface stays trustworthy.",
      how: "Visit weekly. Look at durability outcomes on your own resolutions — what held, what reopened. Read Coach feedback patterns on your own messages. The goal isn't to improve the numbers; the goal is to notice the pattern of what kinds of reasoning you produce vs what kinds hold.",
      principle:
        "Your own pattern is the most useful teaching artifact you have access to. The System surfaces it so you don't have to wait for an annual review to see it.",
    },
  },
  {
    label: "C.A.R.E",
    href: "/dashboard/care",
    icon: MessageSquarePlus,
    hint: {
      whatItIs:
        "Customer Assistance and Response Engine. A complete support module: multi-channel inbox (widget / email / voice), Read Phase before reply, AI Co-Pilot drafting with surfaced precedents, Coach pre-send analysis, Resolution capture, §3.5 durability tracking, Knowledge base, Leadership readouts.",
      why: "Standard support tools optimize for 'how fast did we close the ticket.' C.A.R.E asks 'did we resolve what the customer was actually trying to solve, and did it hold?' Same constitutional discipline as the rest of the System, applied to customer-facing reasoning.",
      how: "Open conversations from the inbox. The Read Phase shows context first; reply, then capture resolution when done. The 7-day durability check shows up automatically. Browse Knowledge for institutional memory; Patterns for what's recurring; Leadership readouts for team-level health.",
      principle:
        "Support is the same discipline applied to customer-facing reasoning. The fact that the customer is external doesn't change the rule.",
    },
  },
];

const testingNav = [
  { label: "Smoke test", href: "/dashboard/smoke-test", icon: ClipboardList },
  { label: "My feedback", href: "/dashboard/feedback", icon: MessageSquare },
  { label: "Notifications", href: "/dashboard/notifications", icon: Bell },
];

const adminNav = [
  {
    label: "Customer accounts",
    href: "/dashboard/admin/crm",
    icon: Building2,
  },
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
  // Desktop collapse state (rail mode). Persisted in localStorage
  // so the workspace shape sticks across sessions. Writes a body
  // data-attribute so the dashboard layout's <main> can react via
  // a global CSS rule (see globals.css — the layout is server-
  // rendered, the sidebar is client; data-attribute is the
  // cheapest cross-cut).
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("elostate-sidebar-collapsed");
      if (raw === "1") setDesktopCollapsed(true);
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    try {
      window.localStorage.setItem(
        "elostate-sidebar-collapsed",
        desktopCollapsed ? "1" : "0"
      );
      if (typeof document !== "undefined") {
        if (desktopCollapsed) {
          document.body.dataset.sidebarCollapsed = "true";
        } else {
          delete document.body.dataset.sidebarCollapsed;
        }
      }
    } catch {
      /* ignore */
    }
  }, [desktopCollapsed]);
  // Feedback panel state — the "Send feedback" entry in the Testing
  // section opens this. Replaces the floating bottom-right button
  // on dashboard routes per user request.
  const [feedbackOpen, setFeedbackOpen] = useState(false);
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
    {/* When collapsed on desktop: render the 48px rail with a
        single expand button. Mobile drawer still uses the full
        sidebar — collapse is desktop-only because mobile UX is
        already drawer-based. */}
    {desktopCollapsed && (
      <button
        type="button"
        onClick={() => setDesktopCollapsed(false)}
        aria-label="Expand sidebar"
        title="Expand sidebar"
        className="hidden md:flex fixed left-0 top-0 h-screen w-12 bg-surface border-r border-default z-40 items-center justify-center text-muted hover:text-primary hover:bg-white/[0.03]"
      >
        <ChevronRight className="w-4 h-4" aria-hidden />
      </button>
    )}
    <aside
      className={cn(
        // h-dvh follows the visible viewport on mobile (shrinks when
        // keyboard opens), avoiding the bottom of the sidebar
        // disappearing behind the keyboard.
        "fixed left-0 top-0 h-dvh w-64 bg-surface border-r border-default flex flex-col z-40 transition-transform duration-200",
        "md:translate-x-0",
        mobileOpen ? "translate-x-0" : "-translate-x-full",
        // Hide the full sidebar on desktop when collapsed — the
        // 48px rail above takes over. Mobile drawer behavior is
        // unchanged (it ignores desktopCollapsed entirely).
        desktopCollapsed && "md:-translate-x-full"
      )}
      aria-label="Primary navigation"
    >
      {/* Logo — canonical bulb (amber, transparent) + ELOSTATE wordmark
          (Inter-Black for theme adaptability) + tagline + live/demo dot.
          The bulb image's native aspect is 255×354 (taller than wide),
          so width/height match the actual asset proportions to avoid
          stretching. */}
      <div className="px-6 py-6 border-b border-default relative">
        {/* Desktop-only collapse trigger. Mobile keeps the drawer
            pattern (the X button at top-right of the drawer
            already exists for that). */}
        <button
          type="button"
          onClick={() => setDesktopCollapsed(true)}
          aria-label="Collapse sidebar"
          title="Collapse sidebar"
          // p-2 + 3.5x3.5 icon = ~28px tap target on the desktop
          // collapse trigger. On iPad landscape (which falls into the
          // md breakpoint) this matters.
          className="hidden md:flex absolute top-2 right-2 text-muted hover:text-primary p-2 rounded hover:bg-white/[0.04] items-center justify-center"
        >
          <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
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
            <LearningHint
              key={item.href}
              as="block"
              category="Module"
              title={item.label}
              whatItIs={item.hint.whatItIs}
              why={item.hint.why}
              how={item.hint.how}
              principle={item.hint.principle}
            >
              <Link
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                  isActive
                    ? "bg-ember-400/15 text-brand border border-ember-400/30"
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
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-ember-400" />
                )}
              </Link>
            </LearningHint>
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
                    ? "bg-ember-400/15 text-brand border border-ember-400/30"
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
                      className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-ember-400 ring-2 ring-base"
                      aria-label="Unread notifications"
                    />
                  )}
                </span>
                {item.label}
              </Link>
            );
          })}
          {/* "Send feedback" — replaces the floating bottom-right
              FeedbackButton on dashboard routes. Opens the same
              FeedbackPanel slide-out, sits with the rest of the
              Testing entries so it's no longer floating over page
              content. Public pages (landing / login) still see the
              floating button since they have no sidebar. */}
          <button
            type="button"
            onClick={() => setFeedbackOpen(true)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
              "text-secondary hover:text-primary hover:bg-surface-raised"
            )}
          >
            <MessageSquarePlus
              className="w-4 h-4 flex-shrink-0 text-muted"
              aria-hidden
            />
            Send feedback
          </button>
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
                      ? "bg-ember-400/15 text-brand border border-ember-400/30"
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
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-ember-400 to-[#FDE047] flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-primary truncate">
              {userName || "Loading…"}
            </p>
            <p className="text-xs text-muted truncate">{userRole || "Executive Access"}</p>
          </div>
          <button
            type="button"
            onClick={signOut}
            title="Sign out"
            aria-label="Sign out"
            className="p-1.5 rounded-lg text-muted hover:text-red-400 hover:bg-surface-raised transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60"
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
    {feedbackOpen && <FeedbackPanel onClose={() => setFeedbackOpen(false)} />}
    </>
  );
}
