"use client";

import { useEffect, useState, useCallback } from "react";
import TopBar from "@/components/layout/TopBar";
import FinanceNav from "@/components/finance/FinanceNav";
import FinanceNotSetUp from "@/components/finance/FinanceNotSetUp";
import { formatMoney } from "@/lib/finance/format";
import { useToast } from "@/components/ui/toast";
import { HardHat, AlertTriangle, Download } from "lucide-react";
import { toCsv } from "@/lib/export/toCsv";

/**
 * Contractors / 1099.
 *
 * THE BLOCKERS COME FIRST, IN JANUARY OF THE YEAR THEY MATTER — NOT WHEN THE DEADLINE ARRIVES.
 *
 * The way this goes wrong in real companies is not a wrong total. It is a contractor who was paid $18,000
 * and whose taxpayer ID nobody ever collected. That fact is discoverable in March. It gets DISCOVERED in
 * late January, when the contractor has moved on, isn't answering, and the filing deadline is days away.
 *
 * So this page leads with what would stop the filing, not with the numbers. The numbers are the easy part;
 * they are already correct, computed from cash actually paid. The missing taxpayer ID is the thing that
 * ruins someone's week, and it is the thing this page is designed to surface early.
 *
 * The screen also shows contractors BELOW the reporting threshold, greyed but present. A worksheet that
 * hid them would give a filer no way to notice a contractor they paid is missing from the list.
 */

type Row = {
  vendor_id: string;
  vendor_name: string;
  tax_id: string | null;
  tax_classification: string | null;
  payment_count: number;
  total_paid: number;
  meets_threshold: boolean;
  missing_tax_id: boolean;
};
type Blocker = { vendor_id: string; vendor_name: string; total_paid: number; problem: string };
type Vendor = { id: string; name: string; is_1099: boolean; tax_id: string | null };

export default function ContractorsPage() {
  const toast = useToast();
  const [ready, setReady] = useState<boolean | null>(null);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [rows, setRows] = useState<Row[]>([]);
  const [blockers, setBlockers] = useState<Blocker[] | null>([]);
  const [blockersUnknown, setBlockersUnknown] = useState(false);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async (y?: number) => {
    const res = await fetch(`/api/finance/contractors${y ? `?year=${y}` : ""}`);
    const j = await res.json();
    if (!res.ok || j.error) {
      setLoadError(j.error ?? "Could not load.");
      setReady(true);
      return;
    }
    setLoadError(null);
    setYear(j.year);
    setRows(j.rows ?? []);
    setBlockers(j.blockers);
    setBlockersUnknown(Boolean(j.blockersUnknown));
    setVendors(j.vendors ?? []);
    setReady(true);
  }, []);

  useEffect(() => {
    load().catch(() => setReady(false));
  }, [load]);

  async function mark(vendorId: string, is1099: boolean) {
    const res = await fetch("/api/finance/contractors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vendorId, is1099 }),
    });
    const j = await res.json();
    if (!res.ok) return toast.error(j.error ?? "Could not update the vendor.");
    toast.success(is1099 ? "Marked as a 1099 contractor" : "No longer 1099-reportable");
    load(year);
  }

  function exportCsv() {
    // Routed through csvSafe — a vendor name is user-supplied text, and an export is where it reaches a
    // spreadsheet that will happily execute it.
    const csv = toCsv(
      rows.map((r) => ({
        Vendor: r.vendor_name,
        "Taxpayer ID": r.tax_id ?? "",
        Classification: r.tax_classification ?? "",
        Payments: r.payment_count,
        "Total paid": r.total_paid,
        Reportable: r.meets_threshold ? "Yes" : "Below threshold",
      })),
      ["Vendor", "Taxpayer ID", "Classification", "Payments", "Total paid", "Reportable"],
    );
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `1099-worksheet-${year}.csv`;
    a.click();
  }

  if (ready === false) return <FinanceNotSetUp feature="Contractors" />;

  const reportable = rows.filter((r) => r.meets_threshold);
  const total = reportable.reduce((s, r) => s + Number(r.total_paid || 0), 0);

  return (
    <>
      <TopBar title="Contractors (1099)" />
      <FinanceNav />
      <main className="mx-auto max-w-5xl px-4 py-6 space-y-6">
        {loadError && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">
            Could not load the 1099 worksheet: {loadError}.
          </div>
        )}

        {/* BLOCKERS FIRST. The number is the easy part; the missing taxpayer ID is what ruins the filing. */}
        {blockersUnknown && (
          <div className="rounded-lg border border-neutral-300 bg-neutral-50 p-3 text-sm text-neutral-700">
            We couldn&apos;t check for filing blockers. That is not the same as there being none.
          </div>
        )}
        {!blockersUnknown && blockers && blockers.length > 0 && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">
            <div className="flex items-start gap-2">
              <AlertTriangle size={18} className="mt-0.5 shrink-0" />
              <div>
                <div className="font-semibold">
                  {blockers.length} {blockers.length === 1 ? "contractor" : "contractors"} cannot be filed
                  for.
                </div>
                <ul className="mt-2 space-y-1">
                  {blockers.map((b) => (
                    <li key={b.vendor_id}>
                      <strong>{b.vendor_name}</strong> — paid {formatMoney(b.total_paid)}. {b.problem}.
                    </li>
                  ))}
                </ul>
                <p className="mt-2">
                  Collect this <strong>now</strong>, not in January. A contractor who has moved on is very
                  hard to reach, and the deadline will not move.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-lg border border-neutral-200 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-neutral-500">
                Reportable contractor payments · {year}
              </div>
              <div className="mt-1 text-3xl font-bold tabular-nums">{formatMoney(total)}</div>
              <p className="mt-1 text-sm text-neutral-600">
                Across {reportable.length} {reportable.length === 1 ? "contractor" : "contractors"} at or
                above the reporting threshold. This is <strong>cash actually paid</strong> during{" "}
                {year} — not what was billed. A bill dated December and paid in January belongs on next
                year&apos;s form.
              </p>
            </div>
            <div className="flex items-end gap-2">
              <label className="text-xs text-neutral-600">
                Tax year
                <input
                  type="number"
                  value={year}
                  onChange={(e) => load(Number(e.target.value))}
                  className="mt-1 block w-24 rounded-md border border-neutral-300 px-2 py-1.5 text-sm tabular-nums"
                />
              </label>
              <button
                onClick={exportCsv}
                disabled={rows.length === 0}
                className="inline-flex items-center gap-1 rounded-md border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-40"
              >
                <Download size={14} /> Export
              </button>
            </div>
          </div>
        </div>

        <section className="overflow-x-auto rounded-lg border border-neutral-200">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-neutral-600">
              <tr>
                <th className="px-3 py-2">Contractor</th>
                <th className="px-3 py-2">Taxpayer ID</th>
                <th className="px-3 py-2 text-right">Payments</th>
                <th className="px-3 py-2 text-right">Paid in {year}</th>
                <th className="px-3 py-2">Reportable</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center text-sm text-neutral-500">
                    <HardHat className="mx-auto mb-2 text-neutral-400" size={20} />
                    No contractor payments in {year}. Mark a vendor as a contractor below if one is missing.
                  </td>
                </tr>
              )}
              {/* Sub-threshold contractors stay VISIBLE (greyed). Hiding them would remove the only way a
                  filer could notice that someone they paid is missing from the list. */}
              {rows.map((r) => (
                <tr
                  key={r.vendor_id}
                  className={`border-t border-neutral-100 ${r.meets_threshold ? "" : "text-neutral-400"}`}
                >
                  <td className="px-3 py-2 font-medium">{r.vendor_name}</td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {r.missing_tax_id ? (
                      <span className="rounded bg-red-100 px-1.5 py-0.5 text-red-800">Missing</span>
                    ) : (
                      r.tax_id
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.payment_count}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatMoney(r.total_paid)}</td>
                  <td className="px-3 py-2">
                    {r.meets_threshold ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">
                        Files a 1099
                      </span>
                    ) : (
                      <span className="text-xs">Below threshold</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="rounded-lg border border-neutral-200 p-4">
          <h2 className="text-sm font-medium">Which vendors are contractors?</h2>
          <p className="mt-1 text-xs text-neutral-500">
            We don&apos;t guess this. Whether someone is 1099-reportable is a fact about your legal
            relationship with them — a company isn&apos;t reportable, a sole trader usually is. Mark them
            here, and the payments already in the ledger will be picked up automatically.
          </p>
          <ul className="mt-3 divide-y divide-neutral-100">
            {vendors.map((v) => (
              <li key={v.id} className="flex items-center justify-between py-2 text-sm">
                <span>
                  {v.name}
                  {v.is_1099 && !v.tax_id && (
                    <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-800">
                      No taxpayer ID
                    </span>
                  )}
                </span>
                <label className="flex items-center gap-1.5 text-xs text-neutral-600">
                  <input
                    type="checkbox"
                    checked={v.is_1099}
                    onChange={(e) => mark(v.id, e.target.checked)}
                  />
                  1099 contractor
                </label>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
