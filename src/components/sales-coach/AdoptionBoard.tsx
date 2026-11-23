"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

/**
 * Every tracked message on one board (2026-11-23; ledger F18.1): its share of calls since it started listening, its
 * goal, and whether it's on target. Selecting a message opens its Adoption view below.
 */
type Row = {
  id: string;
  name: string;
  calls: number;
  said: number;
  rate: number | null;
  goal: { direction: "at_least" | "at_most"; targetPct: number } | null;
  goalStatus: "met" | "not_met" | null;
};
const pct = (r: number | null) => (r === null ? "—" : `${Math.round(r * 100)}%`);

export function AdoptionBoard({ onOpen }: { onOpen: (trackerId: string) => void }) {
  const [days, setDays] = useState<30 | 90>(90);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    setRows(null);
    setFailed(false);
    fetch(`/api/coach/remote/trackers/adoption-board?days=${days}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: { rows: Row[] }) => live && setRows(j.rows))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [days]);

  if (rows && rows.length === 0) return null;
  return (
    <section aria-label="Message adoption" className="mb-4 rounded-xl border border-default bg-surface p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-primary">How often each message is said</h3>
        <div role="group" aria-label="Period" className="inline-flex overflow-hidden rounded-lg border border-default text-xs">
          {([30, 90] as const).map((d) => (
            <button key={d} type="button" aria-pressed={days === d} onClick={() => setDays(d)} className={`px-2 py-0.5 ${days === d ? "bg-brand/15 font-semibold text-primary" : "text-secondary"}`}>
              {d} days
            </button>
          ))}
        </div>
      </div>
      {failed ? (
        <p className="mt-2 text-xs text-muted">Couldn&apos;t build the board. Refresh to try again.</p>
      ) : !rows ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted"><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Counting…</p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[10px] uppercase tracking-wide text-muted">
              <tr>
                <th className="py-1 pr-2 font-medium">Message</th>
                <th className="py-1 pr-2 text-right font-medium">Share of calls</th>
                <th className="py-1 pr-2 text-right font-medium">Calls</th>
                <th className="py-1 pr-2 font-medium">Goal</th>
                <th className="py-1 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-default">
                  <td className="py-1.5 pr-2">
                    <button type="button" onClick={() => onOpen(r.id)} className="text-left font-medium text-primary hover:underline">
                      {r.name}
                    </button>
                  </td>
                  <td className="py-1.5 pr-2 text-right tabular-nums text-primary">{pct(r.rate)}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums text-secondary">{r.said} of {r.calls}</td>
                  <td className="py-1.5 pr-2 text-secondary">{r.goal ? `${r.goal.direction === "at_least" ? "≥" : "≤"} ${r.goal.targetPct}%` : "—"}</td>
                  <td className={`py-1.5 ${r.goalStatus === "met" ? "text-emerald-700 dark:text-emerald-300" : r.goalStatus === "not_met" ? "text-amber-700 dark:text-amber-300" : "text-muted"}`}>
                    {r.goalStatus === "met" ? "On target" : r.goalStatus === "not_met" ? "Not there yet" : r.goal ? "No calls yet" : "No goal"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-[10px] text-muted">Each message counts calls since it started listening, on each call&apos;s current transcript.</p>
        </div>
      )}
    </section>
  );
}
