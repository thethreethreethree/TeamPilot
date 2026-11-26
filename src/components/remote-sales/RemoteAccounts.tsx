"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Loader2, Search } from "lucide-react";
import { useIsSalesCoachManager } from "@/lib/hooks/useCurrentUserRole";
import { nearMatches } from "@/lib/coach/remote/revenue/accountMatch";

/**
 * Remote Sales → Accounts (revenue Phase 1, 0370; Gong F21.1 account boards). Every account the caller can see: their
 * own deals' accounts ("Mine") or, for a manager, their whole team's ("Team"). Each row: open deals and their amount,
 * won and lost, last call, contacts, and activity (Gong F21.4: High / Medium / Low / Inactive over 90 days, from calls
 * where the customer spoke; revenue/activity.ts states the formula). A row opens the account page.
 */
type Row = { id: string; name: string; openDeals: number; openAmount: number; wonDeals: number; lostDeals: number; lastCallAt: string | null; contacts: number; activity?: { level: "high" | "medium" | "low" | "inactive"; score: number; calls90: number } };
const LEVEL_WORD = { high: "High", medium: "Medium", low: "Low", inactive: "Inactive" } as const;

const money = (n: number) => (n ? n.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "—");
const day = (s: string | null) => (s ? new Date(s).toLocaleDateString(undefined, { dateStyle: "medium" }) : "—");

export function RemoteAccounts() {
  const isManager = useIsSalesCoachManager();
  const [scope, setScope] = useState<"mine" | "team">("mine");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [capped, setCapped] = useState(false);
  const [state, setState] = useState<"loading" | "ok" | "failed">("loading");

  useEffect(() => {
    let live = true;
    setState("loading");
    const t = setTimeout(() => {
      fetch(`/api/coach/remote/accounts?scope=${scope}${q.trim() ? `&q=${encodeURIComponent(q.trim())}` : ""}`, { cache: "no-store" })
        .then(async (r) => {
          if (!live) return;
          if (!r.ok) return setState("failed");
          const j = (await r.json()) as { accounts: Row[]; capped: boolean };
          setRows(j.accounts);
          setCapped(j.capped);
          setState("ok");
        })
        .catch(() => live && setState("failed"));
    }, 200);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [scope, q]);

  return (
    <section aria-label="Accounts" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-primary">
          <Building2 className="h-4 w-4 text-brand" aria-hidden /> Accounts
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative">
            <span className="sr-only">Search accounts</span>
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" aria-hidden />
            <input value={q} onChange={(e) => setQ(e.currentTarget.value)} placeholder="Search accounts" className="rounded-lg border border-default bg-base py-1 pl-7 pr-2 text-xs text-primary" />
          </label>
          {isManager && (
            <div role="group" aria-label="Whose accounts" className="inline-flex overflow-hidden rounded-lg border border-default">
              {(["mine", "team"] as const).map((s) => (
                <button key={s} type="button" aria-pressed={scope === s} onClick={() => setScope(s)} className={`px-2.5 py-1 text-xs ${scope === s ? "bg-brand/15 font-semibold text-primary" : "text-secondary hover:text-primary"}`}>
                  {s === "mine" ? "Mine" : "Team"}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {state === "loading" && !rows ? (
        <p className="flex items-center gap-2 text-xs text-muted"><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Loading…</p>
      ) : state === "failed" ? (
        <p className="text-xs text-secondary">Couldn&apos;t load accounts. Refresh to try again.</p>
      ) : rows && rows.length === 0 ? (
        <div className="rounded-xl border border-default bg-surface p-4 text-xs text-secondary">
          {q.trim() ? `No account matches “${q.trim()}”.` : (
            <>No accounts yet. Open a deal in <Link href="/dashboard/remote-sales/pipeline" className="text-primary underline-offset-2 hover:underline">Pipeline</Link> and set its account: every deal at that company then shows up here together.</>
          )}
        </div>
      ) : (
        <>
        {/* Near matches are a suggestion for a person, never merged automatically (revenue plan: "Acme" and "Acme Inc"
            can be two companies). Moving a deal to the other account is done from the deal. */}
        {nearMatches(rows ?? []).length > 0 && (
          <div aria-label="Possible duplicates" className="rounded-xl border border-default bg-surface p-3 text-xs text-secondary">
            <p className="font-semibold text-primary">These may be the same company</p>
            <ul className="mt-1 space-y-0.5">
              {nearMatches(rows ?? []).map((g) => (
                <li key={g.map((a) => a.id).join("-")}>
                  {g.map((a, i) => (
                    <span key={a.id}>
                      {i > 0 ? " · " : ""}
                      <Link href={`/dashboard/remote-sales/accounts/${a.id}`} className="text-primary underline-offset-2 hover:underline">{a.name}</Link>
                    </span>
                  ))}
                </li>
              ))}
            </ul>
            <p className="mt-1 text-[11px] text-muted">If they are, open each deal on one of them and set its account to the other.</p>
          </div>
        )}
        <div className="overflow-x-auto rounded-xl border border-default bg-surface">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-default text-left text-[11px] uppercase tracking-wider text-muted">
                <th className="px-3 py-2 font-semibold">Account</th>
                <th className="px-3 py-2 text-right font-semibold">Open deals</th>
                <th className="px-3 py-2 text-right font-semibold">Open amount</th>
                <th className="px-3 py-2 text-right font-semibold">Won · lost</th>
                <th className="px-3 py-2 font-semibold">Last call</th>
                <th className="px-3 py-2 text-right font-semibold">Contacts</th>
                <th className="px-3 py-2 font-semibold" title="Engagement over 90 days, from calls where the customer spoke">Activity</th>
              </tr>
            </thead>
            <tbody>
              {(rows ?? []).map((a) => (
                <tr key={a.id} className="border-b border-default last:border-0 hover:bg-base/60">
                  <td className="px-3 py-2"><Link href={`/dashboard/remote-sales/accounts/${a.id}`} className="font-medium text-primary hover:underline">{a.name}</Link></td>
                  <td className="px-3 py-2 text-right tabular-nums text-primary">{a.openDeals}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-primary">{money(a.openAmount)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-secondary">{a.wonDeals} · {a.lostDeals}</td>
                  <td className="px-3 py-2 text-secondary">{day(a.lastCallAt)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-secondary">{a.contacts}</td>
                  <td className="px-3 py-2">
                    {a.activity && (
                      <span title={`${a.activity.calls90} two-way call${a.activity.calls90 === 1 ? "" : "s"} in 90 days`} className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${a.activity.level === "high" ? "bg-brand/20 text-primary" : a.activity.level === "medium" ? "bg-base text-primary" : "text-muted"}`}>
                        {LEVEL_WORD[a.activity.level]}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {capped && <p className="border-t border-default px-3 py-2 text-[11px] text-muted">Showing the most recent 1,000. Search to find older accounts.</p>}
        </div>
        </>
      )}
    </section>
  );
}
