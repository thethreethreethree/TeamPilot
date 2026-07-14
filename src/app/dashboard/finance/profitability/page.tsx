"use client";

import { useEffect, useState, useCallback } from "react";
import TopBar from "@/components/layout/TopBar";
import FinanceNav from "@/components/finance/FinanceNav";
import FinanceNotSetUp from "@/components/finance/FinanceNotSetUp";
import { formatMoney } from "@/lib/finance/format";
import { useToast } from "@/components/ui/toast";
import { Plus } from "lucide-react";

type Customer = { id: string; name: string };
type ProjRow = { project_id: string; code: string; name: string; status: string; budget: number | null; revenue: number; direct_cost: number; total_cost: number; allocated_overhead: number | null; loaded_margin: number | null };
type CcRow = { cost_center_id: string; code: string; name: string; revenue: number; direct_cost: number; total_cost: number };
type CuRow = { customer_id: string; name: string; revenue: number; total_cost: number };
const money = formatMoney;

function marginPct(rev: number, cost: number): string {
  if (rev === 0) return "—";
  return `${(((rev - cost) / rev) * 100).toFixed(0)}%`;
}

export default function ProfitabilityPage() {
  const toast = useToast();
  const [accountsCount, setAccountsCount] = useState<number | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [projects, setProjects] = useState<ProjRow[]>([]);
  const [unallocated, setUnallocated] = useState(0);
  const [costCenters, setCostCenters] = useState<CcRow[]>([]);
  const [custProfit, setCustProfit] = useState<CuRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const [ac, prof, cu] = await Promise.all([
        fetch("/api/finance/accounts").then((r) => r.json()),
        fetch("/api/finance/profitability").then((r) => r.json()),
        fetch("/api/finance/ar/customers").then((r) => r.json()),
      ]);
      setAccountsCount((ac.accounts ?? []).length);
      setProjects(prof.projects ?? []);
      setUnallocated(Number(prof.unallocatedOverhead ?? 0));
      setCostCenters(prof.costCenters ?? []);
      setCustProfit(prof.customers ?? []);
      setCustomers(cu.customers ?? []);
    } catch {
      toast.error("Couldn't load profitability", "Check your connection and refresh.");
    } finally {
      setLoaded(true);
    }
  }, [toast]);
  useEffect(() => {
    void load();
  }, [load]);

  const [ccCode, setCcCode] = useState("");
  const [ccName, setCcName] = useState("");
  const [pCode, setPCode] = useState("");
  const [pName, setPName] = useState("");
  const [pCust, setPCust] = useState("");

  const createDim = async (payload: Record<string, unknown>, reset: () => void) => {
    setBusy(true);
    const res = await fetch("/api/finance/dimensions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const j = await res.json();
    setBusy(false);
    if (res.ok) { reset(); toast.success("Created"); void load(); }
    else toast.error("Couldn't create", j?.error ?? "");
  };

  if (loaded && accountsCount === 0)
    return (
      <div className="min-h-screen bg-base">
        <TopBar title="Cost & Profitability" subtitle="Cost centers, projects, and margin by dimension" />
        <FinanceNav />
        <FinanceNotSetUp feature="Profitability" />
      </div>
    );

  return (
    <div className="min-h-screen bg-base">
      <TopBar title="Cost & Profitability" subtitle="Cost centers, projects, and margin by dimension" />
      <FinanceNav />
      <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
        <p className="text-xs text-muted">
          Tag bill / invoice / expense lines with a <strong>cost center</strong> or <strong>project</strong>,
          and this slices your posted ledger into margins — revenue − cost per dimension, with
          contribution margin (revenue − <em>direct</em> cost). Untagged activity isn&apos;t hidden;
          it just isn&apos;t attributed to a slice. Everything ties back to a posted journal line.
        </p>

        {/* Create dimensions */}
        <section className="glass-card p-5">
          <h2 className="text-sm font-semibold text-primary mb-3">Cost centers &amp; projects</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted mb-2">New cost center</p>
              <div className="flex gap-2">
                <input value={ccCode} onChange={(e) => setCcCode(e.target.value)} placeholder="Code" className="w-24 bg-surface rounded-lg px-2 py-2 text-sm text-primary border border-default" />
                <input value={ccName} onChange={(e) => setCcName(e.target.value)} placeholder="Name (e.g. Engineering)" className="flex-1 bg-surface rounded-lg px-2 py-2 text-sm text-primary border border-default" />
                <button aria-label="Add cost center" title="Add cost center" onClick={() => ccCode && ccName && createDim({ kind: "cost_center", code: ccCode, name: ccName }, () => { setCcCode(""); setCcName(""); })} disabled={busy} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-brand text-black text-sm font-medium disabled:opacity-60"><Plus className="w-4 h-4" /></button>
              </div>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted mb-2">New project</p>
              <div className="flex gap-2">
                <input value={pCode} onChange={(e) => setPCode(e.target.value)} placeholder="Code" className="w-20 bg-surface rounded-lg px-2 py-2 text-sm text-primary border border-default" />
                <input value={pName} onChange={(e) => setPName(e.target.value)} placeholder="Name" className="flex-1 bg-surface rounded-lg px-2 py-2 text-sm text-primary border border-default" />
                <select value={pCust} onChange={(e) => setPCust(e.target.value)} className="w-28 bg-surface rounded-lg px-2 py-2 text-sm text-primary border border-default">
                  <option value="">Client…</option>
                  {customers.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                </select>
                <button aria-label="Add project" title="Add project" onClick={() => pCode && pName && createDim({ kind: "project", code: pCode, name: pName, customerId: pCust || undefined }, () => { setPCode(""); setPName(""); setPCust(""); })} disabled={busy} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-brand text-black text-sm font-medium disabled:opacity-60"><Plus className="w-4 h-4" /></button>
              </div>
            </div>
          </div>
        </section>

        <MarginTable
          title="Profitability by project"
          empty="No projects yet — create one above, then tag invoice/bill lines with it."
          rows={projects.map((p) => ({ key: p.project_id, label: `${p.code} ${p.name}`, revenue: p.revenue, direct: p.direct_cost, total: p.total_cost, note: p.status }))}
        />

        {/* FULLY-LOADED MARGIN (0173).
            The table above shows margin on DIRECT cost, which systematically FLATTERS every project —
            because no project pays the rent. A founder reading only direct margin is being quietly told
            that every project is more profitable than it is, and will happily repeat a project that in
            truth lost money once its share of overhead is counted. So the loaded figure sits directly
            beneath the direct one, and the difference between them is the whole point. */}
        <section className="rounded-xl border border-default bg-surface p-4">
          <h2 className="text-sm font-medium text-primary">Profitability by project — after overhead</h2>
          <p className="mt-1 text-xs text-secondary">
            The table above counts only <strong>direct</strong> cost. No project pays the rent — so every
            margin there looks better than it is. Below, each project carries its share of overhead,
            allocated by its share of direct cost. This is the number to decide with.
          </p>

          {/* Overhead nobody could absorb is NAMED, not folded in. Folding it into the projects would
              improve every margin on this page and nothing downstream would disagree. */}
          {unallocated > 0.005 && (
            <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
              <strong>{formatMoney(unallocated)}</strong> of overhead could not be allocated to any project
              — it fell in months with no direct project cost to divide it by. It is <strong>not</strong>
              included in the margins below, and we have <strong>not</strong> spread it across your projects
              to make the sums come out. It is real money that no project is currently carrying.
            </div>
          )}

          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-secondary">
                  <th className="text-left pb-2 pr-3">Project</th>
                  <th className="text-right pb-2 pr-3">Revenue</th>
                  <th className="text-right pb-2 pr-3">Direct cost</th>
                  <th className="text-right pb-2 pr-3">Overhead absorbed</th>
                  <th className="text-right pb-2">Margin after overhead</th>
                </tr>
              </thead>
              <tbody>
                {projects.length === 0 && (
                  <tr><td colSpan={5} className="py-6 text-center text-xs text-secondary">No projects yet.</td></tr>
                )}
                {projects.map((p) => (
                  <tr key={p.project_id} className="border-t border-default">
                    <td className="py-1.5 pr-3 text-primary">{p.code} {p.name}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums text-primary">{formatMoney(p.revenue)}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums text-secondary">{formatMoney(p.direct_cost)}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums text-secondary">
                      {p.allocated_overhead == null ? "—" : formatMoney(p.allocated_overhead)}
                    </td>
                    <td className="py-1.5 text-right tabular-nums font-medium text-primary">
                      {/* NULL, never the direct margin. Showing the direct margin here — under a heading
                          that says "after overhead" — would report a project as profitable at the exact
                          moment we could not work out what it cost. */}
                      {p.loaded_margin == null ? (
                        <span className="text-xs font-normal text-secondary" title="Overhead could not be allocated for at least one month, so we cannot state this project's true margin.">
                          Not yet knowable
                        </span>
                      ) : (
                        formatMoney(p.loaded_margin)
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <MarginTable
          title="Profitability by cost center"
          empty="No cost centers yet."
          rows={costCenters.map((c) => ({ key: c.cost_center_id, label: `${c.code} ${c.name}`, revenue: c.revenue, direct: c.direct_cost, total: c.total_cost }))}
        />
        {custProfit.length > 0 && (
          <MarginTable
            title="Profitability by customer (via projects)"
            empty=""
            rows={custProfit.map((c) => ({ key: c.customer_id, label: c.name, revenue: c.revenue, total: c.total_cost }))}
          />
        )}
      </div>
    </div>
  );
}

function MarginTable({
  title,
  empty,
  rows,
}: {
  title: string;
  empty: string;
  rows: { key: string; label: string; revenue: number; direct?: number; total: number; note?: string }[];
}) {
  return (
    <section className="glass-card p-5">
      <h2 className="text-sm font-semibold text-primary mb-3">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-xs text-muted">{empty}</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-default text-muted text-xs uppercase tracking-wider">
              <th className="text-left pb-2 pr-3">Name</th>
              <th className="text-right pb-2 pr-3">Revenue</th>
              <th className="text-right pb-2 pr-3">Cost</th>
              <th className="text-right pb-2 pr-3">Margin</th>
              <th className="text-right pb-2">Margin %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-default">
            {rows.map((r) => {
              const m = r.revenue - r.total;
              return (
                <tr key={r.key}>
                  <td className="py-2 pr-3 text-secondary">{r.label}{r.note ? <span className="text-[10px] text-muted ml-2">{r.note}</span> : null}</td>
                  <td className="py-2 pr-3 text-right font-mono text-secondary">{money(r.revenue)}</td>
                  <td className="py-2 pr-3 text-right font-mono text-secondary">{money(r.total)}</td>
                  <td className={`py-2 pr-3 text-right font-mono ${m >= 0 ? "text-emerald-400" : "text-red-400"}`}>{money(m)}</td>
                  <td className={`py-2 text-right font-mono ${m >= 0 ? "text-emerald-400" : "text-red-400"}`}>{marginPct(r.revenue, r.total)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
