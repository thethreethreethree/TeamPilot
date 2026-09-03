"use client";

import { useCallback, useEffect, useState } from "react";
import { Trophy, Loader2, Info } from "lucide-react";
import { NotificationBell } from "@/components/sales-coach/NotificationBell";
import { MyProgress } from "@/components/sales-coach/MyProgress";
import { useIsSalesCoachManager } from "@/lib/hooks/useCurrentUserRole";
import { BAND_LABEL, bandForWire, type PointsBand } from "@/lib/coach/gamification/bands";
import { competitionRanks } from "@/lib/coach/gamification/competitionRank";

/**
 * Scoreboard — the team leaderboard (gamification Phase 5). Reads /api/coach/gamification/leaderboard, which
 * returns only per-agent AGGREGATES (rank + totals + deals) — never per-session score detail, which stays
 * rep-private (A18). Points-primary sort (D4); the caller's own row is highlighted. Presentation restraint per
 * the plan: rank, points, band, deals — no XP bars, levels, streak flames, or confetti.
 */

type Row = {
  agent_id: string;
  full_name: string | null;
  sessions: number;
  total_points: number;
  avg_points: number;
  best_points: number;
  deals: number;
};
type Resp = { period: "week" | "month" | "all"; rows: Row[]; meId: string; meRank: number | null };

type Period = "week" | "month" | "all";
const PERIODS: { key: Period; label: string }[] = [
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
  { key: "all", label: "All time" },
];

/**
 * The chip's COLOUR, keyed by band. The band itself, and its label, come from `bands.ts`.
 *
 * This used to be a local `band()` that re-derived the boundaries, with a comment describing itself as a mirror of
 * the server's. It was not a mirror: `bandFor` ROUNDS before classifying and this did not, so a rep whose average
 * was 89.6 read "Elite" everywhere else in the product and "Strong" here. `avg_points` is an average — fractions
 * are the ordinary case, not a corner one.
 *
 * A colour is presentation and genuinely belongs to the chip; a boundary is a rule and belongs in one place.
 * Keying by `PointsBand` also means a mistyped band name is now a compile error rather than a chip with no colour.
 */
const BAND_CLASS: Record<PointsBand, string> = {
  elite: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  strong: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  solid: "bg-white/10 text-secondary",
  developing: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  needs_coaching: "bg-red-500/15 text-red-700 dark:text-red-300",
};

/**
 * The chip for one row's average.
 *
 * `avg_points` is a `numeric` in the 0243 aggregate, and PostgREST serialises numeric as a STRING to preserve
 * precision — so the value arriving here may be "89.6" rather than 89.6. Coerced once, here, rather than relying on
 * the comparison operators to do it invisibly.
 */
function band(points: number | string | null | undefined): { label: string; cls: string } {
  const key = bandForWire(points);
  return { label: BAND_LABEL[key], cls: BAND_CLASS[key] };
}

const RANK_ACCENT = ["text-amber-500", "text-slate-400", "text-orange-600"]; // 1st gold, 2nd silver, 3rd bronze

export function Scoreboard() {
  const [period, setPeriod] = useState<Period>("all");
  const [data, setData] = useState<Resp | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const isManager = useIsSalesCoachManager();

  const load = useCallback(async () => {
    setState("loading");
    try {
      const res = await fetch(`/api/coach/gamification/leaderboard?period=${period}`);
      if (!res.ok) throw new Error(String(res.status));
      setData((await res.json()) as Resp);
      setState("ready");
    } catch {
      setState("error");
    }
  }, [period]);

  useEffect(() => {
    void load();
  }, [load]);

  // Computed once per render from the rows the aggregate already ordered. `data?.rows ?? []` and not `data.rows`
  // — this runs before the null guard below, and reading it directly threw on first paint.
  const ranks = competitionRanks(data?.rows ?? []);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-primary">
          <Trophy size={22} className="text-amber-500" /> Scoreboard
        </h1>
        <div className="flex items-center gap-2">
          {isManager && <NotificationBell />}
          <div className="flex rounded-lg border border-default p-0.5">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`rounded-md px-3 py-1 text-sm ${period === p.key ? "bg-surface text-primary" : "text-muted hover:text-secondary"}`}
            >
              {p.label}
            </button>
          ))}
          </div>
        </div>
      </div>

      <p className="flex items-start gap-1.5 text-xs text-muted">
        <Info size={13} className="mt-0.5 shrink-0" />
        Ranked by total points (how well conversations were run). Ties break by higher average, then fewer sessions.
        Your own per-session breakdown stays private — this shows totals only.
      </p>

      <MyProgress />


      {state === "loading" && (
        <div className="flex items-center gap-2 p-8 text-sm text-muted">
          <Loader2 className="animate-spin" size={16} /> Loading the board…
        </div>
      )}
      {state === "error" && (
        <div className="rounded-lg border border-default bg-surface p-6 text-sm text-secondary">
          Couldn&apos;t load the scoreboard. <button onClick={load} className="underline">Try again</button>.
        </div>
      )}

      {state === "ready" && data && data.rows.length === 0 && (
        <div className="rounded-lg border border-default bg-surface p-6 text-sm text-muted">
          No scored sessions in this period yet. Points appear here after a session gets its after-pitch review.
        </div>
      )}

      {state === "ready" && data && data.rows.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-default">
          <div className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 border-b border-default bg-surface px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted">
            <span className="text-center">#</span>
            <span>Rep</span>
            <span className="text-right">Points</span>
          </div>
          {data.rows.map((r, i) => {
            const isMe = r.agent_id === data.meId;
            const b = band(r.avg_points);
            // Competition ranking: equals share the higher place and the next distinct total takes the position it
            // actually occupies — 1, 2, 2, 4. The row INDEX is not the rank; using it told one of two reps on an
            // identical total that they came second, which is false and is the kind of thing a person remembers.
            const rank = ranks[i] ?? i + 1;
            return (
              <div
                key={r.agent_id}
                className={`grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 border-b border-default px-4 py-3 last:border-b-0 ${isMe ? "bg-primary/5" : ""}`}
              >
                <span className={`text-center text-lg font-bold ${RANK_ACCENT[rank - 1] ?? "text-muted"}`}>{rank}</span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium text-primary">{r.full_name ?? "Rep"}</span>
                    {isMe && <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-primary">You</span>}
                    <span className={`rounded-full px-2 py-0.5 text-[11px] ${b.cls}`}>{b.label}</span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
                    <span>{r.sessions} session{r.sessions === 1 ? "" : "s"}</span>
                    <span>avg {r.avg_points}</span>
                    <span>best {r.best_points}</span>
                    <span className={r.deals > 0 ? "text-emerald-600 dark:text-emerald-400" : ""}>{r.deals} deal{r.deals === 1 ? "" : "s"}</span>
                  </div>
                </div>
                <span className="text-right text-2xl font-bold tabular-nums text-primary">{r.total_points.toLocaleString()}</span>
              </div>
            );
          })}
        </div>
      )}

      {state === "ready" && data && data.meRank === null && data.rows.length > 0 && (
        <p className="text-xs text-muted">You don&apos;t have any scored sessions in this period yet — run a session to get on the board.</p>
      )}
    </div>
  );
}
