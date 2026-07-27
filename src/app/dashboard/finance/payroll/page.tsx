"use client";

import { useEffect, useState, useCallback } from "react";
import TopBar from "@/components/layout/TopBar";
import FinanceNav from "@/components/finance/FinanceNav";
import FinanceNotSetUp from "@/components/finance/FinanceNotSetUp";
import { formatMoney, parseMoneyInput } from "@/lib/finance/format";
import { findOpenPeriodContaining } from "@/lib/finance/periodSelection";
import { useToast } from "@/components/ui/toast";
import { Users, Plus } from "lucide-react";

/**
 * Payroll (0167) — record what your provider computed, post it to the ledger.
 *
 * THE HEADLINE FIGURE IS TOTAL COST OF EMPLOYMENT, NOT GROSS.
 *
 * Gross is what the employee's contract says. It is not what the employee costs. Employer taxes and
 * employer-paid benefits sit ON TOP of gross, and the difference is routinely 15–30%. A payroll screen
 * that leads with gross quietly teaches the reader that salary IS cost — and every hiring decision,
 * project quote and margin calculation made on that belief is wrong in the direction that flatters the
 * business.
 *
 * So this page shows gross, employer cost, and TOTAL — with total as the number in the largest type. It
 * is the only figure on the page that answers "what did this month of employing people actually cost us?"
 *
 * The form also refuses to derive a missing figure. If gross ≠ net + withholdings, that is not a gap to
 * fill in — it is a signal that a column was misread on import, and filling it in would post a balanced,
 * wrong entry that nothing downstream would ever catch.
 */

type Run = {
  id: string;
  provider: string | null;
  period_start: string;
  period_end: string;
  pay_date: string;
  gross: number;
  withholdings: number;
  net_pay: number;
  employer_tax: number;
  benefits: number;
  headcount: number | null;
  status: string;
};
type Period = { id: string; status: string; start_date: string; end_date: string };

export default function PayrollPage() {
  const toast = useToast();
  const [ready, setReady] = useState<boolean | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [gross, setGross] = useState("");
  const [net, setNet] = useState("");
  const [wh, setWh] = useState("");
  const [etax, setEtax] = useState("");
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));

  const load = useCallback(async () => {
    const [r, p] = await Promise.all([
      fetch("/api/finance/payroll").then((x) => x.json()),
      fetch("/api/finance/periods").then((x) => x.json()),
    ]);
    if (r.error) {
      setLoadError(r.error);
      setReady(true);
      return;
    }
    setLoadError(null);
    setRuns(r.runs ?? []);
    setPeriods((p.periods ?? []).filter((x: Period) => x.status === "open"));
    setReady(true);
  }, []);

  useEffect(() => {
    load().catch(() => setReady(false));
  }, [load]);

  // The payroll entry is dated `payDate` (used as entry_date by fin_post_payroll_run) and GL views aggregate
  // by entry_date, so it must post to the period that CONTAINS payDate — not periods[0] (the most-recent open
  // period). See periodSelection.ts + the finance audit H1 note. Aligns the period to the already-coded
  // cash-basis entry_date; it does NOT decide accrual-vs-cash. Undefined when no open period contains payDate
  // → the existing "No open period" guard blocks the post rather than posting to a wrong period.
  const openPeriod = findOpenPeriodContaining(periods, payDate);

  // Live check, shown BEFORE submit. The mismatch is the useful signal, not an error to swallow.
  const g = parseMoneyInput(gross);
  const n = parseMoneyInput(net);
  const w = parseMoneyInput(wh);
  const allThree = [g, n, w].every((x) => Number.isFinite(x));
  const addsUp = allThree ? Math.abs(g - (n + w)) < 0.005 : true;

  async function record() {
    if (!allThree) return toast.error("Enter gross, net pay and withholdings.");
    if (!addsUp) {
      return toast.error(
        "These figures don't add up",
        "Gross must equal net pay + withholdings. A mismatch usually means a column was misread — we won't guess which one.",
      );
    }
    const res = await fetch("/api/finance/payroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "record",
        periodStart: payDate.slice(0, 8) + "01",
        periodEnd: payDate,
        payDate,
        gross: g,
        netPay: n,
        withholdings: w,
        employerTax: Number.isFinite(parseMoneyInput(etax)) ? parseMoneyInput(etax) : 0,
      }),
    });
    const j = await res.json();
    if (!res.ok) return toast.error(j.error ?? "Could not record the run.");
    setGross("");
    setNet("");
    setWh("");
    setEtax("");
    toast.success("Payroll run recorded", "Post it to put it in the ledger.");
    load();
  }

  async function post(id: string) {
    if (!openPeriod) return toast.error("No open period for this pay date", "Payroll posts to the ledger dated on the pay date, so that date must fall in an open period. Open or create the matching period in Finance → Periods (or adjust the pay date), then try again.");
    setBusy(id);
    try {
      const res = await fetch("/api/finance/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "post", runId: id, periodId: openPeriod.id }),
      });
      const j = await res.json();
      // The database's message names the three figures if they don't reconcile — exactly what an
      // accountant needs. Don't replace it with something generic.
      if (!res.ok) return toast.error(j.error ?? "Could not post payroll.");
      toast.success("Payroll posted", "Salary + employer cost expensed; net pay and taxes now show as owed.");
      load();
    } finally {
      setBusy(null);
    }
  }

  if (ready === false) return <FinanceNotSetUp feature="Payroll" />;

  const totalCost = runs.reduce(
    (s, r) => s + Number(r.gross || 0) + Number(r.employer_tax || 0) + Number(r.benefits || 0),
    0,
  );
  const totalGross = runs.reduce((s, r) => s + Number(r.gross || 0), 0);
  const employerCost = totalCost - totalGross;

  return (
    <>
      <TopBar title="Payroll" />
      <FinanceNav />
      <main className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        {loadError && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">
            Could not load payroll: {loadError}.
          </div>
        )}

        <div className="rounded-lg border border-neutral-200 p-4">
          <div className="text-xs uppercase tracking-wide text-neutral-500">
            What employing people actually cost
          </div>
          <div className="mt-1 text-3xl font-bold tabular-nums">{formatMoney(totalCost)}</div>
          <p className="mt-1 text-sm text-neutral-600">
            {formatMoney(totalGross)} in salaries plus {formatMoney(employerCost)} in employer taxes and
            benefits. <strong>Gross is not cost</strong> — the employer&apos;s share sits on top of it, and
            it&apos;s the total that belongs in a hiring decision or a project quote.
          </p>
        </div>

        <section className="rounded-lg border border-neutral-200 p-4">
          <div className="mb-2 text-sm font-medium">Record a run from your provider</div>
          <p className="mb-3 text-xs text-neutral-500">
            We don&apos;t calculate payroll — your provider does. Enter what they computed and we&apos;ll put
            it in the books correctly.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs text-neutral-600">
              Pay date
              <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)}
                className="mt-1 block rounded-md border border-neutral-300 px-2 py-1.5 text-sm" />
            </label>
            <label className="text-xs text-neutral-600">
              Gross
              <input value={gross} onChange={(e) => setGross(e.target.value)} inputMode="decimal" placeholder="10000.00"
                className="mt-1 block w-28 rounded-md border border-neutral-300 px-2 py-1.5 text-sm" />
            </label>
            <label className="text-xs text-neutral-600">
              Net pay
              <input value={net} onChange={(e) => setNet(e.target.value)} inputMode="decimal" placeholder="7500.00"
                className="mt-1 block w-28 rounded-md border border-neutral-300 px-2 py-1.5 text-sm" />
            </label>
            <label className="text-xs text-neutral-600">
              Withholdings
              <input value={wh} onChange={(e) => setWh(e.target.value)} inputMode="decimal" placeholder="2500.00"
                className="mt-1 block w-28 rounded-md border border-neutral-300 px-2 py-1.5 text-sm" />
            </label>
            <label className="text-xs text-neutral-600">
              Employer tax
              <input value={etax} onChange={(e) => setEtax(e.target.value)} inputMode="decimal" placeholder="1500.00"
                className="mt-1 block w-28 rounded-md border border-neutral-300 px-2 py-1.5 text-sm" />
            </label>
            <button onClick={record}
              className="inline-flex items-center gap-1 rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white">
              <Plus size={14} /> Record
            </button>
          </div>

          {/* The mismatch is surfaced BEFORE submit, and we say what it means rather than silently
              fixing it. A derived figure would post a balanced, wrong entry that nothing would catch. */}
          {allThree && !addsUp && (
            <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900">
              These don&apos;t add up: gross {formatMoney(g)} ≠ net {formatMoney(n)} + withholdings{" "}
              {formatMoney(w)} ({formatMoney(n + w)}). That usually means a column was misread on import.
              We won&apos;t guess which one — check the figures against your provider.
            </div>
          )}
        </section>

        <section className="overflow-x-auto rounded-lg border border-neutral-200">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-neutral-600">
              <tr>
                <th className="px-3 py-2">Pay date</th>
                <th className="px-3 py-2 text-right">Gross</th>
                <th className="px-3 py-2 text-right">Employer cost</th>
                <th className="px-3 py-2 text-right">Total cost</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {runs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-sm text-neutral-500">
                    <Users className="mx-auto mb-2 text-neutral-400" size={20} />
                    No payroll recorded yet.
                  </td>
                </tr>
              )}
              {runs.map((r) => {
                const emp = Number(r.employer_tax || 0) + Number(r.benefits || 0);
                return (
                  <tr key={r.id} className="border-t border-neutral-100">
                    <td className="px-3 py-2">{r.pay_date}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatMoney(r.gross)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-neutral-600">{formatMoney(emp)}</td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">
                      {formatMoney(Number(r.gross) + emp)}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          r.status === "posted"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-900"
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      {r.status === "draft" && (
                        <button
                          onClick={() => post(r.id)}
                          disabled={busy === r.id || !openPeriod}
                          className="rounded-md bg-neutral-900 px-2.5 py-1 text-xs text-white disabled:opacity-40"
                        >
                          {busy === r.id ? "…" : "Post to ledger"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      </main>
    </>
  );
}
