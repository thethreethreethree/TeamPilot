"use client";

import { useEffect, useState, useCallback } from "react";
import TopBar from "@/components/layout/TopBar";
import FinanceNav from "@/components/finance/FinanceNav";
import FinanceNotSetUp from "@/components/finance/FinanceNotSetUp";
import { formatMoney } from "@/lib/finance/format";
import { Target, RotateCcw } from "lucide-react";

/**
 * Cost per outcome.
 *
 * THE TWO NUMBERS SIT SIDE BY SIDE, AND THE SECOND ONE IS THE POINT.
 *
 *   "It costs you £4,200 to fix something permanently."
 *   "You have spent £31,000 on fixes that came back."
 *
 * A cost-per-resolution metric can only ever produce the first — and to it the second is invisible, because
 * a reopened problem is simply another resolution to count. Which means the cheapest way to improve
 * cost-per-resolution is to close things faster: the number goes down, everyone is doing exactly what they
 * were asked, and the same problems keep returning.
 *
 * That is measuring agreement instead of consequence, and it is the failure this whole product exists to
 * prevent. So the denominator here is a resolution that HELD, and the money spent on ones that did not is
 * given equal billing.
 *
 * The page states, BEFORE the headline, how much of the company's spend is actually attributed to a
 * problem. If that share is 4%, the headline is a curiosity, not a finding — and the page says so, rather
 * than letting a precise-looking number imply a precision it does not have.
 */

type Summary = {
  outcomes_held: number;
  cost_of_held: number | null;
  cost_per_outcome: number | null;
  fixes_that_reopened: number;
  cost_of_reopened: number;
  partial_fixes: number;
  not_yet_known: number;
};
type Coverage = { tagged_cost: number; untagged_cost: number; tagged_share: number | null };
type Prob = { problem_id: string; problem_title: string; cost: number };

export default function CostPerOutcomePage() {
  const [ready, setReady] = useState<boolean | null>(null);
  const [s, setS] = useState<Summary | null>(null);
  const [cov, setCov] = useState<Coverage | null>(null);
  const [problems, setProblems] = useState<Prob[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/finance/cost-per-outcome");
    const j = await res.json();
    if (!res.ok || j.error) {
      setLoadError(j.error ?? "Could not load.");
      setReady(true);
      return;
    }
    setLoadError(null);
    setS(j.summary ?? null);
    setCov(j.coverage ?? null);
    setProblems(j.problems ?? []);
    setReady(true);
  }, []);

  useEffect(() => {
    load().catch(() => setReady(false));
  }, [load]);

  if (ready === false) return <FinanceNotSetUp feature="Cost per outcome" />;

  const share = cov?.tagged_share != null ? Number(cov.tagged_share) : null;
  const thin = share != null && share < 0.25;
  const reopened = Number(s?.cost_of_reopened ?? 0);

  return (
    <>
      <TopBar title="Cost per outcome" />
      <FinanceNav />
      <main className="mx-auto max-w-4xl px-4 py-6 space-y-6">
        {loadError && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">
            Could not load cost per outcome: {loadError}.
          </div>
        )}

        {/* How much the headline is worth — stated BEFORE the headline, not after it in small print. */}
        {cov && (
          <div
            className={`rounded-lg border p-3 text-xs ${
              thin ? "border-amber-300 bg-amber-50 text-amber-900" : "border-neutral-200 text-neutral-600"
            }`}
          >
            {share == null ? (
              "No spending recorded yet."
            ) : (
              <>
                <strong>{(share * 100).toFixed(0)}%</strong> of your spending is tagged to a specific problem
                ({formatMoney(cov.tagged_cost)} of{" "}
                {formatMoney(Number(cov.tagged_cost) + Number(cov.untagged_cost))}).{" "}
                {thin ? (
                  <>
                    That is thin — treat the figures below as a <strong>curiosity, not a finding</strong>. We
                    have <strong>not</strong> spread the untagged {formatMoney(cov.untagged_cost)} across
                    your problems to make the number look precise.
                  </>
                ) : (
                  <>
                    Untagged spending ({formatMoney(cov.untagged_cost)}) is <strong>excluded</strong> — never
                    spread across problems to make the maths come out.
                  </>
                )}
              </>
            )}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {/* What it actually costs to fix something permanently. */}
          <div className="rounded-lg border border-neutral-200 p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-neutral-500">
              <Target size={14} /> Cost per problem that stayed fixed
            </div>
            <div className="mt-1 text-3xl font-bold tabular-nums">
              {s?.cost_per_outcome != null ? (
                formatMoney(s.cost_per_outcome)
              ) : (
                // NULL, never £0. A zero would read as "it costs us nothing to fix things" — the most
                // flattering possible rendering of "we have never actually fixed one".
                <span className="text-base font-normal text-neutral-500">Nothing has held yet</span>
              )}
            </div>
            <p className="mt-1 text-sm text-neutral-600">
              {s?.outcomes_held ?? 0} {(s?.outcomes_held ?? 0) === 1 ? "problem has" : "problems have"} been
              fixed and stayed fixed. Only those count — a resolution that was recorded and then came back is
              not a cheaper outcome, it is money that bought nothing.
            </p>
          </div>

          {/* The number that changes behaviour. */}
          <div
            className={`rounded-lg border p-4 ${
              reopened > 0 ? "border-amber-300 bg-amber-50" : "border-neutral-200"
            }`}
          >
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-neutral-500">
              <RotateCcw size={14} /> Spent on fixes that came back
            </div>
            <div className="mt-1 text-3xl font-bold tabular-nums">{formatMoney(reopened)}</div>
            <p className="mt-1 text-sm text-neutral-700">
              Across {s?.fixes_that_reopened ?? 0}{" "}
              {(s?.fixes_that_reopened ?? 0) === 1 ? "problem that reopened" : "problems that reopened"}. A
              cost-per-<em>resolution</em> metric cannot see this number at all — to it, a reopened problem is
              just another resolution to count, so the cheapest way to look good is to close things faster.
            </p>
          </div>
        </div>

        {(s?.not_yet_known ?? 0) > 0 && (
          <div className="rounded-lg border border-neutral-200 p-3 text-xs text-neutral-600">
            {s?.not_yet_known} {(s?.not_yet_known ?? 0) === 1 ? "resolution has" : "resolutions have"} not
            been reviewed yet, so we do not know whether the money worked. They count as <strong>neither</strong>
            {" "}— an unreviewed resolution is not a success, and folding it into the good column is exactly how
            a system starts grading its own homework.
          </div>
        )}

        <section className="overflow-x-auto rounded-lg border border-neutral-200">
          <div className="border-b border-neutral-100 px-3 py-2 text-sm font-medium">
            What each problem cost
          </div>
          <table className="w-full text-sm">
            <tbody>
              {problems.length === 0 && (
                <tr>
                  <td className="px-3 py-8 text-center text-sm text-neutral-500">
                    No spending is tagged to a problem yet. Tag a bill line, an expense or a journal line with
                    the problem it was spent on, and it will appear here.
                  </td>
                </tr>
              )}
              {problems.map((p) => (
                <tr key={p.problem_id} className="border-t border-neutral-100">
                  <td className="px-3 py-1.5">{p.problem_title}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{formatMoney(p.cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>
    </>
  );
}
