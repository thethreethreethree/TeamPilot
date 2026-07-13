"use client";

import { useEffect, useState, useCallback } from "react";
import TopBar from "@/components/layout/TopBar";
import FinanceNav from "@/components/finance/FinanceNav";
import FinanceNotSetUp from "@/components/finance/FinanceNotSetUp";
import { formatMoney } from "@/lib/finance/format";
import { useToast } from "@/components/ui/toast";
import { Plus, Lock } from "lucide-react";

type TaxCode = { id: string; code: string; name: string; jurisdiction: string | null; rate_pct: number; kind: string; direction: string; is_active: boolean };
type TaxReport = { rows: { jurisdiction: string; output_tax: number; input_tax: number; net_tax: number }[]; total_output: number; total_input: number; total_net: number };
const money = formatMoney;

export default function TaxPage() {
  const toast = useToast();
  const [accountsCount, setAccountsCount] = useState<number | null>(null);
  const [codes, setCodes] = useState<TaxCode[]>([]);
  const [report, setReport] = useState<TaxReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const year = new Date().getFullYear();
  const [from, setFrom] = useState(`${year}-01-01`);
  const [to, setTo] = useState(`${year}-12-31`);

  const load = useCallback(async () => {
    try {
      const [ac, tc] = await Promise.all([
        fetch("/api/finance/accounts").then((r) => r.json()),
        fetch("/api/finance/tax-codes").then((r) => r.json()),
      ]);
      setAccountsCount((ac.accounts ?? []).length);
      setCodes(tc.taxCodes ?? []);
    } catch {
      toast.error("Couldn't load tax data", "Check your connection and refresh.");
    } finally {
      setLoaded(true);
    }
  }, [toast]);
  useEffect(() => { void load(); }, [load]);

  const loadReport = useCallback(async () => {
    const qs = new URLSearchParams();
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    const r = await fetch(`/api/finance/tax-report?${qs.toString()}`).then((x) => x.json());
    setReport(r.report ?? null);
  }, [from, to]);
  useEffect(() => { void loadReport(); }, [loadReport]);

  const [cCode, setCCode] = useState("");
  const [cName, setCName] = useState("");
  const [cJur, setCJur] = useState("");
  const [cRate, setCRate] = useState("");
  const [cDir, setCDir] = useState<"output" | "input">("output");
  const createCode = async () => {
    if (!cCode || !cName || !cRate) { toast.error("Fill code, name, and rate"); return; }
    setBusy(true);
    const res = await fetch("/api/finance/tax-codes", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: cCode, name: cName, jurisdiction: cJur || undefined, ratePct: Number(cRate), direction: cDir }),
    });
    const j = await res.json();
    setBusy(false);
    if (res.ok) { setCCode(""); setCName(""); setCJur(""); setCRate(""); toast.success("Tax code created"); void load(); }
    else toast.error("Couldn't create tax code", j?.error ?? "");
  };

  const [closeYear, setCloseYear] = useState(String(year));
  const doClose = async (action: "close" | "reopen") => {
    if (!confirm(action === "close" ? `Close fiscal year ${closeYear}? This posts closing entries to Retained Earnings and locks the year.` : `Reopen ${closeYear}? This reverses the closing entry and unlocks the year.`)) return;
    setBusy(true);
    const res = await fetch("/api/finance/close-year", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fiscalYear: Number(closeYear), action }),
    });
    const j = await res.json();
    setBusy(false);
    if (res.ok) toast.success(action === "close" ? `Year ${closeYear} closed` : `Year ${closeYear} reopened`, "Retained Earnings updated; periods locked/unlocked.");
    else toast.error(`Couldn't ${action} the year`, j?.error ?? "");
  };

  if (loaded && accountsCount === 0)
    return (
      <div className="min-h-screen bg-base">
        <TopBar title="Tax & Compliance" subtitle="Tax codes, liability report, year-end close" />
        <FinanceNav />
        <FinanceNotSetUp feature="Tax" />
      </div>
    );

  return (
    <div className="min-h-screen bg-base">
      <TopBar title="Tax & Compliance" subtitle="Tax codes, liability report, year-end close" />
      <FinanceNav />
      <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
        {/* Tax liability / filing report */}
        <section className="glass-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h2 className="text-sm font-semibold text-primary">Tax liability — output − input, by jurisdiction</h2>
            <span className="inline-flex items-center gap-1 text-xs text-muted">
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="bg-surface rounded px-2 py-1 text-primary border border-default" />
              <span>→</span>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="bg-surface rounded px-2 py-1 text-primary border border-default" />
            </span>
          </div>
          <p className="text-xs text-amber-500/90 mb-3">
            Output tax here is gross — it does <strong>not</strong> yet net out tax reversed by issued
            credit notes. If you&apos;ve credited invoices in this period, this figure overstates the tax
            owed (the ledger&apos;s Taxes Payable is correct; this report isn&apos;t netted yet). Netting
            is pending a decision on how to attribute a credit note&apos;s tax to a jurisdiction.
          </p>
          {!report || report.rows.length === 0 ? (
            <p className="text-xs text-muted">No tax in this period. Output tax comes from issued invoices, input tax from approved bills.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-default text-muted text-xs uppercase tracking-wider">
                  <th className="text-left pb-2 pr-3">Jurisdiction</th>
                  <th className="text-right pb-2 pr-3">Output (owed)</th>
                  <th className="text-right pb-2 pr-3">Input (reclaim)</th>
                  <th className="text-right pb-2">Net</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-default">
                {report.rows.map((r) => (
                  <tr key={r.jurisdiction}>
                    <td className="py-2 pr-3 text-secondary">{r.jurisdiction}</td>
                    <td className="py-2 pr-3 text-right font-mono text-secondary">{money(r.output_tax)}</td>
                    <td className="py-2 pr-3 text-right font-mono text-secondary">{money(r.input_tax)}</td>
                    <td className="py-2 text-right font-mono text-primary">{money(r.net_tax)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-default font-semibold">
                  <td className="py-2 pr-3 text-primary">Total net tax {report.total_net >= 0 ? "owed" : "refundable"}</td>
                  <td className="py-2 pr-3 text-right font-mono text-primary">{money(report.total_output)}</td>
                  <td className="py-2 pr-3 text-right font-mono text-primary">{money(report.total_input)}</td>
                  <td className="py-2 text-right font-mono text-primary">{money(report.total_net)}</td>
                </tr>
              </tbody>
            </table>
          )}
        </section>

        {/* Tax codes */}
        <section className="glass-card p-5">
          <h2 className="text-sm font-semibold text-primary mb-3">Tax codes</h2>
          <div className="flex flex-wrap gap-2 mb-3">
            {codes.map((c) => (
              <span key={c.id} className="text-xs px-2 py-1 rounded-full bg-surface-raised text-secondary">
                {c.code} · {c.rate_pct}% · {c.direction === "output" ? "sales" : "purchases"}{c.jurisdiction ? ` · ${c.jurisdiction}` : ""}
              </span>
            ))}
            {codes.length === 0 && <span className="text-xs text-muted">No tax codes yet.</span>}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
            <input value={cCode} onChange={(e) => setCCode(e.target.value)} placeholder="Code" className="bg-surface rounded-lg px-2 py-2 text-sm text-primary border border-default" />
            <input value={cName} onChange={(e) => setCName(e.target.value)} placeholder="Name (e.g. VAT 20%)" className="md:col-span-2 bg-surface rounded-lg px-2 py-2 text-sm text-primary border border-default" />
            <input value={cJur} onChange={(e) => setCJur(e.target.value)} placeholder="Jurisdiction" className="bg-surface rounded-lg px-2 py-2 text-sm text-primary border border-default" />
            <input value={cRate} onChange={(e) => setCRate(e.target.value)} inputMode="decimal" placeholder="Rate %" className="bg-surface rounded-lg px-2 py-2 text-sm text-primary border border-default" />
            <select value={cDir} onChange={(e) => setCDir(e.target.value as "output" | "input")} className="bg-surface rounded-lg px-2 py-2 text-sm text-primary border border-default">
              <option value="output">Sales (output)</option>
              <option value="input">Purchases (input)</option>
            </select>
          </div>
          <button onClick={createCode} disabled={busy} className="mt-3 inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-brand text-black text-sm font-medium disabled:opacity-60"><Plus className="w-4 h-4" /> Add tax code</button>
        </section>

        {/* Year-end close */}
        <section className="glass-card p-5">
          <h2 className="text-sm font-semibold text-primary mb-1">Year-end close</h2>
          <p className="text-[11px] text-muted mb-3">Closing a year posts the standard closing entries (zero revenue/expense into Retained Earnings) and locks its periods. Reversible via Reopen. Controller/CFO only.</p>
          <div className="flex items-center gap-2">
            <input value={closeYear} onChange={(e) => setCloseYear(e.target.value)} inputMode="numeric" className="w-24 bg-surface rounded-lg px-2 py-2 text-sm text-primary border border-default" />
            <button onClick={() => doClose("close")} disabled={busy} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-amber-500/15 text-amber-300 text-sm disabled:opacity-60"><Lock className="w-4 h-4" /> Close year</button>
            <button onClick={() => doClose("reopen")} disabled={busy} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-surface-raised text-secondary text-sm disabled:opacity-60">Reopen</button>
          </div>
        </section>
      </div>
    </div>
  );
}
