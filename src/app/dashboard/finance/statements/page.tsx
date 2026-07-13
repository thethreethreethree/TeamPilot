"use client";

import { useEffect, useState, Fragment } from "react";
import TopBar from "@/components/layout/TopBar";
import FinanceNav from "@/components/finance/FinanceNav";
import { Loader2, CheckCircle2, AlertTriangle, Download } from "lucide-react";
import {
  type Statements,
  type StmtLine as Line,
  statementsToCsv,
  balanceSheetTiesOut,
  trialBalances,
} from "@/lib/finance/statements";
import { formatMoney } from "@/lib/finance/format";
import { priorRange } from "@/lib/finance/dateRange";

type GlLine = { entry_no: number; entry_date: string; description: string; debit: number; credit: number };

const m = formatMoney;

function downloadCsv(s: Statements) {
  const blob = new Blob([statementsToCsv(s)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "financial-statements.csv";
  a.click();
  URL.revokeObjectURL(url);
}

type Period = "all" | "month" | "quarter" | "year" | "custom";

// P&L covers [from,to]; the Balance Sheet + Trial Balance are as-of `to`. Empty strings = all-time.
function rangeFor(period: Period, cFrom: string, cTo: string): { from: string; to: string } {
  if (period === "all") return { from: "", to: "" };
  if (period === "custom") return { from: cFrom, to: cTo };
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  if (period === "month") return { from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 0)) };
  if (period === "quarter") {
    const q = Math.floor(m / 3) * 3;
    return { from: iso(new Date(y, q, 1)), to: iso(new Date(y, q + 3, 0)) };
  }
  return { from: iso(new Date(y, 0, 1)), to: iso(new Date(y, 11, 31)) }; // year
}

export default function StatementsPage() {
  const [s, setS] = useState<Statements | null>(null);
  const [sPrior, setSPrior] = useState<Statements | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("all");
  const [cFrom, setCFrom] = useState("");
  const [cf, setCf] = useState<CashFlow | null>(null);
  const [cTo, setCTo] = useState("");
  const { from, to } = rangeFor(period, cFrom, cTo);
  const prior = priorRange(from, to);

  useEffect(() => {
    setLoading(true);
    void (async () => {
      const qs = new URLSearchParams();
      if (from) qs.set("from", from);
      if (to) qs.set("to", to);
      const r = await fetch(`/api/finance/statements?${qs.toString()}`).then((x) => x.json());
      fetch(`/api/finance/statements/cash-flow`)
        .then((x) => x.json())
        .then((j) => setCf(j.error ? null : j))
        .catch(() => setCf(null));
      setS(r.statements ?? null);
      // Period-over-period: fetch the prior same-length window when a bounded period is selected.
      if (prior.from && prior.to) {
        const pqs = new URLSearchParams({ from: prior.from, to: prior.to });
        const pr = await fetch(`/api/finance/statements?${pqs.toString()}`).then((x) => x.json());
        setSPrior(pr.statements ?? null);
      } else {
        setSPrior(null);
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  return (
    <div className="min-h-screen bg-base">
      <TopBar title="Financial Statements" subtitle="Derived from your posted ledger" />
      <FinanceNav />
      <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
        {/* Period selector (0144). P&L covers the range; Balance Sheet + Trial Balance are as-of the
            end date. All time = every posted entry (the original behaviour). */}
        <div className="glass-card p-3 flex flex-wrap items-center gap-2">
          {([
            { k: "all", label: "All time" },
            { k: "month", label: "This month" },
            { k: "quarter", label: "This quarter" },
            { k: "year", label: "This year" },
            { k: "custom", label: "Custom" },
          ] as { k: Period; label: string }[]).map((opt) => (
            <button
              key={opt.k}
              onClick={() => setPeriod(opt.k)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                period === opt.k ? "border-brand text-primary bg-brand/10" : "border-default text-muted hover:text-secondary"
              }`}
            >
              {opt.label}
            </button>
          ))}
          {period === "custom" && (
            <span className="inline-flex items-center gap-1 text-xs text-muted">
              <input type="date" value={cFrom} onChange={(e) => setCFrom(e.target.value)} className="bg-surface rounded px-2 py-1 text-primary border border-default" />
              <span>→</span>
              <input type="date" value={cTo} onChange={(e) => setCTo(e.target.value)} className="bg-surface rounded px-2 py-1 text-primary border border-default" />
            </span>
          )}
        </div>
        {!loading && s && (
          <p className="text-[11px] text-muted">
            {period === "all" ? (
              <>Showing <strong>all-time cumulative</strong> figures from every posted entry.</>
            ) : (
              <>
                Income Statement covers <strong>{from || "…"} → {to || "…"}</strong>; the Balance Sheet
                and Trial Balance are <strong>as of {to || "…"}</strong> (a point-in-time snapshot, so
                its net income is cumulative-to-date, not the period figure).
              </>
            )}
          </p>
        )}
        {loading && (
          <div className="glass-card p-8 flex items-center justify-center gap-2 text-muted">
            <Loader2 className="w-4 h-4 animate-spin" /> Deriving statements…
          </div>
        )}
        {!loading && !s && <div className="glass-card p-6 text-sm text-muted">No data — initialize finance and post entries.</div>}
        {!loading && s && (
          <>
            <div className="flex justify-end">
              <button onClick={() => downloadCsv(s)} className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-surface-raised text-secondary hover:text-primary transition-colors">
                <Download className="w-3.5 h-3.5" /> Export CSV
              </button>
            </div>
            <IncomeStatement is={s.income_statement} />
            {sPrior && <PeriodComparison cur={s.income_statement} prior={sPrior.income_statement} priorLabel={`${prior.from} → ${prior.to}`} />}
            <BalanceSheet bs={s.balance_sheet} />
            {cf && <CashFlowStatement cf={cf} />}
            <TrialBalance tb={s.trial_balance} />
          </>
        )}
      </div>
    </div>
  );
}

// Phase-6 period-over-period: the current period's P&L totals vs the prior same-length window.
function PeriodComparison({
  cur,
  prior,
  priorLabel,
}: {
  cur: Statements["income_statement"];
  prior: Statements["income_statement"];
  priorLabel: string;
}) {
  const rows = [
    { label: "Revenue", now: Number(cur.total_revenue), was: Number(prior.total_revenue), goodUp: true },
    { label: "Expenses", now: Number(cur.total_expenses), was: Number(prior.total_expenses), goodUp: false },
    { label: "Net income", now: Number(cur.net_income), was: Number(prior.net_income), goodUp: true },
  ];
  const pct = (now: number, was: number) => (was === 0 ? null : ((now - was) / Math.abs(was)) * 100);
  return (
    <Section title="Period over period (vs prior period)">
      <p className="text-[11px] text-muted mb-3">Compared with the prior same-length window: <span className="font-mono">{priorLabel}</span>.</p>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs uppercase tracking-wider text-muted border-b border-default">
            <th className="text-left pb-2">Metric</th>
            <th className="text-right pb-2">This period</th>
            <th className="text-right pb-2">Prior</th>
            <th className="text-right pb-2">Change</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const delta = r.now - r.was;
            const p = pct(r.now, r.was);
            const positive = delta >= 0;
            const good = positive === r.goodUp;
            return (
              <tr key={r.label} className="border-t border-default">
                <td className="py-1.5 text-secondary">{r.label}</td>
                <td className="py-1.5 text-right font-mono text-primary">{m(r.now)}</td>
                <td className="py-1.5 text-right font-mono text-muted">{m(r.was)}</td>
                <td className={`py-1.5 text-right font-mono ${good ? "text-emerald-400" : "text-red-400"}`}>
                  {positive ? "+" : ""}{m(delta)}{p === null ? "" : ` (${positive ? "+" : ""}${p.toFixed(0)}%)`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Section>
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
  const balances = balanceSheetTiesOut(bs);
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
  const balances = trialBalances(tb);
  const [open, setOpen] = useState<string | null>(null);
  const [gl, setGl] = useState<Record<string, GlLine[]>>({});

  const toggle = async (accountId: string) => {
    if (open === accountId) {
      setOpen(null);
      return;
    }
    setOpen(accountId);
    if (!gl[accountId]) {
      const r = await fetch(`/api/finance/gl?accountId=${accountId}`).then((x) => x.json());
      setGl((g) => ({ ...g, [accountId]: r.lines ?? [] }));
    }
  };

  return (
    <Section title="Trial Balance">
      <p className="text-[11px] text-muted mb-2">Click an account to drill down to its posted transactions.</p>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs uppercase tracking-wider text-muted border-b border-default">
            <th className="text-left pb-2">Account</th>
            <th className="text-right pb-2">Debit</th>
            <th className="text-right pb-2">Credit</th>
          </tr>
        </thead>
        <tbody>
          {tb.rows.map((r) => {
            const lines = gl[r.account_id];
            return (
            <Fragment key={r.account_id}>
              <tr className="cursor-pointer hover:bg-surface" onClick={() => toggle(r.account_id)}>
                <td className="py-1 text-secondary"><span className="font-mono text-muted text-xs mr-2">{r.code}</span>{r.name}</td>
                <td className="py-1 text-right font-mono text-secondary">{r.debit > 0 ? m(r.debit) : ""}</td>
                <td className="py-1 text-right font-mono text-secondary">{r.credit > 0 ? m(r.credit) : ""}</td>
              </tr>
              {open === r.account_id && (
                <tr>
                  <td colSpan={3} className="bg-surface/50 px-3 py-2">
                    {!lines ? (
                      <span className="text-xs text-muted">Loading…</span>
                    ) : lines.length === 0 ? (
                      <span className="text-xs text-muted">No posted transactions.</span>
                    ) : (
                      <table className="w-full text-xs">
                        <tbody>
                          {lines.map((l, i) => (
                            <tr key={i}>
                              <td className="py-0.5 text-muted font-mono">#{l.entry_no} · {l.entry_date}</td>
                              <td className="py-0.5 text-secondary">{l.description}</td>
                              <td className="py-0.5 text-right font-mono text-secondary">{l.debit > 0 ? m(l.debit) : ""}</td>
                              <td className="py-0.5 text-right font-mono text-secondary">{l.credit > 0 ? m(l.credit) : ""}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </td>
                </tr>
              )}
            </Fragment>
            );
          })}
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

/**
 * Cash Flow Statement (0164) — where the money actually came from and went.
 *
 * The unclassified row is rendered LOUDLY and on purpose. It would look tidier to fold it into
 * Operating, and the net change would tie out exactly the same — which is precisely why it must not be
 * done. A company funded by an owner's injection would then appear to be generating cash from trading,
 * and every balance check in this system would agree with the lie. So when money is unattributed, this
 * component says the statement is INCOMPLETE rather than presenting a clean set of sections over a gap.
 */
type CashFlow = {
  sections: { section: string; netAmount: number }[];
  netChange: number;
  hasUnclassified: boolean;
  unclassifiedAmount: number;
};

const CF_LABEL: Record<string, string> = {
  operating: "Operating — money from running the business",
  investing: "Investing — money spent on, or from, what the business runs on",
  financing: "Financing — money from owners and lenders",
  unclassified: "Unclassified — not yet attributable",
};

function CashFlowStatement({ cf }: { cf: CashFlow }) {
  return (
    <div className="glass-card p-6">
      <h2 className="text-sm font-semibold text-primary mb-1">Cash Flow Statement</h2>
      <p className="text-xs text-muted mb-4">
        Derived from actual movements through your bank accounts. Transfers between your own accounts are
        excluded — they move money without changing what the company has.
      </p>

      {cf.hasUnclassified && (
        <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-300">
          <strong>This statement is incomplete.</strong> {m(cf.unclassifiedAmount)} of cash movement is
          not yet attributable to a category, so the sections below cannot be read as a full description of
          how the company generates money. Classify the accounts involved (set their subtype) and this
          resolves itself.
        </div>
      )}

      <table className="w-full text-sm">
        <tbody>
          {cf.sections.map((sec) => (
            <tr
              key={sec.section}
              className={`border-b border-default/50 ${sec.section === "unclassified" && sec.netAmount !== 0 ? "text-amber-300" : ""}`}
            >
              <td className="py-2 pr-3 text-secondary">{CF_LABEL[sec.section] ?? sec.section}</td>
              <td className="py-2 text-right font-mono tabular-nums">{m(sec.netAmount)}</td>
            </tr>
          ))}
          <tr className="font-semibold">
            <td className="py-2 pr-3 text-primary">Net change in cash</td>
            <td className="py-2 text-right font-mono tabular-nums text-primary">{m(cf.netChange)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
