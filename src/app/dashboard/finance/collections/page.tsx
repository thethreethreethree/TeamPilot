"use client";

import { useEffect, useState, useCallback } from "react";
import TopBar from "@/components/layout/TopBar";
import FinanceNav from "@/components/finance/FinanceNav";
import FinanceNotSetUp from "@/components/finance/FinanceNotSetUp";
import { formatMoney } from "@/lib/finance/format";
import { useToast } from "@/components/ui/toast";
import { PhoneCall, Mail, AlertTriangle } from "lucide-react";

/**
 * Collections — chasing what customers owe.
 *
 * THE COLUMN THAT MATTERS IS THE ONE MOST COLLECTIONS SCREENS DO NOT HAVE.
 * An overdue list tells you who is late. It does not tell you whether anyone has DONE anything about
 * it — and that omission is invisible precisely because the list looks complete. So this page shows two
 * numbers per invoice: the stage the escalation ladder says has been REACHED, and the highest stage a
 * human has actually ACTIONED. The gap between them is the collections backlog. An invoice 40 days
 * overdue with one gentle reminder sent is not "in collections"; it is being ignored politely, and the
 * only way that becomes visible is by showing both numbers side by side.
 *
 * RECORDING IS NOT SENDING, AND THE PAGE SAYS SO.
 * Pressing "Record chase" writes an append-only evidence row: this stage, this channel, this person,
 * this moment. It does NOT send an email. If the button implied it did, the record would be a claim
 * about the outside world the system never made good on — and that record is exactly what gets produced
 * in a dispute. So the button says "Record", the helper text says the system does not send, and the
 * honesty is preserved where it costs something.
 */

type Row = {
  invoice_id: string;
  invoice_number: string | null;
  customer_name: string | null;
  due_date: string;
  currency: string;
  outstanding: number;
  days_overdue: number;
  stage_due: number | null;
  stage_actioned: number | null;
  last_action_at: string | null;
};

export default function CollectionsPage() {
  const toast = useToast();
  const [ready, setReady] = useState<boolean | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const j = await fetch("/api/finance/ar/dunning").then((x) => x.json());
    // An empty collections list is a CLAIM: "nobody owes us anything late." If the read actually failed,
    // that claim is false and dangerously reassuring — so a failure is never rendered as an empty list.
    if (j.error) {
      setLoadError(j.error);
      setReady(true);
      return;
    }
    setLoadError(null);
    setRows(j.worklist ?? []);
    setReady(true);
  }, []);

  useEffect(() => {
    load().catch(() => setReady(false));
  }, [load]);

  async function record(inv: Row, channel: "email" | "phone") {
    setBusy(inv.invoice_id);
    try {
      // Record the stage the ladder says is due — not the next one up. We are recording what was done
      // about the position the invoice is actually in.
      const stage = inv.stage_due ?? (inv.stage_actioned ?? 0) + 1;
      const res = await fetch("/api/finance/ar/dunning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: inv.invoice_id, stage, channel }),
      });
      const j = await res.json();
      if (!res.ok) return toast.error(j.error ?? "Could not record the action.");
      toast.success("Chase recorded", "This is a permanent record — it cannot be edited or deleted.");
      load();
    } finally {
      setBusy(null);
    }
  }

  if (ready === false) return <FinanceNotSetUp feature="Collections" />;

  const totalOverdue = rows.reduce((s, r) => s + Number(r.outstanding || 0), 0);
  // The backlog: invoices where the ladder has moved on and nobody has followed it.
  const behind = rows.filter((r) => (r.stage_due ?? 0) > (r.stage_actioned ?? 0));
  const behindTotal = behind.reduce((s, r) => s + Number(r.outstanding || 0), 0);

  return (
    <>
      <TopBar title="Collections" />
      <FinanceNav />
      <main className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        {loadError && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">
            Could not load the collections worklist: {loadError}. This is <strong>not</strong> the same as
            nobody owing you anything.
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-neutral-200 p-4">
            <div className="text-xs uppercase tracking-wide text-neutral-500">Overdue</div>
            <div className="mt-1 text-3xl font-bold tabular-nums">{formatMoney(totalOverdue)}</div>
            <p className="mt-1 text-sm text-neutral-600">
              Across {rows.length} invoice{rows.length === 1 ? "" : "s"}, net of receipts and credit notes.
            </p>
          </div>

          {/* The number nobody else shows: money that is late AND unchased. */}
          <div
            className={`rounded-lg border p-4 ${
              behindTotal > 0 ? "border-amber-300 bg-amber-50/50" : "border-neutral-200"
            }`}
          >
            <div className="text-xs uppercase tracking-wide text-neutral-500">Behind on chasing</div>
            <div
              className={`mt-1 text-3xl font-bold tabular-nums ${
                behindTotal > 0 ? "text-amber-700" : "text-neutral-900"
              }`}
            >
              {formatMoney(behindTotal)}
            </div>
            <p className="mt-1 text-sm text-neutral-600">
              {behind.length === 0
                ? "Every overdue invoice has been chased to the stage it has reached."
                : `${behind.length} invoice${behind.length === 1 ? " has" : "s have"} reached a stage nobody has acted on.`}
            </p>
          </div>
        </section>

        <section className="overflow-x-auto rounded-lg border border-neutral-200">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-neutral-600">
              <tr>
                <th className="px-3 py-2">Invoice</th>
                <th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2 text-right">Outstanding</th>
                <th className="px-3 py-2 text-right">Days late</th>
                <th className="px-3 py-2">Stage due / done</th>
                <th className="px-3 py-2">Record a chase</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-neutral-500">
                    Nothing overdue.
                  </td>
                </tr>
              )}
              {rows.map((r) => {
                const isBehind = (r.stage_due ?? 0) > (r.stage_actioned ?? 0);
                return (
                  <tr key={r.invoice_id} className={`border-t border-neutral-100 ${isBehind ? "bg-amber-50/40" : ""}`}>
                    <td className="px-3 py-2 font-medium">{r.invoice_number ?? "—"}</td>
                    <td className="px-3 py-2">{r.customer_name ?? "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatMoney(r.outstanding)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.days_overdue}</td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1.5">
                        {isBehind && <AlertTriangle size={14} className="text-amber-700" />}
                        <span className={isBehind ? "font-medium text-amber-800" : "text-neutral-700"}>
                          {r.stage_due ?? 0} / {r.stage_actioned ?? 0}
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => record(r, "email")}
                          disabled={busy === r.invoice_id}
                          className="inline-flex items-center gap-1 rounded-md border border-neutral-300 px-2 py-1 text-xs disabled:opacity-50"
                        >
                          <Mail size={12} /> Email
                        </button>
                        <button
                          onClick={() => record(r, "phone")}
                          disabled={busy === r.invoice_id}
                          className="inline-flex items-center gap-1 rounded-md border border-neutral-300 px-2 py-1 text-xs disabled:opacity-50"
                        >
                          <PhoneCall size={12} /> Call
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        {/* The honesty that costs something: the button records, it does not send. */}
        <p className="text-xs text-neutral-500">
          Recording a chase writes a permanent, uneditable record of what was done, by whom, and when — the
          evidence you would rely on in a dispute. It does <strong>not</strong> send the email or place the
          call; you do that, then record it here. A system that logged &quot;notice sent&quot; without sending one
          would be producing false evidence.
        </p>
      </main>
    </>
  );
}
