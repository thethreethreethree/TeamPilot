"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3, Loader2 } from "lucide-react";
import type { Averages, RepStats } from "@/lib/coach/remote/teamStats";

/**
 * Remote Sales → Coaching → Team call stats (2026-11-25; ledger F10.9). For managers: the interaction stats every call
 * page shows, averaged per rep and for the team over 7, 30 or 90 days of phone/video calls. The team row first, then
 * reps alphabetically — the team's own norms, not a ranking. Renders nothing for a rep (the route is manager-only).
 */
type Resp = { days: number; reps: RepStats[]; team: Averages };
/** YYYY-MM-DD of `days` ago, the Search "from" filter for the same period. */
const sinceDay = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
const pct = (x: number | null) => (x == null ? "—" : `${Math.round(x * 100)}%`);
// Whole seconds first, then split — rounding the leftover seconds alone could show "1:60" (review 2026-11-25).
const mmss = (ms: number | null) => {
  if (ms == null) return "—";
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
const secs = (ms: number | null) => (ms == null ? "—" : `${(ms / 1000).toFixed(1)} s`);
const num = (x: number | null) => (x == null ? "—" : String(Math.round(x * 10) / 10));
const COLS: Array<[string, (a: Averages) => string]> = [
  ["Calls", (a) => String(a.calls)],
  ["Talk ratio", (a) => pct(a.talkRatioTime)],
  ["Longest monologue", (a) => mmss(a.longestRepMonologueMs)],
  ["Longest customer story", (a) => mmss(a.longestCustomerStoryMs)],
  ["Patience", (a) => secs(a.patienceMs)],
  ["Questions / hour", (a) => num(a.repQuestionsPerHour)],
  ["Interactivity /10", (a) => num(a.interactivity)],
];

export function TeamCallStats() {
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [data, setData] = useState<Resp | null>(null);
  const [state, setState] = useState<"loading" | "hidden" | "failed" | "ok">("loading");

  useEffect(() => {
    let live = true;
    setState("loading");
    fetch(`/api/coach/remote/team-stats?days=${days}`, { cache: "no-store" })
      .then(async (r) => {
        if (!live) return;
        if (r.status === 403) return setState("hidden");
        if (!r.ok) return setState("failed");
        setData((await r.json()) as Resp);
        setState("ok");
      })
      .catch(() => live && setState("failed"));
    return () => {
      live = false;
    };
  }, [days]);

  if (state === "hidden") return null;
  return (
    <section aria-label="Team call stats" className="rounded-xl border border-default bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-primary">
          <BarChart3 className="h-4 w-4 text-brand" aria-hidden /> Team call stats
        </h2>
        <div role="group" aria-label="Period" className="inline-flex overflow-hidden rounded-lg border border-default">
          {([7, 30, 90] as const).map((d) => (
            <button key={d} type="button" aria-pressed={days === d} onClick={() => setDays(d)} className={`px-2.5 py-1 text-xs ${days === d ? "bg-brand/15 font-semibold text-primary" : "text-secondary hover:text-primary"}`}>
              {d} days
            </button>
          ))}
        </div>
      </div>
      {state === "loading" ? (
        <p className="mt-3 flex items-center gap-2 text-xs text-muted">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Loading…
        </p>
      ) : state === "failed" || !data ? (
        <p className="mt-3 text-xs text-muted">Couldn&apos;t load team call stats. Refresh to try again.</p>
      ) : data.reps.length === 0 ? (
        <p className="mt-3 text-xs text-secondary">No measured phone or video calls in the last {data.days} days.</p>
      ) : (
        <>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[10px] uppercase tracking-wide text-muted">
                <tr>
                  <th className="py-1 pr-3 font-medium">Rep</th>
                  {COLS.map(([label]) => (
                    <th key={label} className="py-1 pr-3 text-right font-medium">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-default font-semibold">
                  <td className="py-1.5 pr-3 text-primary">Team</td>
                  {COLS.map(([label, f]) => (
                    <td key={label} className="py-1.5 pr-3 text-right tabular-nums text-primary">{f(data.team)}</td>
                  ))}
                </tr>
                {data.reps.map((r) => (
                  <tr key={r.repId} className="border-t border-default">
                    <td className="py-1.5 pr-3 text-primary">
                      {/* The rep's calls in the same period, on Search (F10.9: click a row for that person). */}
                      <Link href={`/dashboard/remote-sales/search?rep=${encodeURIComponent(r.repId)}&from=${sinceDay(data.days)}`} className="hover:underline">
                        {r.name}
                      </Link>
                    </td>
                    {COLS.map(([label, f]) => (
                      <td key={label} className="py-1.5 pr-3 text-right tabular-nums text-secondary">{f(r)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-muted">
            Averages over each call where the stat could be measured — a dash means none could. The team row averages every
            call. These are your team&apos;s own numbers, not a target or a ranking.
          </p>
        </>
      )}
    </section>
  );
}
