"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  ChevronDown,
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
  // §3.6 — agent sees their own growth. Per A10 nobody else sees
  // this individual data; the leader gets aggregate elsewhere.
  { label: "My growth", href: "/dashboard/care/growth", icon: Heart },
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

  return (
    <div className="flex h-screen w-full bg-base overflow-hidden">
      {/* Care left sidebar — dark navy, Zendesk-shaped */}
      <aside className="w-56 flex-shrink-0 bg-[#0B1620] text-white/90 border-r border-white/[0.06] flex flex-col">
        {/* Header: brand + agent status */}
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-md bg-[#FACC15] flex items-center justify-center">
              <LifeBuoy className="w-4 h-4 text-[#09090B]" aria-hidden />
            </div>
            <p className="text-sm font-bold tracking-tight">Care</p>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-300">
            <span
              aria-hidden
              className="w-2 h-2 rounded-full bg-emerald-400"
            />
            Online
          </div>
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
