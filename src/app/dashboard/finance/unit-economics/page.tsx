"use client";

import { useEffect, useState, useCallback } from "react";
import TopBar from "@/components/layout/TopBar";
import FinanceNav from "@/components/finance/FinanceNav";
import FinanceNotSetUp from "@/components/finance/FinanceNotSetUp";
import { formatMoney } from "@/lib/finance/format";
import { AlertTriangle, Target } from "lucide-react";

/**
 * Unit economics & break-even.
 *
 * WHEN THERE IS NO BREAK-EVEN, THIS PAGE SAYS SO IN A SENTENCE — IT DOES NOT SHOW A DASH.
 *
 * Every spreadsheet computes break-even as fixed cost ÷ contribution ratio, unconditionally. When the
 * contribution margin is negative, that division still returns a large, finite, plausible number — and the
 * founder reads it as a target: "hit £480,000 and we're fine."
 *
 * The truth is the opposite. At a negative contribution margin, every additional sale makes the loss
 * bigger. There is no volume that saves the company. Growth is the accelerant, not the cure. And the
 * spreadsheet has just told them to grow.
 *
 * It is the most dangerous number in a financial system, because it is wrong in the direction of ACTION —
 * it doesn't merely mislead, it instructs. So here, an undefined break-even is rendered as the loudest
 * thing on the page, in words, with what to do about it.
 *
 * The fixed/variable assumption is NAMED, not buried in the formula. A model whose assumptions you cannot
 * see is a model you cannot argue with — and one you cannot argue with is one you shouldn't trust.
 */

type Month = {
  month: string;
  revenue: number;
  variable_cost: number;
  fixed_cost: number;
  contribution: number;
  contribution_ratio: number | null;
  break_even_revenue: number | null;
  undefined_because: string | null;
};
type Proj = {
  project_id: string;
  project_name: string | null;
  revenue: number;
  variable_cost: number;
  contribution: number;
  contribution_ratio: number | null;
  loses_money_per_sale: boolean;
};

export default function UnitEconomicsPage() {
  const [ready, setReady] = useState<boolean | null>(null);
  const [months, setMonths] = useState<Month[]>([]);
  const [projects, setProjects] = useState<Proj[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/finance/unit-economics");
    const j = await res.json();
    if (!res.ok || j.error) {
      setLoadError(j.error ?? "Could not load.");
      setReady(true);
      return;
    }
    setLoadError(null);
    setMonths(j.months ?? []);
    setProjects(j.projects ?? []);
    setReady(true);
  }, []);

  useEffect(() => {
    load().catch(() => setReady(false));
  }, [load]);

  if (ready === false) return <FinanceNotSetUp feature="Unit economics" />;

  const latest = months[0] ?? null;
  const bleeding = projects.filter((p) => p.loses_money_per_sale && Number(p.revenue) > 0);

  return (
    <>
      <TopBar title="Unit economics" />
      <FinanceNav />
      <main className="mx-auto max-w-5xl px-4 py-6 space-y-6">
        {loadError && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">
            Could not load unit economics: {loadError}.
          </div>
        )}

        {/* THE HEADLINE. Either a target, or the reason there isn't one — never a blank. */}
        {latest && (
          <div
            className={`rounded-lg border p-4 ${
              latest.break_even_revenue == null && latest.undefined_because
                ? "border-red-300 bg-red-50"
                : "border-neutral-200"
            }`}
          >
            {latest.break_even_revenue != null ? (
              <>
                <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-neutral-500">
                  <Target size={14} /> Revenue needed to break even ({latest.month})
                </div>
                <div className="mt-1 text-3xl font-bold tabular-nums">
                  {formatMoney(latest.break_even_revenue)}
                </div>
                <p className="mt-1 text-sm text-neutral-600">
                  You keep{" "}
                  <strong>
                    {latest.contribution_ratio != null
                      ? `${(Number(latest.contribution_ratio) * 100).toFixed(0)}p`
                      : "—"}
                  </strong>{" "}
                  of every pound of revenue after the cost of delivering it, and carry{" "}
                  {formatMoney(latest.fixed_cost)} of fixed cost a month. Revenue above this line is profit;
                  below it is loss.
                </p>
              </>
            ) : (
              <div className="flex items-start gap-2">
                <AlertTriangle size={20} className="mt-0.5 shrink-0 text-red-700" />
                <div>
                  <div className="text-base font-semibold text-red-800">
                    There is no break-even point.
                  </div>
                  {/* The database wrote this sentence. It is the whole output. */}
                  <p className="mt-1 text-sm text-red-800">{latest.undefined_because}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Projects that lose money on every sale. Invisible on a revenue-ranked list — where they often
            sit near the TOP, because a project sold below cost tends to sell very well. */}
        {bleeding.length > 0 && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            <div className="font-semibold">
              {bleeding.length} {bleeding.length === 1 ? "project loses" : "projects lose"} money on every
              sale.
            </div>
            <ul className="mt-2 space-y-1">
              {bleeding.map((p) => (
                <li key={p.project_id}>
                  <strong>{p.project_name ?? "Untitled"}</strong> — {formatMoney(p.revenue)} of revenue cost{" "}
                  {formatMoney(p.variable_cost)} to deliver. Selling more of this makes things worse, not
                  better.
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* The assumption, named. A model you can't argue with is one you shouldn't trust. */}
        <div className="rounded-lg border border-neutral-200 p-3 text-xs text-neutral-600">
          <strong>How we split the costs:</strong> accounts tagged <em>direct</em> are treated as{" "}
          <strong>variable</strong> (they scale with the work — materials, contractor time), and everything
          else as <strong>fixed</strong> (rent, salaries, software). That is a fair approximation for a
          services business and a poor one if, say, your delivery team is salaried — their cost is direct
          but it does <em>not</em> scale with one more sale. If that&apos;s you, the break-even above is
          optimistic. You can change an account&apos;s classification on the chart of accounts.
        </div>

        <section className="overflow-x-auto rounded-lg border border-neutral-200">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-neutral-600">
              <tr>
                <th className="px-3 py-2">Month</th>
                <th className="px-3 py-2 text-right">Revenue</th>
                <th className="px-3 py-2 text-right">Variable cost</th>
                <th className="px-3 py-2 text-right">Fixed cost</th>
                <th className="px-3 py-2 text-right">Break-even</th>
              </tr>
            </thead>
            <tbody>
              {months.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-sm text-neutral-500">
                    No posted revenue or costs yet.
                  </td>
                </tr>
              )}
              {months.map((m) => (
                <tr key={m.month} className="border-t border-neutral-100">
                  <td className="px-3 py-1.5 tabular-nums">{m.month}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{formatMoney(m.revenue)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-neutral-600">
                    {formatMoney(m.variable_cost)}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-neutral-600">
                    {formatMoney(m.fixed_cost)}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums font-medium">
                    {m.break_even_revenue != null ? (
                      formatMoney(m.break_even_revenue)
                    ) : (
                      // Never a dash. A dash reads as "no data"; this is a finding.
                      <span className="text-xs font-normal text-red-700">Unreachable at any volume</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>
    </>
  );
}
