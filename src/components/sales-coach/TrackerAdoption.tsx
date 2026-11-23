"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

/**
 * How often the team says a tracked message (2026-11-23, adoption.ts). Overall share of calls, week by week, and per
 * rep — alphabetical, never ranked. Counts only calls since the tracker started listening; calls not analyzed yet are
 * named, not counted as misses.
 */
type Res = {
  calls: number;
  said: number;
  rate: number | null;
  since: string;
  days: number;
  awaitingAnalysis: number;
  reps: Array<{ repId: string; name: string; calls: number; said: number; rate: number | null }>;
  weeks: Array<{ weekStart: string; calls: number; said: number; rate: number | null }>;
};
const pct = (r: number | null) => (r === null ? "—" : `${Math.round(r * 100)}%`);
const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

export function TrackerAdoption({ trackerId }: { trackerId: string }) {
  const [days, setDays] = useState<30 | 90>(90);
  const [res, setRes] = useState<Res | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    setRes(null);
    try {
      const r = await fetch(`/api/coach/remote/trackers/${trackerId}/adoption?days=${days}`, { cache: "no-store" });
      if (!r.ok) throw new Error(String(r.status));
      setRes((await r.json()) as Res);
    } catch {
      setFailed(true);
    }
  }, [trackerId, days]);
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mt-1 w-full rounded-lg border border-default bg-base p-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-primary">How often it&apos;s said</p>
        <div role="group" aria-label="Period" className="inline-flex overflow-hidden rounded-lg border border-default">
          {([30, 90] as const).map((d) => (
            <button key={d} type="button" aria-pressed={days === d} onClick={() => setDays(d)} className={`px-2 py-0.5 ${days === d ? "bg-brand/15 font-semibold text-primary" : "text-secondary"}`}>
              {d} days
            </button>
          ))}
        </div>
      </div>
      {failed ? (
        <p className="mt-2 text-muted">
          Couldn&apos;t work out adoption.{" "}
          <button type="button" onClick={() => void load()} className="underline">Try again</button>
        </p>
      ) : !res ? (
        <p className="mt-2 flex items-center gap-1.5 text-muted"><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Counting…</p>
      ) : res.calls === 0 ? (
        <p className="mt-2 text-secondary">No analyzed phone or video calls since {day(res.since)} yet.</p>
      ) : (
        <>
          <p className="mt-2 text-secondary">
            <span className="text-base font-semibold text-primary">{pct(res.rate)}</span> of calls since {day(res.since)} said it ({res.said} of {res.calls}).
            {res.awaitingAnalysis > 0 ? ` ${res.awaitingAnalysis} more ${res.awaitingAnalysis === 1 ? "call isn't" : "calls aren't"} analyzed yet and aren't counted.` : ""}
          </p>
          {res.weeks.length > 1 && (
            <div className="mt-2 flex items-end gap-1" aria-label="Share of calls by week">
              {res.weeks.map((w) => (
                <div key={w.weekStart} className="flex w-8 flex-col items-center" title={`Week of ${day(w.weekStart)}: ${w.said} of ${w.calls}`}>
                  <div className="flex h-12 w-4 items-end rounded bg-surface">
                    <div className="w-4 rounded bg-brand" style={{ height: `${Math.round((w.rate ?? 0) * 100)}%` }} />
                  </div>
                  <span className="mt-0.5 text-[10px] text-muted">{day(w.weekStart)}</span>
                </div>
              ))}
            </div>
          )}
          <table className="mt-2 w-full text-left">
            <thead className="text-[10px] uppercase tracking-wide text-muted">
              <tr>
                <th className="py-1 pr-2 font-medium">Rep</th>
                <th className="py-1 pr-2 text-right font-medium">Calls</th>
                <th className="py-1 pr-2 text-right font-medium">Said it</th>
                <th className="py-1 text-right font-medium">Share</th>
              </tr>
            </thead>
            <tbody>
              {res.reps.map((r) => (
                <tr key={r.repId} className="border-t border-default">
                  <td className="py-1 pr-2 text-primary">{r.name}</td>
                  <td className="py-1 pr-2 text-right tabular-nums text-secondary">{r.calls}</td>
                  <td className="py-1 pr-2 text-right tabular-nums text-secondary">{r.said}</td>
                  <td className="py-1 text-right tabular-nums text-primary">{pct(r.rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-[10px] text-muted">Counts calls since the tracker started listening, using each call&apos;s current transcript. Listed alphabetically.</p>
        </>
      )}
    </div>
  );
}
