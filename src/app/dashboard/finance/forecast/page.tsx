"use client";

import { useEffect, useState, useCallback } from "react";
import TopBar from "@/components/layout/TopBar";
import FinanceNav from "@/components/finance/FinanceNav";
import FinanceNotSetUp from "@/components/finance/FinanceNotSetUp";
import { formatMoney } from "@/lib/finance/format";
import { AlertTriangle, TrendingDown } from "lucide-react";

/**
 * Cash forecast.
 *
 * THE PAGE ANSWERS ONE QUESTION BEFORE IT ANSWERS ANY OTHER: when do I run out of money?
 *
 * That is the only question a founder brings to a cash forecast, and every other number on the screen is
 * supporting evidence for it. So the day the balance first goes negative is the largest thing here — and if
 * there is no such day, that fact is stated just as plainly.
 *
 * THE SECOND THING IT SAYS IS WHAT IT DOES NOT KNOW.
 *
 * This forecast contains no revenue that has not been invoiced. It will therefore look pessimistic to a
 * growing company, and a page that let the reader assume otherwise would be lying by omission. So the gap
 * is stated as a target: "you need £55,000 from business you haven't invoiced yet." That is a number a
 * founder can DO something about, which an averaged trend line never is.
 */

type Day = {
  day: string;
  inflow: number;
  outflow: number;
  closing_cash: number;
  is_negative: boolean;
};
type Gap = { cash_now: number; committed_in: number; committed_out: number; gap: number };
type Commitment = {
  direction: string;
  expected_on: string;
  amount: number;
  source_type: string;
  source_ref: string | null;
};

export default function ForecastPage() {
  const [ready, setReady] = useState<boolean | null>(null);
  const [days, setDays] = useState<Day[]>([]);
  const [gap, setGap] = useState<Gap | null>(null);
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/finance/forecast?days=90");
    const j = await res.json();
    if (!res.ok || j.error) {
      setLoadError(j.error ?? "Could not build the forecast.");
      setReady(true);
      return;
    }
    setLoadError(null);
    setDays(j.days ?? []);
    setGap(j.gap ?? null);
    setCommitments(j.commitments ?? []);
    setReady(true);
  }, []);

  useEffect(() => {
    load().catch(() => setReady(false));
  }, [load]);

  if (ready === false) return <FinanceNotSetUp feature="Cash forecast" />;

  const firstNegative = days.find((d) => d.is_negative) ?? null;
  const low = days.reduce<Day | null>(
    (m, d) => (m == null || Number(d.closing_cash) < Number(m.closing_cash) ? d : m),
    null,
  );
  const maxAbs = Math.max(1, ...days.map((d) => Math.abs(Number(d.closing_cash))));

  return (
    <>
      <TopBar title="Cash forecast" />
      <FinanceNav />
      <main className="mx-auto max-w-5xl px-4 py-6 space-y-6">
        {loadError && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">
            Could not build the forecast: {loadError}.
          </div>
        )}

        {/* THE ONE QUESTION, ANSWERED FIRST. */}
        {firstNegative ? (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle size={20} className="mt-0.5 shrink-0 text-red-700" />
              <div>
                <div className="text-xs uppercase tracking-wide text-red-700">
                  On current commitments, you run out of cash on
                </div>
                <div className="mt-1 text-3xl font-bold text-red-800">{firstNegative.day}</div>
                <p className="mt-1 text-sm text-red-800">
                  That is the first day your balance goes below zero, counting only money you have already
                  committed to pay and money already invoiced to you.
                </p>
              </div>
            </div>
          </div>
        ) : (
          days.length > 0 && (
            <div className="rounded-lg border border-neutral-200 p-4">
              <div className="text-xs uppercase tracking-wide text-neutral-500">
                Lowest point in the next 90 days
              </div>
              <div className="mt-1 text-3xl font-bold tabular-nums">
                {low ? formatMoney(low.closing_cash) : "—"}
              </div>
              <p className="mt-1 text-sm text-neutral-600">
                {low ? `on ${low.day}. ` : ""}You do not run out of cash on current commitments.
              </p>
            </div>
          )
        )}

        {/* WHAT THE FORECAST DOES NOT KNOW — stated, never padded with a trend. */}
        {gap && (
          <div
            className={`rounded-lg border p-4 text-sm ${
              Number(gap.gap) > 0
                ? "border-amber-300 bg-amber-50 text-amber-900"
                : "border-neutral-200 text-neutral-700"
            }`}
          >
            {Number(gap.gap) > 0 ? (
              <>
                <div className="font-semibold">
                  You need {formatMoney(gap.gap)} from business you haven&apos;t invoiced yet.
                </div>
                <p className="mt-1">
                  Over 90 days you have {formatMoney(gap.committed_in)} committed to come in and{" "}
                  {formatMoney(gap.committed_out)} committed to go out, against {formatMoney(gap.cash_now)}{" "}
                  in the bank. This forecast contains <strong>no revenue you have not invoiced</strong> — so
                  it looks pessimistic on purpose. We will not pad it with an assumed trend: a forecast that
                  quietly projects last year&apos;s customers is at its most confident exactly when it is
                  most wrong.
                </p>
              </>
            ) : (
              <p>
                Your committed inflow and cash on hand cover everything you have committed to pay over the
                next 90 days. This counts only invoiced revenue — anything you win from here is upside.
              </p>
            )}
          </div>
        )}

        {/* A plain bar chart. Every bar is a day; red is below zero. */}
        {days.length > 0 && (
          <section className="rounded-lg border border-neutral-200 p-4">
            <div className="mb-3 text-sm font-medium">Projected cash, next 90 days</div>
            <div className="flex h-40 items-end gap-px overflow-x-auto">
              {days.map((d) => {
                const v = Number(d.closing_cash);
                const h = Math.max(2, (Math.abs(v) / maxAbs) * 100);
                return (
                  <div
                    key={d.day}
                    title={`${d.day}: ${formatMoney(v)}`}
                    style={{ height: `${h}%` }}
                    className={`w-full min-w-[3px] rounded-sm ${
                      d.is_negative ? "bg-red-500" : "bg-emerald-500"
                    }`}
                  />
                );
              })}
            </div>
            <div className="mt-2 flex justify-between text-xs text-neutral-500">
              <span>{days[0]?.day}</span>
              <span>{days[days.length - 1]?.day}</span>
            </div>
          </section>
        )}

        {/* Every line traces to a real document. That traceability is the reason to trust the chart. */}
        <section className="overflow-x-auto rounded-lg border border-neutral-200">
          <div className="border-b border-neutral-100 px-3 py-2 text-sm font-medium">
            What the forecast is built from
          </div>
          <table className="w-full text-sm">
            <tbody>
              {commitments.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-sm text-neutral-500">
                    <TrendingDown className="mx-auto mb-2 text-neutral-400" size={20} />
                    No committed inflows or outflows. Nothing is invoiced and nothing is approved to pay, so
                    there is nothing to forecast from.
                  </td>
                </tr>
              )}
              {commitments.map((c, i) => (
                <tr key={i} className="border-t border-neutral-100">
                  <td className="px-3 py-1.5 tabular-nums text-neutral-600">{c.expected_on}</td>
                  <td className="px-3 py-1.5">{c.source_ref ?? c.source_type}</td>
                  <td className="px-3 py-1.5 text-xs text-neutral-500">{c.source_type}</td>
                  <td
                    className={`px-3 py-1.5 text-right tabular-nums ${
                      c.direction === "inflow" ? "text-emerald-700" : "text-neutral-800"
                    }`}
                  >
                    {c.direction === "inflow" ? "+" : "−"}
                    {formatMoney(c.amount)}
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
