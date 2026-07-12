"use client";

import { useEffect, useState } from "react";
import TopBar from "@/components/layout/TopBar";
import { useCompanyName } from "@/lib/hooks/useCompany";
import { LearningHint } from "@/components/learning/LearningHint";
import FinanceNav from "@/components/finance/FinanceNav";
import { useToast } from "@/components/ui/toast";
import {
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Landmark,
} from "lucide-react";

// Money arrives already-aggregated from SQL (decision #3 — no JS money math). We only FORMAT here.
const fmtMoney = (n: number) => {
  const v = Number(n) || 0;
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(2)}`;
};

type ExpenseRow = { code: string; name: string; amount: number };
type Summary = {
  base_currency: string;
  has_data: boolean;
  cash_on_hand: number;
  total_assets: number;
  total_liabilities: number;
  total_equity: number;
  total_revenue: number;
  total_expenses: number;
  net_income: number;
  ar_outstanding: number;
  ap_outstanding: number;
  expense_breakdown: ExpenseRow[];
  trial_balance: { debits: number; credits: number; difference: number };
};
type ApiState =
  | { available: true; summary: Summary }
  | { available: false; reason: string };

export default function FinancePage() {
  const companyName = useCompanyName();
  const toast = useToast();
  const [state, setState] = useState<ApiState | null>(null);
  const [initializing, setInitializing] = useState(false);

  const load = async () => {
    try {
      const res = await fetch("/api/finance/summary");
      setState((await res.json()) as ApiState);
    } catch {
      setState({ available: false, reason: "error" });
    }
  };
  useEffect(() => {
    void load();
  }, []);

  const initialize = async () => {
    setInitializing(true);
    try {
      const res = await fetch("/api/finance/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const j = await res.json();
      if (res.ok) {
        toast.success("Finance initialized", "Standard chart of accounts created.");
        await load();
      } else {
        toast.error("Couldn't initialize finance", j?.error ?? "");
      }
    } finally {
      setInitializing(false);
    }
  };

  return (
    <div className="min-h-screen bg-base">
      <TopBar title="Finance" subtitle={`${companyName} · Double-entry ledger`} />
      <FinanceNav />
      <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
        {state === null && (
          <div className="glass-card p-8 flex items-center justify-center gap-2 text-muted">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading your ledger…
          </div>
        )}

        {/* NOT INITIALIZED — honest state (no mock numbers). The ledger is built + applied; this
            company just hasn't set up its books yet. */}
        {state && !state.available && (
          <div className="glass-card p-8 text-center space-y-4 max-w-xl mx-auto">
            <Landmark className="w-8 h-8 text-brand mx-auto" />
            <h2 className="text-lg font-semibold text-primary">Your ledger isn&apos;t set up yet</h2>
            <p className="text-sm text-secondary leading-relaxed">
              The double-entry general ledger is live, but {companyName} hasn&apos;t initialized its
              books. Initializing creates a standard chart of accounts (Cash, AR, AP, Revenue,
              Expenses, FX Gain/Loss) in your base currency. Every figure on this page is then
              derived from your posted journal entries — nothing is estimated or mocked.
            </p>
            <button
              onClick={initialize}
              disabled={initializing}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand text-black font-medium text-sm disabled:opacity-60"
            >
              {initializing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Landmark className="w-4 h-4" />}
              Initialize finance (USD)
            </button>
            <p className="text-[11px] text-muted">
              Requires a controller/CFO or admin role. If this fails, you may not have finance
              permission for this company.
            </p>
          </div>
        )}

        {state?.available && <WiredDashboard s={state.summary} />}
      </div>
    </div>
  );
}

function WiredDashboard({ s }: { s: Summary }) {
  const balanced = Number(s.trial_balance?.difference ?? 0) === 0;
  const maxExpense = Math.max(1, ...s.expense_breakdown.map((e) => Math.abs(Number(e.amount))));
  const revExpMax = Math.max(1, Math.abs(Number(s.total_revenue)), Math.abs(Number(s.total_expenses)));

  return (
    <>
      {/* Empty ledger — real, but nothing posted yet */}
      {!s.has_data && (
        <div className="glass-card p-4 border-brand/20 text-sm text-secondary">
          Your chart of accounts is set up, but no journal entries have been <b>posted</b> yet, so
          every figure below is <b>$0</b> — honestly, not as a placeholder. Post a balanced entry
          (and have a second approver post it) and these fill in from the ledger.
        </div>
      )}

      {/* KPI tiles — all DERIVED from posted lines */}
      <LearningHint
        as="block"
        category="Finance · Vital signs"
        title="Headline numbers — derived, not estimated"
        whatItIs="Cash on hand, revenue and expenses to date, and net income — each summed in SQL from your posted journal lines. Trial-balance integrity is shown as its own signal."
        why="These are real: they can only move when a balanced entry is posted, and they always reconcile to the underlying transactions. No figure here is a guess."
        how="Read cash against net income for the shape of the month. The 'Books balanced' badge is the integrity check — if it ever reads OFF, a data-integrity alarm is firing and nothing else should be trusted until it's resolved."
        principle="Every derived figure traces to its source transactions — and says so."
      >
        {/* Each KPI links to where it can be traced to source — the statements drill-down
            (Trial Balance → account → posted GL lines → source doc) or the AR/AP transaction lists.
            Satisfies the non-negotiable "every derived figure is traceable via full drill-down." */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { label: "Cash on Hand", value: fmtMoney(s.cash_on_hand), color: "text-emerald-400", href: "/dashboard/finance/statements", trace: "Trace in Trial Balance" },
            { label: "Revenue (to date)", value: fmtMoney(s.total_revenue), color: "text-yellow-400", href: "/dashboard/finance/statements", trace: "Trace in Income Statement" },
            { label: "Expenses (to date)", value: fmtMoney(s.total_expenses), color: "text-orange-400", href: "/dashboard/finance/statements", trace: "Trace in Income Statement" },
            {
              label: "Net Income",
              value: fmtMoney(s.net_income),
              color: Number(s.net_income) >= 0 ? "text-emerald-400" : "text-red-400",
              href: "/dashboard/finance/statements",
              trace: "Trace in Income Statement",
            },
            { label: "Receivable (owed to you)", value: fmtMoney(s.ar_outstanding), color: "text-sky-400", href: "/dashboard/finance/ar", trace: "See invoices" },
            { label: "Payable (you owe)", value: fmtMoney(s.ap_outstanding), color: "text-amber-400", href: "/dashboard/finance/ap", trace: "See bills" },
          ].map((stat) => (
            <a
              key={stat.label}
              href={stat.href}
              className="glass-card p-4 block hover:border-brand/40 transition-colors group"
            >
              <p className="text-xs text-muted uppercase tracking-widest mb-2">{stat.label}</p>
              <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-[10px] text-muted mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                {stat.trace} →
              </p>
            </a>
          ))}
        </div>
      </LearningHint>

      {/* Trial balance integrity + Revenue vs Expenses */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass-card p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-primary mb-4">Revenue vs. Expenses (to date)</h2>
          <div className="flex items-end gap-8 h-40">
            {[
              { label: "Revenue", v: Number(s.total_revenue), cls: "from-ember-400 to-[#FDE047]" },
              { label: "Expenses", v: Number(s.total_expenses), cls: "from-orange-500 to-orange-300" },
            ].map((b) => (
              <div key={b.label} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full flex items-end justify-center h-32">
                  <div
                    className={`w-1/2 rounded-t bg-gradient-to-t ${b.cls}`}
                    style={{ height: `${(Math.abs(b.v) / revExpMax) * 100}%` }}
                    title={`${b.label} ${fmtMoney(b.v)}`}
                  />
                </div>
                <span className="text-[11px] text-muted uppercase tracking-wider">{b.label}</span>
                <span className="text-xs font-mono text-secondary">{fmtMoney(b.v)}</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted mt-3">
            Point-in-time totals from the ledger. A month-by-month trend arrives with Phase 6
            reporting (period-over-period) — shown honestly rather than mocked.
          </p>
        </div>

        <div className="glass-card p-5">
          <h2 className="text-sm font-semibold text-primary mb-4">Books integrity</h2>
          {balanced ? (
            <div className="flex items-start gap-2 text-sm text-emerald-400">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <div>
                <p className="font-medium">Balanced</p>
                <p className="text-xs text-secondary mt-1">
                  Total debits equal total credits ({fmtMoney(s.trial_balance.debits)}). The
                  accounting equation holds.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2 text-sm text-red-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <div>
                <p className="font-medium">OFF by {fmtMoney(s.trial_balance.difference)}</p>
                <p className="text-xs text-secondary mt-1">
                  Debits {fmtMoney(s.trial_balance.debits)} ≠ credits {fmtMoney(s.trial_balance.credits)}.
                  This is a data-integrity alarm — investigate before trusting any figure.
                </p>
              </div>
            </div>
          )}
          <div className="mt-4 pt-4 border-t border-default space-y-1.5 text-xs">
            <Row label="Assets" v={fmtMoney(s.total_assets)} />
            <Row label="Liabilities" v={fmtMoney(s.total_liabilities)} />
            <Row label="Equity" v={fmtMoney(s.total_equity)} />
          </div>
        </div>
      </div>

      {/* Expense breakdown (real) + honest awaiting-AR invoices */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-5">
          <h2 className="text-sm font-semibold text-primary mb-4">Expense Breakdown</h2>
          {s.expense_breakdown.length === 0 ? (
            <p className="text-xs text-muted">No expenses posted yet.</p>
          ) : (
            <div className="space-y-3">
              {/* Each expense account links to the statements drill-down (Trial Balance → this
                  account → its posted GL lines → source doc) — same traceability as the KPI tiles. */}
              {s.expense_breakdown.map((e) => (
                <a key={e.code} href="/dashboard/finance/statements" className="block group" title={`Trace ${e.name} to its posted transactions`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-secondary group-hover:text-primary transition-colors">{e.name}</span>
                    <span className="text-xs font-mono text-muted">{fmtMoney(e.amount)}</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-surface-raised overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-ember-400 to-[#FDE047]"
                      style={{ width: `${(Math.abs(Number(e.amount)) / maxExpense) * 100}%` }}
                    />
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-primary">Invoices &amp; Receivables</h2>
          </div>
          <div className="flex items-start gap-2 text-sm text-secondary">
            <TrendingDown className="w-4 h-4 text-muted shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Accounts Receivable is live — issue customer invoices (Dr AR / Cr Revenue) and record
              receipts. Manage them on{" "}
              <a href="/dashboard/finance/ar" className="text-brand hover:underline">Accounts Receivable</a>.
              The AR balance is reflected in Assets above. <span className="text-muted">Aging /
              dunning + monthly burn &amp; runway (forecasting) are later increments.</span>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

function Row({ label, v }: { label: string; v: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted">{label}</span>
      <span className="font-mono text-secondary">{v}</span>
    </div>
  );
}
