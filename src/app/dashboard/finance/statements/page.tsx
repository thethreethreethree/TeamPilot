"use client";

import { useEffect, useState } from "react";
import TopBar from "@/components/layout/TopBar";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

type Line = { code: string; name: string; amount: number };
type TbRow = { code: string; name: string; type: string; debit: number; credit: number };
type Statements = {
  trial_balance: { rows: TbRow[]; total_debit: number; total_credit: number };
  income_statement: {
    revenue: Line[];
    expenses: Line[];
    total_revenue: number;
    total_expenses: number;
    net_income: number;
  };
  balance_sheet: {
    assets: Line[];
    liabilities: Line[];
    equity: Line[];
    total_assets: number;
    total_liabilities: number;
    total_equity: number;
    net_income: number;
  };
};

const m = (n: number) => `$${(Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function StatementsPage() {
  const [s, setS] = useState<Statements | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const r = await fetch("/api/finance/statements").then((x) => x.json());
      setS(r.statements ?? null);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-base">
      <TopBar title="Financial Statements" subtitle="Derived from your posted ledger" />
      <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
        {loading && (
          <div className="glass-card p-8 flex items-center justify-center gap-2 text-muted">
            <Loader2 className="w-4 h-4 animate-spin" /> Deriving statements…
          </div>
        )}
        {!loading && !s && <div className="glass-card p-6 text-sm text-muted">No data — initialize finance and post entries.</div>}
        {!loading && s && (
          <>
            <IncomeStatement is={s.income_statement} />
            <BalanceSheet bs={s.balance_sheet} />
            <TrialBalance tb={s.trial_balance} />
          </>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="glass-card p-5">
      <h2 className="text-sm font-semibold text-primary mb-4">{title}</h2>
      {children}
    </section>
  );
}

function Rows({ lines }: { lines: Line[] }) {
  return (
    <>
      {lines.length === 0 && <tr><td className="py-1 text-xs text-muted">—</td><td /></tr>}
      {lines.map((l) => (
        <tr key={l.code}>
          <td className="py-1 text-secondary"><span className="font-mono text-muted text-xs mr-2">{l.code}</span>{l.name}</td>
          <td className="py-1 text-right font-mono text-secondary">{m(l.amount)}</td>
        </tr>
      ))}
    </>
  );
}

function IncomeStatement({ is }: { is: Statements["income_statement"] }) {
  return (
    <Section title="Income Statement (P&L)">
      <table className="w-full text-sm">
        <tbody>
          <tr><td colSpan={2} className="pt-1 pb-1 text-xs uppercase tracking-wider text-muted">Revenue</td></tr>
          <Rows lines={is.revenue} />
          <tr className="border-t border-default"><td className="py-1 text-secondary">Total revenue</td><td className="py-1 text-right font-mono text-primary">{m(is.total_revenue)}</td></tr>
          <tr><td colSpan={2} className="pt-3 pb-1 text-xs uppercase tracking-wider text-muted">Expenses</td></tr>
          <Rows lines={is.expenses} />
          <tr className="border-t border-default"><td className="py-1 text-secondary">Total expenses</td><td className="py-1 text-right font-mono text-primary">{m(is.total_expenses)}</td></tr>
          <tr className="border-t-2 border-default"><td className="py-2 font-semibold text-primary">Net income</td><td className={`py-2 text-right font-mono font-semibold ${is.net_income >= 0 ? "text-emerald-400" : "text-red-400"}`}>{m(is.net_income)}</td></tr>
        </tbody>
      </table>
    </Section>
  );
}

function BalanceSheet({ bs }: { bs: Statements["balance_sheet"] }) {
  const liabPlusEquity = Number(bs.total_liabilities) + Number(bs.total_equity) + Number(bs.net_income);
  const balances = Math.abs(Number(bs.total_assets) - liabPlusEquity) < 0.005;
  return (
    <Section title="Balance Sheet">
      <table className="w-full text-sm">
        <tbody>
          <tr><td colSpan={2} className="pb-1 text-xs uppercase tracking-wider text-muted">Assets</td></tr>
          <Rows lines={bs.assets} />
          <tr className="border-t border-default"><td className="py-1 font-semibold text-secondary">Total assets</td><td className="py-1 text-right font-mono text-primary">{m(bs.total_assets)}</td></tr>
          <tr><td colSpan={2} className="pt-3 pb-1 text-xs uppercase tracking-wider text-muted">Liabilities</td></tr>
          <Rows lines={bs.liabilities} />
          <tr><td colSpan={2} className="pt-3 pb-1 text-xs uppercase tracking-wider text-muted">Equity</td></tr>
          <Rows lines={bs.equity} />
          <tr><td className="py-1 text-secondary">Net income (current period)</td><td className="py-1 text-right font-mono text-secondary">{m(bs.net_income)}</td></tr>
          <tr className="border-t border-default"><td className="py-1 font-semibold text-secondary">Total liabilities + equity</td><td className="py-1 text-right font-mono text-primary">{m(liabPlusEquity)}</td></tr>
        </tbody>
      </table>
      <div className={`mt-3 flex items-center gap-2 text-xs ${balances ? "text-emerald-400" : "text-red-400"}`}>
        {balances ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
        {balances ? "Balances — Assets = Liabilities + Equity + Net Income." : "Out of balance — a data-integrity alarm."}
      </div>
    </Section>
  );
}

function TrialBalance({ tb }: { tb: Statements["trial_balance"] }) {
  const balances = Math.abs(Number(tb.total_debit) - Number(tb.total_credit)) < 0.005;
  return (
    <Section title="Trial Balance">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs uppercase tracking-wider text-muted border-b border-default">
            <th className="text-left pb-2">Account</th>
            <th className="text-right pb-2">Debit</th>
            <th className="text-right pb-2">Credit</th>
          </tr>
        </thead>
        <tbody>
          {tb.rows.map((r) => (
            <tr key={r.code}>
              <td className="py-1 text-secondary"><span className="font-mono text-muted text-xs mr-2">{r.code}</span>{r.name}</td>
              <td className="py-1 text-right font-mono text-secondary">{r.debit > 0 ? m(r.debit) : ""}</td>
              <td className="py-1 text-right font-mono text-secondary">{r.credit > 0 ? m(r.credit) : ""}</td>
            </tr>
          ))}
          <tr className="border-t-2 border-default font-semibold">
            <td className="py-2 text-primary">Totals</td>
            <td className="py-2 text-right font-mono text-primary">{m(tb.total_debit)}</td>
            <td className="py-2 text-right font-mono text-primary">{m(tb.total_credit)}</td>
          </tr>
        </tbody>
      </table>
      <div className={`mt-3 flex items-center gap-2 text-xs ${balances ? "text-emerald-400" : "text-red-400"}`}>
        {balances ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
        {balances ? "Debits = Credits." : "Debits ≠ Credits — data-integrity alarm."}
      </div>
    </Section>
  );
}
