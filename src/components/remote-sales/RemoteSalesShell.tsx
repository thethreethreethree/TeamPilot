"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PhoneCall } from "lucide-react";
import { useCurrentUserRole, useIsSalesCoachManager, isCompanyAdminRole } from "@/lib/hooks/useCurrentUserRole";
import { useRemoteMacroMode } from "@/lib/hooks/useRemoteMacroMode";

/**
 * The Remote Sales module's frame: its name, what it is, and its sections as tabs. The sections follow the RSS
 * build plan's phases (docs/rss/docs/07-BUILD-ORDER.md): Calls (capture, session page, scoring), Coaching (the
 * coaching loop), Search and Library (find and reuse), Trackers (detection), Training, Protection. Tabs a role
 * cannot use are not shown: Coaching and Trackers to Sales Coach managers, Protection to company admins.
 */
const TABS: Array<{ href: string; label: string; who: "all" | "manager" | "admin" }> = [
  { href: "/dashboard/remote-sales", label: "Calls", who: "all" },
  { href: "/dashboard/remote-sales/pipeline", label: "Pipeline", who: "all" },
  { href: "/dashboard/remote-sales/scoreboard", label: "Scoreboard", who: "all" },
  { href: "/dashboard/remote-sales/coaching", label: "Coaching", who: "manager" },
  { href: "/dashboard/remote-sales/search", label: "Search", who: "all" },
  { href: "/dashboard/remote-sales/library", label: "Library", who: "all" },
  { href: "/dashboard/remote-sales/trackers", label: "Trackers", who: "manager" },
  { href: "/dashboard/remote-sales/market", label: "Market", who: "manager" },
  { href: "/dashboard/remote-sales/training", label: "Training", who: "all" },
  { href: "/dashboard/remote-sales/protection", label: "Protection", who: "admin" },
];

/**
 * Macro Mode (0303, docs/rss/MACRO-MODE-SPEC.md): the simplified system — the rep's day, their pipeline, their calls.
 * The spec's manager rule: "Nothing will change here, except … a section where managers can see sales reps'
 * pipeline". So a MANAGER in Macro Mode keeps every tab they had and gains Today; only a rep's view is reduced.
 * Everything else is a tap away by turning Macro Mode off on Calls.
 */
const MACRO_TABS: Array<{ href: string; label: string; who: "all" | "manager" | "admin" }> = [
  { href: "/dashboard/remote-sales/today", label: "Today", who: "all" },
  { href: "/dashboard/remote-sales/pipeline", label: "Pipeline", who: "all" },
  { href: "/dashboard/remote-sales", label: "Calls", who: "all" },
];

export function RemoteSalesShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const isManager = useIsSalesCoachManager();
  const isAdmin = isCompanyAdminRole(useCurrentUserRole());
  const { enabled: macro } = useRemoteMacroMode();
  const leads = isManager || isAdmin;
  const visible = (list: typeof TABS) => list.filter((t) => t.who === "all" || (t.who === "manager" ? leads : isAdmin));
  const tabs = !macro ? visible(TABS) : leads ? [MACRO_TABS[0]!, ...visible(TABS)] : visible(MACRO_TABS);

  return (
    <div className="min-h-full bg-base">
      <header className="border-b border-default bg-surface">
        <div className="mx-auto max-w-6xl px-4 pt-5">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/15 text-brand">
              <PhoneCall className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-primary">Remote Sales</h1>
              <p className="text-xs text-secondary">
                {macro
                  ? "Your day, your pipeline, your calls — simple."
                  : "Phone and video sales calls — recorded, transcribed, scored with evidence, and coached."}
              </p>
            </div>
          </div>
          <nav className="-mb-px mt-4 flex gap-1 overflow-x-auto" aria-label="Remote Sales sections">
            {tabs.map((t) => {
              // Calls covers a call page; Training covers practising an assignment.
              const active =
                t.href === "/dashboard/remote-sales"
                  ? pathname === t.href || pathname.startsWith("/dashboard/remote-sales/calls/")
                  : pathname.startsWith(t.href) || (t.label === "Training" && pathname.startsWith("/dashboard/remote-sales/practice"));
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  aria-current={active ? "page" : undefined}
                  className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm ${
                    active ? "border-brand font-medium text-primary" : "border-transparent text-muted hover:text-primary"
                  }`}
                >
                  {t.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
