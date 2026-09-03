"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * MyProgress — the signed-in rep's OWN points progress (gamification Phase 5 part 3). A summary (total / avg /
 * sessions), a simple points-per-session trend, and the recent sessions each linking to its after-pitch (the
 * private detail view). Reads /api/coach/gamification/my-points (the caller's own ledger, owner-RLS). Restrained
 * dataviz: one accent line, a faint zero-to-100 frame, an emphasized last point — no gradients/legends/gridlines.
 */

type Row = { session_id: string | null; points: number; band: string | null; created_at: string };
type Resp = { rows: Row[]; total: number; avg: number; sessions: number };

const BAND_LABEL: Record<string, string> = {
  elite: "Elite", strong: "Strong", solid: "Solid", developing: "Developing", needs_coaching: "Needs coaching",
};

/** A minimal points-per-session sparkline (0..100). One line, last point marked. Pure SVG, theme-token stroke. */
function Trend({ rows }: { rows: Row[] }) {
  if (rows.length < 2) return null;
  const W = 100, H = 32, pad = 2;
  const xs = (i: number) => pad + (i / (rows.length - 1)) * (W - 2 * pad);
  const ys = (p: number) => H - pad - (Math.max(0, Math.min(100, p)) / 100) * (H - 2 * pad);
  const d = rows.map((r, i) => `${i === 0 ? "M" : "L"}${xs(i).toFixed(1)},${ys(r.points).toFixed(1)}`).join(" ");
  const last = rows[rows.length - 1]!;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-12 w-full" role="img" aria-label="Your points per session over time">
      <line x1={pad} y1={ys(0)} x2={W - pad} y2={ys(0)} className="stroke-white/10" strokeWidth={0.5} />
      <line x1={pad} y1={ys(100)} x2={W - pad} y2={ys(100)} className="stroke-white/10" strokeWidth={0.5} />
      <path d={d} fill="none" className="stroke-primary" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={xs(rows.length - 1)} cy={ys(last.points)} r={1.8} className="fill-primary" />
    </svg>
  );
}

export function MyProgress() {
  const [data, setData] = useState<Resp | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/coach/gamification/my-points")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && d && setData(d as Resp))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!data || data.sessions === 0) return null; // no points yet → the board's own empty-state copy covers it

  const recent = [...data.rows].reverse().slice(0, 6);
  return (
    <div className="rounded-xl border border-default bg-surface p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-primary">Your progress</h2>
        <div className="flex gap-4 text-xs text-muted">
          <span><span className="font-semibold text-primary">{data.total.toLocaleString()}</span> pts</span>
          <span>avg <span className="font-semibold text-primary">{data.avg}</span></span>
          <span>{data.sessions} session{data.sessions === 1 ? "" : "s"}</span>
        </div>
      </div>
      <div className="mt-3">
        <Trend rows={data.rows} />
      </div>
      <div className="mt-3 flex flex-col gap-1">
        {recent.map((r, i) => {
          const inner = (
            <div className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-white/5">
              <span className="text-secondary">{new Date(r.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
              <span className="flex items-center gap-2">
                {r.band && <span className="text-xs text-muted">{BAND_LABEL[r.band] ?? r.band}</span>}
                <span className="font-semibold tabular-nums text-primary">{r.points}</span>
              </span>
            </div>
          );
          return r.session_id ? (
            <Link key={i} href={`/dashboard/sales-coach/${r.session_id}/after-pitch`} className="block">{inner}</Link>
          ) : (
            <div key={i}>{inner}</div>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-muted">Tap a session to see its full breakdown — that stays private to you.</p>
    </div>
  );
}
