"use client";

import { useEffect, useState, useCallback } from "react";
import TopBar from "@/components/layout/TopBar";
import FinanceNav from "@/components/finance/FinanceNav";
import FinanceNotSetUp from "@/components/finance/FinanceNotSetUp";
import { formatMoney } from "@/lib/finance/format";
import { useToast } from "@/components/ui/toast";
import { BarChart3, Play, Trash2, Download } from "lucide-react";
import { toCsv } from "@/lib/export/toCsv";

/**
 * Custom reports.
 *
 * The builder is a SENTENCE, not a query form: "Show me [net movement] by [account] for [this quarter]".
 *
 * That framing is not decoration — it is the honest surface for what the thing actually is. There is no
 * SQL behind it: a report is four choices from four closed lists, and the database rejects anything else.
 * A UI that looked like a query builder (drag a field, add a condition, write an expression) would be
 * promising a power the system deliberately does not grant, and every user who tried to express something
 * outside the vocabulary would experience it as the product being broken rather than as the product having
 * a boundary.
 *
 * So the surface states the boundary by its shape. What you can say, you can say completely. What you
 * cannot say, you can see that you cannot say.
 */

type Report = {
  id: string;
  name: string;
  measure: string;
  group_by: string;
  account_type: string | null;
  period: string;
};
type Row = { label: string; amount: number };

const MEASURE_LABEL: Record<string, string> = {
  net: "Net movement",
  debit: "Debits",
  credit: "Credits",
  closing_balance: "Closing balance",
};
const GROUP_LABEL: Record<string, string> = {
  account: "account",
  account_type: "account type",
  cost_center: "cost centre",
  project: "project",
  month: "month",
  vendor: "vendor",
  customer: "customer",
};
const PERIOD_LABEL: Record<string, string> = {
  this_month: "this month",
  last_month: "last month",
  this_quarter: "this quarter",
  last_quarter: "last quarter",
  this_year: "this year",
  last_year: "last year",
  all_time: "all time",
};

export default function ReportsPage() {
  const toast = useToast();
  const [ready, setReady] = useState<boolean | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [active, setActive] = useState<Report | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [measure, setMeasure] = useState("net");
  const [groupBy, setGroupBy] = useState("account");
  const [period, setPeriod] = useState("this_month");
  const [accountType, setAccountType] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/finance/reports");
    const j = await res.json();
    if (!res.ok || j.error) {
      setLoadError(j.error ?? "Could not load reports.");
      setReady(true);
      return;
    }
    setLoadError(null);
    setReports(j.reports ?? []);
    setReady(true);
  }, []);

  useEffect(() => {
    load().catch(() => setReady(false));
  }, [load]);

  async function run(r: Report) {
    setActive(r);
    setRows(null);
    const res = await fetch(`/api/finance/reports?run=${r.id}`);
    const j = await res.json();
    if (!res.ok) {
      setRows([]);
      return toast.error(j.error ?? "Could not run the report.");
    }
    setRows(j.rows ?? []);
  }

  async function save() {
    if (!name.trim()) return toast.error("Give the report a name so you can find it again.");
    const res = await fetch("/api/finance/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "save",
        name,
        measure,
        groupBy,
        period,
        accountType: accountType || undefined,
      }),
    });
    const j = await res.json();
    if (!res.ok) return toast.error(j.error ?? "Could not save the report.");
    setName("");
    toast.success("Report saved", "It stays up to date — the period is worked out each time you open it.");
    load();
  }

  async function remove(id: string) {
    const res = await fetch("/api/finance/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
    const j = await res.json();
    if (!res.ok) return toast.error(j.error ?? "Could not delete the report.");
    if (active?.id === id) {
      setActive(null);
      setRows(null);
    }
    load();
  }

  function exportCsv() {
    if (!rows || !active) return;
    const csv = toCsv(
      rows.map((r) => ({ Label: r.label, Amount: r.amount })),
      ["Label", "Amount"],
    );
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${active.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.csv`;
    a.click();
  }

  if (ready === false) return <FinanceNotSetUp feature="Reports" />;

  const total = (rows ?? []).reduce((s, r) => s + Number(r.amount || 0), 0);

  return (
    <>
      <TopBar title="Reports" />
      <FinanceNav />
      <main className="mx-auto max-w-5xl px-4 py-6 space-y-6">
        {loadError && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">
            Could not load reports: {loadError}.
          </div>
        )}

        {/* The builder reads as a sentence. It is not a query form, because there is no query. */}
        <section className="rounded-lg border border-neutral-200 p-4">
          <h2 className="flex items-center gap-2 text-sm font-medium">
            <BarChart3 size={16} /> Build a report
          </h2>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-neutral-600">Show me</span>
            <select value={measure} onChange={(e) => setMeasure(e.target.value)}
              className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm">
              {Object.entries(MEASURE_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <span className="text-neutral-600">by</span>
            <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)}
              className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm">
              {Object.entries(GROUP_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <span className="text-neutral-600">for</span>
            <select value={period} onChange={(e) => setPeriod(e.target.value)}
              className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm">
              {Object.entries(PERIOD_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <select value={accountType} onChange={(e) => setAccountType(e.target.value)}
              className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm">
              <option value="">all accounts</option>
              {["asset", "liability", "equity", "revenue", "expense"].map((t) => (
                <option key={t} value={t}>{t} accounts only</option>
              ))}
            </select>
          </div>
          <div className="mt-3 flex items-end gap-2">
            <label className="text-xs text-neutral-600">
              Save it as
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Monthly burn"
                className="mt-1 block w-48 rounded-md border border-neutral-300 px-2 py-1.5 text-sm" />
            </label>
            <button onClick={save} className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white">
              Save
            </button>
          </div>
          <p className="mt-2 text-xs text-neutral-500">
            The period is worked out each time you open the report, so a saved report never goes stale — a
            &ldquo;this quarter&rdquo; report shows <em>this</em> quarter, whenever you read it.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-1">
            <div className="text-xs uppercase tracking-wide text-neutral-500">Saved</div>
            <ul className="mt-2 space-y-1">
              {reports.length === 0 && (
                <li className="text-sm text-neutral-500">Nothing saved yet.</li>
              )}
              {reports.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
                  <button onClick={() => run(r)}
                    className={`flex items-center gap-1 rounded-md px-2 py-1 text-left hover:bg-neutral-50 ${
                      active?.id === r.id ? "font-medium" : ""
                    }`}>
                    <Play size={12} /> {r.name}
                  </button>
                  <button onClick={() => remove(r.id)} className="text-neutral-400 hover:text-red-600">
                    <Trash2 size={13} />
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="md:col-span-2">
            {active && (
              <div className="rounded-lg border border-neutral-200">
                <div className="flex items-center justify-between border-b border-neutral-100 px-3 py-2">
                  <div>
                    <div className="text-sm font-medium">{active.name}</div>
                    {/* Restate the definition in words. A number without its definition is a number
                        somebody will misread. */}
                    <div className="text-xs text-neutral-500">
                      {MEASURE_LABEL[active.measure]} by {GROUP_LABEL[active.group_by]},{" "}
                      {PERIOD_LABEL[active.period]}
                      {active.account_type ? ` · ${active.account_type} accounts` : ""}
                    </div>
                  </div>
                  <button onClick={exportCsv} disabled={!rows || rows.length === 0}
                    className="inline-flex items-center gap-1 rounded-md border border-neutral-300 px-2 py-1 text-xs disabled:opacity-40">
                    <Download size={12} /> CSV
                  </button>
                </div>

                {rows === null && <div className="px-3 py-8 text-center text-sm text-neutral-500">Running…</div>}
                {rows !== null && rows.length === 0 && (
                  <div className="px-3 py-8 text-center text-sm text-neutral-500">
                    No posted activity matches this report. Draft entries are never included.
                  </div>
                )}
                {rows !== null && rows.length > 0 && (
                  <table className="w-full text-sm">
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={i} className="border-t border-neutral-100">
                          <td className="px-3 py-1.5">{r.label}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{formatMoney(r.amount)}</td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-neutral-300 font-medium">
                        <td className="px-3 py-1.5">Total</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{formatMoney(total)}</td>
                      </tr>
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </section>
      </main>
    </>
  );
}
