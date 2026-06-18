"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchHotkey } from "@/components/ui/useSearchHotkey";
import Link from "next/link";
import TopBar from "@/components/layout/TopBar";
import { LearningHint } from "@/components/learning/LearningHint";
import {
  Search,
  ChevronRight,
  Users,
  Loader2,
  ShieldAlert,
} from "lucide-react";
import {
  LIFECYCLE_LABEL,
  LIFECYCLE_TONE,
  PLAN_LABEL,
  type CrmAccountSummary,
  type CrmLifecycleStage,
} from "@/lib/crm/types";

/**
 * /dashboard/admin/crm — vendor-side CRM accounts list.
 *
 * Per AMD-006 §1.5.1 L4 — uniform with the other admin surfaces:
 * TopBar + filter row + table. Per CLAUDE.md §A11 — counts are
 * exposed (lifecycle, contacts, notes, last activity); no verdict
 * adjectives ("healthy" etc.) — the vendor team renders the read.
 */

const STAGES: Array<{ key: CrmLifecycleStage | "all"; label: string }> = [
  { key: "all", label: "All" },
  { key: "trial", label: "Trial" },
  { key: "control_month", label: "Control month" },
  { key: "activated", label: "Activated" },
  { key: "paying", label: "Paying" },
  { key: "at_risk", label: "At risk" },
  { key: "churned", label: "Churned" },
  { key: "archived", label: "Archived" },
];

type TestVisibility = "production" | "include" | "only";

export default function CrmAccountsPage() {
  const [accounts, setAccounts] = useState<CrmAccountSummary[]>([]);
  const [stage, setStage] = useState<CrmLifecycleStage | "all">("all");
  const [search, setSearch] = useState("");
  const [testVis, setTestVis] = useState<TestVisibility>("production");
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  useSearchHotkey(searchInputRef);

  useEffect(() => {
    let cancelled = false;
    const handle = window.setTimeout(() => {
      setLoading(true);
      setLoadError(null);
      const params = new URLSearchParams();
      if (stage !== "all") params.set("stage", stage);
      if (search.trim().length > 0) params.set("q", search.trim());
      if (testVis !== "production") params.set("test", testVis);
      void fetch(`/api/admin/crm/accounts?${params.toString()}`)
        .then(async (res) => {
          if (cancelled) return;
          if (res.status === 403) {
            setForbidden(true);
            setAccounts([]);
            return;
          }
          if (!res.ok) {
            setAccounts([]);
            setLoadError(`Could not load accounts (status ${res.status}).`);
            return;
          }
          const data = await res.json();
          setAccounts(data.accounts ?? []);
        })
        .catch((e: unknown) => {
          if (!cancelled) {
            setAccounts([]);
            setLoadError(
              e instanceof Error
                ? `Could not load accounts — ${e.message}`
                : "Could not load accounts (network error)."
            );
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [stage, search, testVis]);

  if (forbidden) {
    return (
      <div className="min-h-screen bg-base">
        <TopBar title="Customer accounts" subtitle="Vendor back office" />
        <div className="p-6 max-w-3xl mx-auto">
          <div className="glass-card p-6 border-ember-800/40 bg-ember-800/[0.06]">
            <div className="flex items-center gap-2 mb-2">
              <ShieldAlert className="w-4 h-4 text-ember-300" aria-hidden />
              <h2 className="text-sm font-semibold text-primary">
                Vendor admin only
              </h2>
            </div>
            <p className="text-xs text-secondary leading-relaxed">
              The CRM manages ELOSTATE&apos;s own customers — the companies
              signed up to use the product. Access is gated to CEO / COO /
              admin roles per the constitutional discipline around vendor-
              side data.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base">
      <TopBar
        title="Customer accounts"
        subtitle="Vendor back office · companies signed up to ELOSTATE"
      />
      <div className="p-6 max-w-7xl mx-auto space-y-5">
        {/* Search + filter row */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 w-full md:min-w-[240px] md:max-w-md">
            <Search
              className="w-3.5 h-3.5 text-muted absolute left-2.5 top-1/2 -translate-y-1/2"
              aria-hidden
            />
            <input
              ref={searchInputRef}
              type="search"
              autoComplete="off"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by company name or contact email… ( / )"
              aria-label="Search accounts. Press slash to focus."
              className="w-full bg-surface border border-default focus:border-strong rounded-md pl-8 pr-3 py-1.5 text-xs text-primary placeholder:text-muted focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {STAGES.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setStage(s.key)}
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-colors ${
                  stage === s.key
                    ? "border-ember-400/60 bg-ember-400/10 text-ember-300"
                    : "border-default bg-surface text-secondary hover:text-primary hover:border-strong"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Test-vs-production toggle. Per migration 0050 — production
            customers only by default so the metrics aren't polluted by
            founder/QA signups. */}
        <LearningHint
          as="block"
          category="CRM · Vendor admin"
          title="Environment filter"
          whatItIs="Toggles which accounts the list shows: Production (real customers only — default), + test (production AND test accounts), Test only (test accounts isolated). 'Test account' is a per-row boolean — the founder marks their own QA signups manually."
          why="The CRM tracks ELOSTATE's own customers. Without a test/production distinction, the founder's own dev signups would pollute the customer metrics (lifecycle stage distribution, contact counts, activity volume). Production-by-default is the honest behavior — any account is treated as a real customer until manually marked otherwise."
          how="Leave on Production for daily operating use. Switch to '+ test' when you want to see both for cross-checking. 'Test only' when you're auditing your own dev tenants specifically. Mark new test signups via the toggle in the account detail page."
          principle="Vendor-side metrics need clean data. The test flag is the boundary between 'this is real customer state' and 'this is dev exhaust' — honest by default, opt-in to surface dev rows."
        >
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className="text-muted uppercase tracking-widest font-bold mr-1">
            Environment
          </span>
          {(
            [
              { key: "production", label: "Production" },
              { key: "include", label: "+ test" },
              { key: "only", label: "Test only" },
            ] as const
          ).map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => setTestVis(v.key)}
              className={`px-2 py-0.5 rounded border transition-colors ${
                testVis === v.key
                  ? "border-violet-500/60 bg-violet-500/10 text-violet-300"
                  : "border-default bg-surface text-secondary hover:text-primary"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
        </LearningHint>

        {/* Counts banner */}
        <div className="flex items-center gap-4 text-xs text-muted">
          <span>
            <span className="text-primary font-semibold">{accounts.length}</span>{" "}
            account{accounts.length === 1 ? "" : "s"}{" "}
            {stage !== "all" ? `in ${LIFECYCLE_LABEL[stage]}` : "total"}
          </span>
          {loading && (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" aria-hidden /> loading…
            </span>
          )}
        </div>

        {loadError && (
          <div className="glass-card p-3 border border-red-500/30 bg-red-500/[0.04] flex items-center gap-3">
            <p className="flex-1 text-xs text-red-300">{loadError}</p>
            <button
              type="button"
              onClick={() => {
                setSearch((s) => s);
                setStage((s) => s);
              }}
              className="text-xs font-semibold text-ember-300 hover:text-primary border border-ember-400/40 hover:border-ember-400 px-2.5 py-1 rounded-md transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Table */}
        <div className="glass-card overflow-hidden">
          {/* Horizontal scroll on small screens — beats hiding
              columns. Customer-account audits often need to see
              every column. Add overflow-x-auto so the table can
              scroll inside the card without breaking the layout. */}
          <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="border-b border-default">
                {[
                  "Company",
                  "Stage",
                  "Plan",
                  "Subscription",
                  "Contacts",
                  "Last activity",
                  "",
                ].map((h) => (
                  <th
                    key={h}
                    className="text-left text-[10px] uppercase tracking-widest font-bold text-muted py-2.5 px-4 whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!loading && accounts.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="text-center text-xs text-muted py-8"
                  >
                    No accounts match this filter yet.
                  </td>
                </tr>
              )}
              {accounts.map((a) => (
                <tr
                  key={a.id}
                  className="border-b border-default hover:bg-surface-raised/50 transition-colors"
                >
                  <td className="py-2.5 px-4 max-w-[280px]">
                    <div className="flex items-center gap-2 min-w-0">
                      <Link
                        href={`/dashboard/admin/crm/${a.id}`}
                        className="text-sm text-primary font-semibold hover:text-ember-300 truncate"
                        title={a.companyName}
                      >
                        {a.companyName}
                      </Link>
                      {a.isTestAccount && (
                        <span className="text-[9px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded border border-violet-500/40 bg-violet-500/10 text-violet-300 shrink-0">
                          test
                        </span>
                      )}
                    </div>
                    {a.primaryContactEmail && (
                      <p
                        className="text-[10px] text-muted font-mono mt-0.5 truncate"
                        title={a.primaryContactEmail}
                      >
                        {a.primaryContactEmail}
                      </p>
                    )}
                  </td>
                  <td className="py-2.5 px-4">
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${LIFECYCLE_TONE[a.lifecycleStage]}`}
                    >
                      {LIFECYCLE_LABEL[a.lifecycleStage]}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-xs text-secondary">
                    {a.subscriptionPlan
                      ? PLAN_LABEL[a.subscriptionPlan]
                      : "—"}
                  </td>
                  <td className="py-2.5 px-4 text-xs text-secondary">
                    {a.subscriptionStatus ?? "—"}
                  </td>
                  <td className="py-2.5 px-4 text-xs text-secondary">
                    <span className="inline-flex items-center gap-1">
                      <Users className="w-3 h-3 text-muted" aria-hidden />
                      {a.contactCount}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-xs text-muted font-mono">
                    {a.lastActivityAt
                      ? new Date(a.lastActivityAt).toLocaleString()
                      : "—"}
                  </td>
                  <td className="py-2.5 px-2">
                    <Link
                      href={`/dashboard/admin/crm/${a.id}`}
                      className="inline-flex items-center gap-0.5 text-[11px] text-muted hover:text-primary"
                    >
                      Open
                      <ChevronRight className="w-3 h-3" aria-hidden />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>

        <p className="text-[10px] text-muted italic">
          Per §3.4 — billing is in the schema but the active state for every
          account is &quot;not_collecting&quot; / &quot;control_month&quot;
          until live billing is turned on. The plan + subscription columns
          show the bookkeeping shape, not active charges.
        </p>
      </div>
    </div>
  );
}
