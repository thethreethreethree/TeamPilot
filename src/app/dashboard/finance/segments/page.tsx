"use client";

import { useEffect, useState, useCallback } from "react";
import TopBar from "@/components/layout/TopBar";
import FinanceNav from "@/components/finance/FinanceNav";
import FinanceNotSetUp from "@/components/finance/FinanceNotSetUp";
import { formatMoney } from "@/lib/finance/format";
import { Users, Moon } from "lucide-react";

/**
 * Net profitability by segment + idle resources.
 *
 * THE TWO COLUMNS SIT SIDE BY SIDE ON PURPOSE: contribution margin, and net after overhead.
 *
 * A contribution-margin list shows a roster of profitable customers, and a founder reading it cannot
 * understand why the bank balance keeps falling. The gap between the two columns is frequently the gap
 * between "our biggest customer" and "the customer we are subsidising" — and it is only visible when both
 * numbers are on the screen at the same time.
 *
 * The idle-resource section states a FACT and passes no judgment. R&D consumes money and produces nothing
 * for two years. So does a new market. So does the finance department. A page that labelled those "waste"
 * would be confidently wrong about the most important money a company spends — and a founder who trusted
 * it would cut exactly the wrong things.
 *
 * The value here is not a verdict. It is that nobody had noticed the £40,000 at all.
 */

type Seg = {
  customer_id?: string;
  cost_center_id?: string;
  customer_name?: string;
  code?: string;
  name?: string;
  revenue: number;
  direct_cost: number;
  allocated_overhead: number | null;
  net_profit: number | null;
};
type Idle = {
  kind: string;
  id: string;
  name: string | null;
  cost_consumed: number;
  revenue: number;
  last_activity: string | null;
};
type Depr = { asset_id: string; name: string; cost: number; accumulated: number };

export default function SegmentsPage() {
  const [ready, setReady] = useState<boolean | null>(null);
  const [customers, setCustomers] = useState<Seg[]>([]);
  const [costCenters, setCostCenters] = useState<Seg[]>([]);
  const [idle, setIdle] = useState<Idle[]>([]);
  const [depr, setDepr] = useState<Depr[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/finance/segments");
    const j = await res.json();
    if (!res.ok || j.error) {
      setLoadError(j.error ?? "Could not load.");
      setReady(true);
      return;
    }
    setLoadError(null);
    setCustomers(j.customers ?? []);
    setCostCenters(j.costCenters ?? []);
    setIdle(j.idle ?? []);
    setDepr(j.fullyDepreciated ?? []);
    setReady(true);
  }, []);

  useEffect(() => {
    load().catch(() => setReady(false));
  }, [load]);

  if (ready === false) return <FinanceNotSetUp feature="Segment profitability" />;

  // The customers who look profitable on contribution and are NOT, once they carry their overhead. This is
  // the finding the page exists to produce.
  const subsidised = customers.filter(
    (c) => c.net_profit != null && Number(c.net_profit) < 0 && Number(c.revenue) - Number(c.direct_cost) > 0,
  );

  const table = (rows: Seg[], label: string, keyOf: (r: Seg) => string, nameOf: (r: Seg) => string) => (
    <section className="overflow-x-auto rounded-lg border border-neutral-200">
      <div className="border-b border-neutral-100 px-3 py-2 text-sm font-medium">{label}</div>
      <table className="w-full text-sm">
        <thead className="bg-neutral-50 text-left text-neutral-600">
          <tr>
            <th className="px-3 py-2">Name</th>
            <th className="px-3 py-2 text-right">Revenue</th>
            <th className="px-3 py-2 text-right">After direct cost</th>
            <th className="px-3 py-2 text-right">Overhead</th>
            <th className="px-3 py-2 text-right">Net</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="px-3 py-6 text-center text-neutral-500">
                Nothing tagged yet.
              </td>
            </tr>
          )}
          {rows.map((r) => {
            const contribution = Number(r.revenue) - Number(r.direct_cost);
            const net = r.net_profit;
            return (
              <tr key={keyOf(r)} className="border-t border-neutral-100">
                <td className="px-3 py-1.5">{nameOf(r)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{formatMoney(r.revenue)}</td>
                {/* Both numbers, side by side. The gap between them is the point of the page. */}
                <td className="px-3 py-1.5 text-right tabular-nums text-neutral-600">
                  {formatMoney(contribution)}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums text-neutral-500">
                  {r.allocated_overhead == null ? "—" : formatMoney(r.allocated_overhead)}
                </td>
                <td
                  className={`px-3 py-1.5 text-right font-medium tabular-nums ${
                    net != null && Number(net) < 0 ? "text-red-700" : ""
                  }`}
                >
                  {net == null ? (
                    <span className="text-xs font-normal text-neutral-500">Not yet knowable</span>
                  ) : (
                    formatMoney(net)
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );

  return (
    <>
      <TopBar title="Segment profitability" />
      <FinanceNav />
      <main className="mx-auto max-w-5xl px-4 py-6 space-y-6">
        {loadError && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">
            Could not load segment profitability: {loadError}.
          </div>
        )}

        {/* THE FINDING. A customer profitable on contribution and unprofitable once loaded is invisible on
            every other page in this product — and is usually a large customer, because large customers
            consume the most overhead while negotiating the best prices. */}
        {subsidised.length > 0 && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            <div className="font-semibold">
              {subsidised.length}{" "}
              {subsidised.length === 1 ? "customer looks profitable but isn't" : "customers look profitable but aren't"}.
            </div>
            <ul className="mt-2 space-y-1">
              {subsidised.map((c) => (
                <li key={c.customer_id}>
                  <strong>{c.customer_name}</strong> — makes{" "}
                  {formatMoney(Number(c.revenue) - Number(c.direct_cost))} after the direct cost of serving
                  them, but carries {formatMoney(c.allocated_overhead ?? 0)} of overhead. Net:{" "}
                  <strong>{formatMoney(c.net_profit ?? 0)}</strong>. You are subsidising this relationship.
                </li>
              ))}
            </ul>
          </div>
        )}

        {table(customers, "By customer", (r) => r.customer_id!, (r) => r.customer_name ?? "—")}
        {table(costCenters, "By cost centre", (r) => r.cost_center_id!, (r) => `${r.code ?? ""} ${r.name ?? ""}`)}

        {/* States the fact. Passes no judgment. */}
        <section className="rounded-lg border border-neutral-200 p-4">
          <h2 className="flex items-center gap-2 text-sm font-medium">
            <Moon size={16} /> Spending that produced no revenue
          </h2>
          <p className="mt-1 text-xs text-neutral-500">
            We are <strong>not</strong> calling this waste. R&amp;D produces nothing for two years, and so
            does a new market, and so does your finance team. This is simply money that went somewhere and
            came back with no revenue attached — you know which of these is an investment and which is a
            project everyone forgot to cancel. We just make sure you have seen it.
          </p>

          <ul className="mt-3 divide-y divide-neutral-100">
            {idle.length === 0 && (
              <li className="py-3 text-sm text-neutral-500">
                Every project and cost centre with spending also produced revenue.
              </li>
            )}
            {idle.map((r) => (
              <li key={`${r.kind}-${r.id}`} className="flex items-center justify-between py-2 text-sm">
                <span>
                  {r.name ?? "Untitled"}{" "}
                  <span className="text-xs text-neutral-500">
                    ({r.kind === "project" ? "project" : "cost centre"}
                    {r.last_activity ? ` · last activity ${r.last_activity}` : ""})
                  </span>
                </span>
                <span className="tabular-nums">{formatMoney(r.cost_consumed)}</span>
              </li>
            ))}
          </ul>

          {depr.length > 0 && (
            <p className="mt-3 border-t border-neutral-100 pt-3 text-xs text-neutral-600">
              <Users size={12} className="mr-1 inline" />
              {depr.length} {depr.length === 1 ? "asset is" : "assets are"} fully depreciated and still on
              the books. That is not a problem — a paid-off machine still running is the best asset a company
              owns. But if one of them left the building years ago, the ledger doesn&apos;t know.
            </p>
          )}
        </section>
      </main>
    </>
  );
}
