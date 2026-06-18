"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { FloatingMenu } from "@/components/ui/FloatingMenu";
import {
  BarChart3,
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Heart,
  Home,
  Inbox,
  LayoutGrid,
  LifeBuoy,
  MessageCircle,
  Settings,
  Sparkles,
  Tag,
  Users,
  Zap,
} from "lucide-react";

/**
 * CareShell — Zendesk Chat-shaped app shell for the Care product.
 *
 * Owns the dedicated left vertical sidebar for every page under
 * /dashboard/care. The main ELOSTATE sidebar collapses behind a
 * back-link in the Care header so Care feels like its own product
 * surface (which it is — competitors are full SaaS apps).
 *
 * Sidebar structure mirrors Zendesk Chat:
 *   - Online indicator at the top (agent status)
 *   - Primary sections: Home, Conversations, Visitors, Analytics,
 *     Monitor
 *   - Settings (expandable with sub-nav for Agents, Tags,
 *     Shortcuts, Routing, Operating hours, Widget, Account)
 *   - Back to ELOSTATE at the bottom
 *
 * Color: dark navy/teal panel against the rest of the dark theme
 * to give Care visual distinction without breaking the brand
 * (matches the user-supplied Zendesk reference).
 */

type NavItem = {
  label: string;
  href: string;
  icon: typeof Home;
};

const PRIMARY_NAV: NavItem[] = [
  { label: "Home", href: "/dashboard/care", icon: Home },
  { label: "Conversations", href: "/dashboard/care/conversations", icon: Inbox },
  { label: "Customers", href: "/dashboard/care/customers", icon: Users },
  // §3.2 Understanding Gate for support — recurring categories
  // surface as patterns once N>=3. The earliest warning system the
  // company has for product/process/messaging gaps.
  { label: "Patterns", href: "/dashboard/care/patterns", icon: Sparkles },
  { label: "Analytics", href: "/dashboard/care/analytics", icon: BarChart3 },
  { label: "Monitor", href: "/dashboard/care/monitor", icon: LayoutGrid },
  // §1.1 — past resolutions ARE the knowledge base. The
  // Co-Pilot uses this corpus to draft new replies; this nav
  // entry lets agents browse the team's playbook directly.
  { label: "Knowledge", href: "/dashboard/care/knowledge", icon: BookOpen },
  // §3.6 — agent sees their own growth. Per A10 nobody else sees
  // this individual data; the leader gets aggregate at the Team
  // entry below.
  { label: "My growth", href: "/dashboard/care/growth", icon: Heart },
  // §A6 + §A18 — team-aggregate view. Per A10 every field here
  // mirrors a field on the agent self-view; per A18 there is no
  // per-agent breakdown. Visible only to CEO / COO / admin
  // (gated server-side by /api/care/leadership/team).
  { label: "Team", href: "/dashboard/care/leadership", icon: Users },
];

const SETTINGS_NAV: NavItem[] = [
  { label: "Agents", href: "/dashboard/care/settings/agents", icon: Users },
  { label: "Tags", href: "/dashboard/care/settings/tags", icon: Tag },
  { label: "Shortcuts", href: "/dashboard/care/settings/shortcuts", icon: Zap },
  { label: "Widget", href: "/dashboard/care/settings/widget", icon: MessageCircle },
  { label: "Account", href: "/dashboard/care/settings/account", icon: Settings },
];

export function CareShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const [settingsOpen, setSettingsOpen] = useState(
    pathname.startsWith("/dashboard/care/settings")
  );
  // Collapse state for the C.A.R.E left nav. Per AMD-006 §1.5.1
  // layer 3 — agent can reclaim ~224px of horizontal real estate
  // for the inbox surface. Persisted in localStorage so the
  // workspace shape survives sessions.
  const [navCollapsed, setNavCollapsed] = useState(false);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("care-shell-collapsed");
      if (raw === "1") setNavCollapsed(true);
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    try {
      window.localStorage.setItem(
        "care-shell-collapsed",
        navCollapsed ? "1" : "0"
      );
    } catch {
      /* ignore */
    }
  }, [navCollapsed]);
  // Cross-tab sync — see the matching block in ConversationsApp
  // for the rationale. The C.A.R.E nav collapse is one boolean;
  // sync it directly to whatever another tab just wrote.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== "care-shell-collapsed" || e.newValue == null) return;
      setNavCollapsed(e.newValue === "1");
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return (
    <div className="flex h-screen w-full bg-base overflow-hidden">
      {/* Care left sidebar — dark navy, Zendesk-shaped */}
      {navCollapsed ? (
        <button
          type="button"
          onClick={() => setNavCollapsed(false)}
          aria-label="Expand C.A.R.E navigation"
          title="Expand navigation"
          className="w-6 flex-shrink-0 bg-[#0B1620] border-r border-white/[0.06] flex items-center justify-center text-white/40 hover:text-white/90 hover:bg-white/5 transition-colors"
        >
          <ChevronRight className="w-3.5 h-3.5" aria-hidden />
        </button>
      ) : (
      <aside className="w-56 flex-shrink-0 bg-[#0B1620] text-white/90 border-r border-white/[0.06] flex flex-col">
        {/* Header: brand + agent status */}
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-start gap-2 mb-3">
            <div className="w-7 h-7 rounded-md bg-ember-400 flex items-center justify-center shrink-0">
              <LifeBuoy className="w-4 h-4 text-[#09090B]" aria-hidden />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold tracking-tight leading-none">
                C.A.R.E
              </p>
              <p className="text-[9px] uppercase tracking-widest text-white/40 mt-0.5">
                Customer · Assist · Respond · Engine
              </p>
            </div>
            <button
              type="button"
              onClick={() => setNavCollapsed(true)}
              aria-label="Collapse C.A.R.E navigation"
              title="Collapse navigation"
              className="text-white/40 hover:text-white/90 p-1 -mt-0.5 -mr-1 rounded hover:bg-white/5 shrink-0"
            >
              <ChevronLeft className="w-3.5 h-3.5" aria-hidden />
            </button>
          </div>
          <PresenceControl />
        </div>

        {/* Primary navigation */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
          {PRIMARY_NAV.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} />
          ))}

          {/* Settings (expandable) */}
          <button
            type="button"
            onClick={() => setSettingsOpen((v) => !v)}
            aria-expanded={settingsOpen}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              pathname.startsWith("/dashboard/care/settings")
                ? "bg-white/10 text-white"
                : "text-white/70 hover:text-white hover:bg-white/5"
            }`}
          >
            <Settings className="w-4 h-4 shrink-0" aria-hidden />
            <span className="flex-1 text-left">Settings</span>
            {settingsOpen ? (
              <ChevronDown className="w-3.5 h-3.5 shrink-0" aria-hidden />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 shrink-0" aria-hidden />
            )}
          </button>
          {settingsOpen && (
            <div className="ml-2 mt-0.5 mb-1 space-y-0.5 border-l border-white/10 pl-2">
              {SETTINGS_NAV.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  pathname={pathname}
                  nested
                />
              ))}
            </div>
          )}
        </nav>

        {/* Footer: back to ELOSTATE */}
        <div className="px-2 pb-3 pt-2 border-t border-white/[0.06]">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-3 py-2 rounded-md text-[11px] text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors"
          >
            ← Back to ELOSTATE
          </Link>
        </div>
      </aside>
      )}

      {/* Main content area */}
      <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {children}
      </main>
    </div>
  );
}

function NavLink({
  item,
  pathname,
  nested,
}: {
  item: NavItem;
  pathname: string;
  nested?: boolean;
}) {
  const Icon = item.icon;
  // Active when pathname === href OR (for primary) pathname starts
  // with href but ISN'T a different section (e.g. /care/conversations
  // shouldn't activate /care).
  const active =
    pathname === item.href ||
    (item.href !== "/dashboard/care" && pathname.startsWith(item.href + "/"));
  return (
    <Link
      href={item.href}
      className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
        active
          ? "bg-white/10 text-white"
          : "text-white/70 hover:text-white hover:bg-white/5"
      } ${nested ? "text-[13px]" : ""}`}
    >
      <Icon className="w-4 h-4 shrink-0" aria-hidden />
      {item.label}
    </Link>
  );
}

/**
 * Agent presence control — Phase 5 commit 3.
 *
 * Replaces the static "Online" indicator that was previously
 * hardcoded in the sidebar header. Per §A6 Pillar 2 the agent
 * controls their own status; per §A11 the load count surfaces
 * as a count (not a "performance score"); per §A18 the labels
 * are descriptive (online / away / offline), never evaluative.
 *
 * A14 render branches:
 *   - loading (initial fetch hasn't returned)
 *   - status=online (emerald)
 *   - status=away (amber)
 *   - status=offline (muted)
 *   - menuOpen vs closed (status switcher dropdown)
 *   - currentLoad shown when status !== offline
 *
 * Polls /api/care/agent/presence every 45s so the heartbeat
 * stays warm + the load count stays current. Tab-hidden pauses
 * the poll.
 */
type AgentPresenceState = {
  status: "online" | "away" | "offline";
  currentLoad: number;
  maxConcurrent: number;
};

const PRESENCE_POLL_MS = 45_000;

function PresenceControl() {
  const [state, setState] = useState<AgentPresenceState | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const inflightRef = useRef(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const fetchPresence = useCallback(async () => {
    if (inflightRef.current) return;
    inflightRef.current = true;
    try {
      const res = await fetch("/api/care/agent/presence");
      if (res.ok) {
        const data = await res.json();
        if (data.self) {
          setState({
            status: data.self.status,
            currentLoad: data.self.currentLoad,
            maxConcurrent: data.self.maxConcurrent,
          });
        }
      }
    } catch {
      /* best-effort */
    } finally {
      inflightRef.current = false;
    }
  }, []);

  useEffect(() => {
    void fetchPresence();
    const id = window.setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      void fetchPresence();
    }, PRESENCE_POLL_MS);
    return () => window.clearInterval(id);
  }, [fetchPresence]);

  const setStatus = async (next: "online" | "away" | "offline") => {
    try {
      const res = await fetch("/api/care/agent/presence", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.self) {
          setState({
            status: data.self.status,
            currentLoad: data.self.currentLoad,
            maxConcurrent: data.self.maxConcurrent,
          });
        }
      }
    } finally {
      setMenuOpen(false);
    }
  };

  if (!state) {
    return (
      <div className="flex items-center gap-1.5 text-[11px] text-white/40">
        <span aria-hidden className="w-2 h-2 rounded-full bg-white/20" />
        Loading…
      </div>
    );
  }

  const dotCls =
    state.status === "online"
      ? "bg-emerald-400"
      : state.status === "away"
        ? "bg-amber-400"
        : "bg-white/30";
  const textCls =
    state.status === "online"
      ? "text-emerald-300"
      : state.status === "away"
        ? "text-amber-300"
        : "text-white/40";
  const label =
    state.status === "online"
      ? "Online"
      : state.status === "away"
        ? "Away"
        : "Offline";

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        className={`w-full flex items-center justify-between gap-2 text-[11px] font-medium ${textCls} hover:text-white transition-colors`}
        aria-haspopup="true"
        aria-expanded={menuOpen}
      >
        <span className="flex items-center gap-1.5">
          <span aria-hidden className={`w-2 h-2 rounded-full ${dotCls}`} />
          {label}
        </span>
        {state.status !== "offline" && (
          <span
            className="text-[10px] text-white/40 font-mono"
            title={`Currently carrying ${state.currentLoad} of ${state.maxConcurrent} (capacity)`}
          >
            {state.currentLoad}/{state.maxConcurrent}
          </span>
        )}
      </button>
      <FloatingMenu
        open={menuOpen}
        anchorRef={triggerRef}
        placement="bottom-stretch"
        onClose={() => setMenuOpen(false)}
        zIndex={50}
        className="bg-[#0B1620] border border-white/[0.08] rounded-md shadow-lg py-1"
      >
        <StatusOption
          current={state.status}
          value="online"
          label="Online"
          hint="Receiving auto-routed conversations"
          onClick={setStatus}
        />
        <StatusOption
          current={state.status}
          value="away"
          label="Away"
          hint="Visible to team, no auto-routing"
          onClick={setStatus}
        />
        <StatusOption
          current={state.status}
          value="offline"
          label="Offline"
          hint="Signed out of routing"
          onClick={setStatus}
        />
      </FloatingMenu>
    </div>
  );
}

function StatusOption({
  current,
  value,
  label,
  hint,
  onClick,
}: {
  current: "online" | "away" | "offline";
  value: "online" | "away" | "offline";
  label: string;
  hint: string;
  onClick: (next: "online" | "away" | "offline") => void;
}) {
  const isCurrent = current === value;
  const dotCls =
    value === "online"
      ? "bg-emerald-400"
      : value === "away"
        ? "bg-amber-400"
        : "bg-white/30";
  return (
    <button
      type="button"
      onClick={() => onClick(value)}
      disabled={isCurrent}
      className={`w-full text-left px-2.5 py-1.5 text-[11px] hover:bg-white/[0.05] disabled:opacity-60 disabled:cursor-default flex items-start gap-2`}
    >
      <span aria-hidden className={`w-2 h-2 rounded-full mt-1 ${dotCls}`} />
      <span className="flex-1">
        <span className="block font-semibold text-white/90">{label}</span>
        <span className="block text-[10px] text-white/40">{hint}</span>
      </span>
      {isCurrent && (
        <span className="text-[9px] uppercase tracking-widest text-white/40 font-mono mt-1">
          current
        </span>
      )}
    </button>
  );
}
