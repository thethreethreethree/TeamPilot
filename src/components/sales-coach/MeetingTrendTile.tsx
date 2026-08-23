"use client";

import { useEffect, useState } from "react";

/**
 * MeetingTrendTile — the §3.6 make-learning-visible surface: the team's "did our meetings improve?" trend from
 * GET /api/coach/meeting-session/trend. Shows an honest direction (improving / flat / declining / insufficient)
 * and the two quality ratios that drive it (actions getting owners, meetings staying focused). "insufficient" is
 * shown plainly — no faked curve. Theme tokens (legible light + dark). Silent (renders nothing) if it can't load
 * — a dashboard tile must never break the page it sits on.
 */
type Metrics = {
  meetings: number;
  decisionsPerMeeting: number;
  ownedActionRatio: number | null;
  focusedRatio: number | null;
  balancedRatio: number | null;
  openItemsPerMeeting: number;
};
type Trend = {
  overall: Metrics;
  direction: "improving" | "flat" | "declining" | "insufficient";
};

const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);

const DIR: Record<Trend["direction"], { label: string; cls: string; dot: string }> = {
  improving: { label: "Improving", cls: "text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500" },
  declining: { label: "Slipping", cls: "text-amber-700 dark:text-amber-300", dot: "bg-amber-500" },
  flat: { label: "Holding steady", cls: "text-secondary", dot: "bg-secondary" },
  insufficient: { label: "Not enough data yet", cls: "text-muted", dot: "bg-muted" },
};

export function MeetingTrendTile() {
  const [trend, setTrend] = useState<Trend | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "hidden">("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/coach/meeting-session/trend");
        if (!res.ok) {
          if (!cancelled) setStatus("hidden");
          return;
        }
        const data = (await res.json()) as { trend: Trend };
        if (!cancelled) {
          setTrend(data.trend);
          setStatus("ready");
        }
      } catch {
        if (!cancelled) setStatus("hidden");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === "hidden") return null;
  if (status === "loading") {
    return <div className="rounded-xl border border-default bg-surface p-4 text-xs text-muted">Loading meeting trend…</div>;
  }
  if (!trend) return null;

  const d = DIR[trend.direction];
  const m = trend.overall;

  return (
    <div className="rounded-xl border border-default bg-surface p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Meeting trend</h2>
        <span className={`flex items-center gap-1.5 text-xs ${d.cls}`}>
          <span className={`h-2 w-2 rounded-full ${d.dot}`} aria-hidden />
          {d.label}
        </span>
      </div>

      {trend.direction === "insufficient" ? (
        <p className="mt-2 text-sm text-secondary">
          {m.meetings === 0
            ? "No coached meetings reviewed yet. Run a few and the trend will show whether they're getting more decisive and better-owned."
            : `${m.meetings} meeting${m.meetings === 1 ? "" : "s"} so far — a couple more and the trend appears.`}
        </p>
      ) : (
        <div className="mt-3 grid grid-cols-3 gap-3 text-center">
          <Stat label="Actions owned" value={pct(m.ownedActionRatio)} />
          <Stat label="Stayed focused" value={pct(m.focusedRatio)} />
          <Stat label="Balanced" value={pct(m.balancedRatio)} />
        </div>
      )}
      {trend.direction !== "insufficient" && (
        <p className="mt-2 text-xs text-muted">Across {m.meetings} reviewed meeting{m.meetings === 1 ? "" : "s"}.</p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-lg font-semibold text-primary tabular-nums">{value}</p>
      <p className="text-[11px] text-muted">{label}</p>
    </div>
  );
}
