"use client";

import { useEffect, useState, useCallback } from "react";
import TopBar from "@/components/layout/TopBar";
import FinanceNav from "@/components/finance/FinanceNav";
import FinanceNotSetUp from "@/components/finance/FinanceNotSetUp";
import { formatMoney } from "@/lib/finance/format";
import { ShieldAlert, CheckCircle2 } from "lucide-react";

/**
 * Spend anomalies.
 *
 * EVERY ROW IS A SENTENCE, NOT A SCORE.
 *
 * The conventional design is a risk score — 87/100, amber, sort descending. It looks rigorous and it is
 * almost useless: a score tells a controller HOW WORRIED TO BE, which is not a thing they can act on. A
 * reason tells them WHAT TO DO.
 *
 * So each row says, in words: "This bill is £4,950 — just under the £5,000 approval limit. Bills that land
 * within 5% of a limit are the signature of deliberate circumvention, not coincidence." A controller reads
 * that once and knows exactly what question to ask, of whom.
 *
 * And the empty state is deliberately quiet — it says we checked and found nothing, naming what was
 * checked. It does not congratulate. "No anomalies" is not an achievement; it is the normal condition, and
 * a page that celebrates it teaches people that its silence means safety.
 */

type Anomaly = {
  kind: string;
  occurred_on: string | null;
  amount: number;
  vendor_name: string | null;
  reason: string;
};

const KIND_LABEL: Record<string, string> = {
  threshold_gaming: "Just under an approval limit",
  split_bills: "A purchase split into several bills",
  new_vendor_fast_payment: "New vendor, paid immediately",
  sod_breach: "Entered and approved by the same person",
};

export default function AnomaliesPage() {
  const [ready, setReady] = useState<boolean | null>(null);
  const [rows, setRows] = useState<Anomaly[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/finance/anomalies");
    const j = await res.json();
    if (!res.ok || j.error) {
      setLoadError(j.error ?? "Could not check for anomalies.");
      setReady(true);
      return;
    }
    setLoadError(null);
    setRows(j.anomalies ?? []);
    setReady(true);
  }, []);

  useEffect(() => {
    load().catch(() => setReady(false));
  }, [load]);

  if (ready === false) return <FinanceNotSetUp feature="Spend anomalies" />;

  return (
    <>
      <TopBar title="Spend anomalies" />
      <FinanceNav />
      <main className="mx-auto max-w-4xl px-4 py-6 space-y-6">
        {/* A failed check must NEVER render as a clean list. On this page in particular, an empty green
            screen is read as "we looked and everything is fine" — which is the exact opposite of the truth
            when the query failed. */}
        {loadError && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">
            <strong>We could not check for anomalies.</strong> {loadError}. This is <em>not</em> the same as
            finding none — do not read this page as an all-clear.
          </div>
        )}

        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <ShieldAlert size={18} /> Things worth a human look
          </h2>
          <p className="mt-1 text-sm text-neutral-600">
            Not a risk score, and not a statistical model. Every item here is a{" "}
            <strong>definite fact</strong> about a real document, and each one explains itself. We
            deliberately do <strong>not</strong> flag big bills — big bills are usually just big, and a list
            that cried wolf would teach you to stop reading it.
          </p>
        </div>

        {!loadError && rows.length === 0 && (
          <div className="rounded-lg border border-neutral-200 p-6 text-center">
            <CheckCircle2 className="mx-auto mb-2 text-neutral-400" size={20} />
            <div className="text-sm font-medium">Nothing flagged.</div>
            {/* Name what was checked. "No anomalies" from a system that never says what it looks for is
                indistinguishable from a system that isn't looking. */}
            <p className="mx-auto mt-1 max-w-md text-xs text-neutral-500">
              We checked for bills sitting just under an approval limit, purchases split across several
              bills to stay beneath one, brand-new vendors paid within a week, and anything entered and
              approved by the same person.
            </p>
          </div>
        )}

        <ul className="space-y-3">
          {rows.map((a, i) => (
            <li key={i} className="rounded-lg border border-neutral-200 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm font-medium">{KIND_LABEL[a.kind] ?? a.kind}</span>
                <span className="tabular-nums text-sm font-semibold">{formatMoney(a.amount)}</span>
              </div>
              {/* THE REASON IS THE PRODUCT. Written by the database, in words a controller can act on. */}
              <p className="mt-1.5 text-sm text-neutral-700">{a.reason}</p>
              <div className="mt-1.5 text-xs text-neutral-500">
                {a.vendor_name ? `${a.vendor_name} · ` : ""}
                {a.occurred_on ?? "date not recorded"}
              </div>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
