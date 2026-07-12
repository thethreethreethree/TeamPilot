"use client";

import { useEffect, useState, useCallback } from "react";
import TopBar from "@/components/layout/TopBar";
import FinanceNav from "@/components/finance/FinanceNav";
import FinanceNotSetUp from "@/components/finance/FinanceNotSetUp";
import { formatMoney } from "@/lib/finance/format";
import { useToast } from "@/components/ui/toast";
import { Plus, TrendingDown } from "lucide-react";

type Account = { id: string; code: string; name: string; type: string };
type Dim = { id: string; code: string; name: string };
type Budget = { id: string; name: string; fiscal_year: number; granularity: string; status: string };
type VarRow = { budget_line_id: string; code: string; account_name: string; type: string; cost_center_id: string | null; period_index: number; budget: number; actual: number };
type Runway = { cash_on_hand: number; monthly_burn: number; runway_months: number | null };
const money = formatMoney;
const Q = ["Year", "Q1", "Q2", "Q3", "Q4"];

export default function BudgetsPage() {
  const toast = useToast();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [costCenters, setCostCenters] = useState<Dim[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [lines, setLines] = useState<VarRow[]>([]);
  const [runway, setRunway] = useState<Runway | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const [a, dim, b, rw] = await Promise.all([
      fetch("/api/finance/accounts").then((r) => r.json()),
      fetch("/api/finance/dimensions").then((r) => r.json()),
      fetch("/api/finance/budgets").then((r) => r.json()),
      fetch("/api/finance/runway").then((r) => r.json()),
    ]);
    setAccounts(a.accounts ?? []);
    setCostCenters(dim.costCenters ?? []);
    setBudgets(b.budgets ?? []);
    setRunway(rw.runway ?? null);
    setLoaded(true);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const loadLines = useCallback(async (id: string) => {
    const r = await fetch(`/api/finance/budgets/${id}`).then((x) => x.json());
    setLines(r.lines ?? []);
  }, []);
  useEffect(() => { if (sel) void loadLines(sel); else setLines([]); }, [sel, loadLines]);

  const plAccounts = accounts.filter((a) => a.type === "revenue" || a.type === "expense");
  const ccName = (id: string | null) => (id ? costCenters.find((c) => c.id === id)?.name ?? "—" : "(company-wide)");

  const [bName, setBName] = useState("");
  const [bYear, setBYear] = useState(String(new Date().getFullYear()));
  const createBudget = async () => {
    if (!bName || !bYear) return;
    setBusy(true);
    const res = await fetch("/api/finance/budgets", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: bName, fiscalYear: Number(bYear) }),
    });
    const j = await res.json();
    setBusy(false);
    if (res.ok) { setBName(""); toast.success("Budget created"); await load(); setSel(j.id); }
    else toast.error("Couldn't create budget", j?.error ?? "");
  };

  const [lAcct, setLAcct] = useState("");
  const [lCc, setLCc] = useState("");
  const [lQ, setLQ] = useState("1");
  const [lAmt, setLAmt] = useState("");
  const addLine = async () => {
    if (!sel || !lAcct || !lAmt) { toast.error("Pick an account, quarter, and amount"); return; }
    setBusy(true);
    const res = await fetch(`/api/finance/budgets/${sel}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId: lAcct, costCenterId: lCc || undefined, periodIndex: Number(lQ), amount: Number(lAmt) }),
    });
    const j = await res.json();
    setBusy(false);
    if (res.ok) { setLAmt(""); toast.success("Budget line saved"); void loadLines(sel); }
    else toast.error("Couldn't save line", j?.error ?? "");
  };

  if (loaded && accounts.length === 0)
    return (
      <div className="min-h-screen bg-base">
        <TopBar title="Budgeting & Forecasting" subtitle="Budgets, variance, and runway" />
        <FinanceNav />
        <FinanceNotSetUp feature="Budgeting" />
      </div>
    );

  return (
    <div className="min-h-screen bg-base">
      <TopBar title="Budgeting & Forecasting" subtitle="Budgets, variance, and runway" />
      <FinanceNav />
      <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
        {/* Runway */}
        <section className="glass-card p-5">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="w-4 h-4 text-brand" />
            <h2 className="text-sm font-semibold text-primary">Runway</h2>
          </div>
          {runway ? (
            <div className="flex flex-wrap gap-6 mt-2">
              <div><p className="text-[10px] uppercase tracking-wider text-muted">Cash on hand</p><p className="text-xl font-bold text-emerald-400">{money(runway.cash_on_hand)}</p></div>
              <div><p className="text-[10px] uppercase tracking-wider text-muted">Monthly burn (3-mo avg)</p><p className="text-xl font-bold text-secondary">{money(runway.monthly_burn)}</p></div>
              <div><p className="text-[10px] uppercase tracking-wider text-muted">Runway</p><p className="text-xl font-bold text-primary">{runway.runway_months == null ? "∞ (profitable)" : `${runway.runway_months} mo`}</p></div>
            </div>
          ) : <p className="text-xs text-muted">Post some entries to compute runway.</p>}
          <p className="text-[11px] text-muted mt-2">Cash = asset accounts named cash/bank; burn = (expense − revenue) over the last 3 months ÷ 3. A projection, not a booked figure.</p>
        </section>

        {/* Budgets */}
        <section className="glass-card p-5">
          <h2 className="text-sm font-semibold text-primary mb-3">Budgets</h2>
          <div className="flex flex-wrap gap-2 mb-3">
            {budgets.map((b) => (
              <button key={b.id} onClick={() => setSel(sel === b.id ? null : b.id)} className={`text-xs px-3 py-1.5 rounded-lg border ${sel === b.id ? "border-brand text-primary bg-brand/10" : "border-default text-muted hover:text-secondary"}`}>{b.name} · {b.fiscal_year}</button>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={bName} onChange={(e) => setBName(e.target.value)} placeholder="Budget name (e.g. FY2026 plan)" className="flex-1 bg-surface rounded-lg px-2 py-2 text-sm text-primary border border-default" />
            <input value={bYear} onChange={(e) => setBYear(e.target.value)} inputMode="numeric" placeholder="Year" className="w-20 bg-surface rounded-lg px-2 py-2 text-sm text-primary border border-default" />
            <button onClick={createBudget} disabled={busy} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-brand text-black text-sm font-medium disabled:opacity-60"><Plus className="w-4 h-4" /> New</button>
          </div>
        </section>

        {/* Selected budget: add line + variance */}
        {sel && (
          <section className="glass-card p-5">
            <h2 className="text-sm font-semibold text-primary mb-3">Budget lines &amp; variance</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
              <select value={lAcct} onChange={(e) => setLAcct(e.target.value)} className="bg-surface rounded-lg px-2 py-2 text-sm text-primary border border-default">
                <option value="">Account…</option>
                {plAccounts.map((a) => (<option key={a.id} value={a.id}>{a.code} {a.name}</option>))}
              </select>
              <select value={lCc} onChange={(e) => setLCc(e.target.value)} className="bg-surface rounded-lg px-2 py-2 text-sm text-primary border border-default">
                <option value="">Company-wide</option>
                {costCenters.map((c) => (<option key={c.id} value={c.id}>{c.code} {c.name}</option>))}
              </select>
              <select value={lQ} onChange={(e) => setLQ(e.target.value)} className="bg-surface rounded-lg px-2 py-2 text-sm text-primary border border-default">
                <option value="0">Whole year</option>
                <option value="1">Q1</option><option value="2">Q2</option><option value="3">Q3</option><option value="4">Q4</option>
              </select>
              <input value={lAmt} onChange={(e) => setLAmt(e.target.value)} inputMode="decimal" placeholder="Budget amount" className="bg-surface rounded-lg px-2 py-2 text-sm text-primary border border-default" />
              <button onClick={addLine} disabled={busy} className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-brand text-black text-sm font-medium disabled:opacity-60"><Plus className="w-4 h-4" /> Save line</button>
            </div>
            {lines.length === 0 ? (
              <p className="text-xs text-muted">No budget lines yet. Add a target above; actuals fill in from posted, tagged entries.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-default text-muted text-xs uppercase tracking-wider">
                    <th className="text-left pb-2 pr-3">Account</th>
                    <th className="text-left pb-2 pr-3">Cost center</th>
                    <th className="text-left pb-2 pr-3">Period</th>
                    <th className="text-right pb-2 pr-3">Budget</th>
                    <th className="text-right pb-2 pr-3">Actual</th>
                    <th className="text-right pb-2">Variance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-default">
                  {lines.map((r) => {
                    const v = Number(r.actual) - Number(r.budget);
                    // Over-budget on an expense is bad; under-budget on revenue is bad.
                    const bad = r.type === "revenue" ? v < 0 : v > 0;
                    return (
                      <tr key={r.budget_line_id}>
                        <td className="py-2 pr-3 text-secondary"><span className="font-mono text-muted text-xs mr-1">{r.code}</span>{r.account_name}</td>
                        <td className="py-2 pr-3 text-muted text-xs">{ccName(r.cost_center_id)}</td>
                        <td className="py-2 pr-3 text-muted text-xs">{Q[r.period_index] ?? `M${r.period_index}`}</td>
                        <td className="py-2 pr-3 text-right font-mono text-secondary">{money(r.budget)}</td>
                        <td className="py-2 pr-3 text-right font-mono text-secondary">{money(r.actual)}</td>
                        <td className={`py-2 text-right font-mono ${bad ? "text-red-400" : "text-emerald-400"}`}>{v >= 0 ? "+" : ""}{money(v)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
