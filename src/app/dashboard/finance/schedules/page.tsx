"use client";

import { useEffect, useState, useCallback } from "react";
import TopBar from "@/components/layout/TopBar";
import FinanceNav from "@/components/finance/FinanceNav";
import FinanceNotSetUp from "@/components/finance/FinanceNotSetUp";
import { formatMoney } from "@/lib/finance/format";
import { useToast } from "@/components/ui/toast";
import { CalendarClock, AlertTriangle, X } from "lucide-react";

/**
 * Scheduled payments — what we have committed to pay, and when.
 *
 * THE SECOND NUMBER IS THE POINT.
 * A schedule is an INTENT formed at some point in the past: "pay 400 against this bill on the 30th."
 * Between then and now the bill may have been partly settled some other way. So this page never shows the
 * scheduled amount alone — it shows the bill's LIVE outstanding balance beside it. If the intent now
 * exceeds what is actually owed, the row is flagged BEFORE the clerk executes it.
 *
 * The database would refuse the over-payment anyway (fin_pay_bill re-checks cumulative payments under a
 * row lock). But a clerk who only discovers the conflict at the moment of failure has already been misled
 * by the screen. The guard is the safety net; this column is what stops them needing it. A control that is
 * only enforced at the point of failure is a worse control than one that is visible before the action.
 *
 * "Execute" does not move money — it records the payment and posts Dr AP / Cr Cash through the existing
 * pay path. The actual funds transfer happens at your bank. Saying otherwise on the button would be a
 * promise the system does not keep.
 */

type Row = {
  id: string;
  bill_id: string;
  scheduled_date: string;
  amount: number;
  status: string;
  bill_number: string | null;
  vendor_name: string | null;
  currency: string;
  outstanding: number;
  is_due: boolean;
};

export default function SchedulesPage() {
  const toast = useToast();
  const [ready, setReady] = useState<boolean | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const j = await fetch("/api/finance/ap/schedules").then((x) => x.json());
    // "Nothing scheduled" and "we could not read the schedule" are different facts, and an AP clerk can
    // only safely act on one of them.
    if (j.error) {
      setLoadError(j.error);
      setReady(true);
      return;
    }
    setLoadError(null);
    setRows(j.schedules ?? []);
    setReady(true);
  }, []);

  useEffect(() => {
    load().catch(() => setReady(false));
  }, [load]);

  async function act(id: string, action: "execute" | "cancel") {
    setBusy(id);
    try {
      const res = await fetch("/api/finance/ap/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, scheduleId: id }),
      });
      const j = await res.json();
      if (!res.ok) {
        // The RPC's message is the useful one — it names the actual remaining balance when an execution
        // would over-pay. Surfacing our own generic wording instead would throw away the only fact the
        // clerk needs.
        return toast.error(j.error ?? "Could not complete that.");
      }
      if (action === "execute") {
        toast.success("Payment recorded", "Posted to the ledger (Dr AP / Cr Cash). Move the funds at your bank.");
      } else {
        toast.success("Schedule cancelled");
      }
      load();
    } finally {
      setBusy(null);
    }
  }

  if (ready === false) return <FinanceNotSetUp feature="Scheduled payments" />;

  const due = rows.filter((r) => r.is_due);
  const dueTotal = due.reduce((s, r) => s + Number(r.amount || 0), 0);
  // The rows where the intent now exceeds what is actually still owed on the bill.
  const conflicted = rows.filter((r) => Number(r.amount) > Number(r.outstanding));

  return (
    <>
      <TopBar title="Scheduled payments" />
      <FinanceNav />
      <main className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        {loadError && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">
            Could not load scheduled payments: {loadError}. This is <strong>not</strong> the same as having
            none scheduled.
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-neutral-200 p-4">
            <div className="text-xs uppercase tracking-wide text-neutral-500">Due now</div>
            <div className="mt-1 text-3xl font-bold tabular-nums">{formatMoney(dueTotal)}</div>
            <p className="mt-1 text-sm text-neutral-600">
              {due.length} payment{due.length === 1 ? "" : "s"} scheduled for today or earlier.
            </p>
          </div>

          {conflicted.length > 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50/50 p-4">
              <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-amber-800">
                <AlertTriangle size={14} /> Needs attention
              </div>
              <div className="mt-1 text-3xl font-bold tabular-nums text-amber-700">{conflicted.length}</div>
              <p className="mt-1 text-sm text-neutral-700">
                {conflicted.length === 1 ? "A schedule is" : "Schedules are"} for more than the bill still
                owes — it was probably settled another way. Executing would be refused; cancel or reduce it.
              </p>
            </div>
          )}
        </section>

        <section className="overflow-x-auto rounded-lg border border-neutral-200">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-neutral-600">
              <tr>
                <th className="px-3 py-2">Bill</th>
                <th className="px-3 py-2">Vendor</th>
                <th className="px-3 py-2">Scheduled</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2 text-right">Bill still owes</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-neutral-500">
                    Nothing scheduled. Schedule a payment from an approved bill.
                  </td>
                </tr>
              )}
              {rows.map((r) => {
                const over = Number(r.amount) > Number(r.outstanding);
                return (
                  <tr
                    key={r.id}
                    className={`border-t border-neutral-100 ${over ? "bg-amber-50/40" : r.is_due ? "bg-neutral-50/60" : ""}`}
                  >
                    <td className="px-3 py-2 font-medium">{r.bill_number ?? "—"}</td>
                    <td className="px-3 py-2">{r.vendor_name ?? "—"}</td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1.5 tabular-nums">
                        {r.is_due && <CalendarClock size={14} className="text-neutral-500" />}
                        {r.scheduled_date}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatMoney(r.amount)}</td>
                    <td
                      className={`px-3 py-2 text-right tabular-nums ${over ? "font-medium text-amber-800" : "text-neutral-600"}`}
                    >
                      {formatMoney(r.outstanding)}
                      {over && <AlertTriangle size={12} className="ml-1 inline text-amber-700" />}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => act(r.id, "execute")}
                          disabled={busy === r.id}
                          className="rounded-md bg-neutral-900 px-2.5 py-1 text-xs text-white disabled:opacity-50"
                        >
                          {busy === r.id ? "Working…" : "Execute"}
                        </button>
                        <button
                          onClick={() => act(r.id, "cancel")}
                          disabled={busy === r.id}
                          className="inline-flex items-center gap-1 rounded-md border border-neutral-300 px-2 py-1 text-xs disabled:opacity-50"
                        >
                          <X size={12} /> Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <p className="text-xs text-neutral-500">
          Executing records the payment and posts it to the ledger (Dr Accounts Payable / Cr Cash). It does{" "}
          <strong>not</strong> move money — you make the transfer at your bank, and this is the book entry
          for it.
        </p>
      </main>
    </>
  );
}
