"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Trophy, AlertTriangle } from "lucide-react";
import { PRIZE_ELIGIBLE_MIN_PITCHES } from "@/lib/coach/pitchScore/rubric";
import type { LeaderboardRow } from "@/lib/coach/pitchScore/leaderboard";

/**
 * The Pitch Score competition board (rubric p.6).
 *
 * TWO SURFACES IN ONE COMPONENT, because there are two callers and the route already decided which
 * is which. A manager sees the field; a rep sees only where they stand. The component consumes
 * `managerView` from the response and never infers it from whether `rows` happens to be present —
 * an absent array and a withheld array look identical, and guessing would mean a rendering bug
 * could expose the field.
 *
 * WHY A REP SEES NO NAMES. `docs/SalesCoach-KPI-System.md` calls it non-negotiable that
 * cross-agent ranking is manager-only and "never how results are framed to the agent", while the
 * rubric makes Pitch Score the competition board. The split is the most of both that can be true
 * at once, and it is recorded in LOGIC-AND-CONTRADICTIONS.md section L rather than settled here.
 *
 * EMPTY AND FAILED ARE DIFFERENT, and the distinction is the whole reason this component has three
 * states instead of two. "Nobody has scored yet" is something a manager acts on by concluding the
 * team did nothing — the worst possible response to a board that merely failed to load.
 */

const ENDPOINT = "/api/coach/sales-session/pitch-score/leaderboard";

type Period = "week" | "month" | "all";
const PERIODS: { key: Period; label: string }[] = [
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
  { key: "all", label: "All time" },
];

type WireRow = LeaderboardRow & { fullName: string | null };
type Resp = {
  period: Period;
  managerView: boolean;
  rows?: WireRow[];
  meId?: string;
  standing: LeaderboardRow | null;
  boardSize: number;
  skippedPreVerdict: number;
};

type State =
  | { kind: "loading" }
  | { kind: "failed" }
  | { kind: "ready"; data: Resp };

/** 1st, 2nd, 3rd — the ordinal a person would say out loud. */
function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  const rem10 = n % 10;
  return `${n}${rem10 === 1 ? "st" : rem10 === 2 ? "nd" : rem10 === 3 ? "rd" : "th"}`;
}

export function PitchLeaderboard() {
  const [period, setPeriod] = useState<Period>("week");
  const [state, setState] = useState<State>({ kind: "loading" });

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const res = await fetch(`${ENDPOINT}?period=${period}`);
      if (!res.ok) {
        setState({ kind: "failed" });
        return;
      }
      setState({ kind: "ready", data: (await res.json()) as Resp });
    } catch {
      setState({ kind: "failed" });
    }
  }, [period]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-primary">
          <Trophy className="w-4 h-4 text-brand" aria-hidden />
          Pitch Score board
        </h2>
        <div className="flex gap-1" role="group" aria-label="Period">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPeriod(p.key)}
              aria-pressed={period === p.key}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${
                period === p.key
                  ? "bg-ember-400 text-ink-950"
                  : "border border-default text-secondary hover:bg-base/60"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {state.kind === "loading" && (
        <p className="flex items-center gap-2 text-[12px] text-muted">
          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
          Loading the board…
        </p>
      )}

      {/*
        NOT "no scores yet". A failed read that renders as an empty board tells a team nobody
        pitched this week, and a manager acts on that by believing it.
      */}
      {state.kind === "failed" && (
        <div className="rounded-xl border border-default bg-surface p-4">
          <p className="flex items-center gap-2 text-[12px] font-medium text-amber-700 dark:text-amber-400">
            <AlertTriangle className="w-3.5 h-3.5" aria-hidden />
            The board could not be loaded.
          </p>
          <p className="mt-1 text-[11px] text-muted">
            Do not assume it is empty — this is a failure to read, not a team with no pitches.
          </p>
          <button
            type="button"
            onClick={load}
            className="mt-2 text-[11px] font-semibold text-brand hover:underline"
          >
            Try again
          </button>
        </div>
      )}

      {state.kind === "ready" && <Board data={state.data} />}
    </div>
  );
}

function Board({ data }: { data: Resp }) {
  const { managerView, rows, standing, boardSize, meId, skippedPreVerdict } = data;

  if (boardSize === 0) {
    return (
      <div className="rounded-xl border border-default bg-surface p-4">
        <p className="text-[12px] text-secondary">No pitches have counted in this period yet.</p>
        <p className="mt-1 text-[11px] text-muted">
          A pitch counts once it reaches {40} base points. Record one and it appears here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* The rep's own standing, shown to BOTH — a manager competes too. */}
      {standing ? (
        <div className="rounded-xl border border-brand/40 bg-surface p-4">
          <p className="text-[10px] uppercase tracking-widest text-muted">Where you stand</p>
          <p className="mt-1 text-2xl font-bold text-brand tabular-nums">
            {ordinal(standing.rank)}{" "}
            <span className="text-sm font-medium text-secondary">of {boardSize}</span>
          </p>
          <p className="mt-1 text-[12px] text-secondary tabular-nums">
            {standing.total_points} points from {standing.counted} counted{" "}
            {standing.counted === 1 ? "pitch" : "pitches"}
          </p>
          {!standing.prizeEligible && (
            /*
              Said plainly, and said to the person it affects. A rep who is ranked but not eligible
              would otherwise discover it when the prize goes to someone below them.
            */
            <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-400">
              {PRIZE_ELIGIBLE_MIN_PITCHES} counted pitches are needed to be in for the prize — you
              have {standing.counted}.
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-default bg-surface p-4">
          <p className="text-[12px] text-secondary">You are not on the board for this period.</p>
          {/* Not last. No standing at all, which is a different thing and must read that way. */}
          <p className="mt-1 text-[11px] text-muted">
            That is not last place — it means no pitch of yours has counted yet.
          </p>
        </div>
      )}

      {managerView && rows && (
        <ul className="space-y-1.5">
          {rows.map((r) => (
            <li
              key={r.repId}
              className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${
                r.repId === meId ? "border-brand/50 bg-brand/5" : "border-default bg-surface"
              }`}
            >
              <span className="w-7 shrink-0 text-[13px] font-semibold text-muted tabular-nums">
                {r.rank}
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-primary">
                {/* An id is not a name, and saying so beats printing a uuid at a manager. */}
                {r.fullName ?? "Name unavailable"}
              </span>
              {!r.prizeEligible && (
                <span className="shrink-0 rounded-full border border-default px-2 py-0.5 text-[10px] text-muted">
                  under {PRIZE_ELIGIBLE_MIN_PITCHES}
                </span>
              )}
              <span className="shrink-0 text-[13px] font-semibold text-primary tabular-nums">
                {r.total_points}
              </span>
              <span className="shrink-0 text-[11px] text-muted tabular-nums">
                {r.counted}/{r.pitchesTotal}
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="text-[11px] text-muted">
        Total points from counted pitches. A pitch counts once it reaches 40 base points; equal
        totals share a place.
      </p>

      {/*
        Pitches scored before the section verdict existed cannot be placed. Saying how many were
        left out beats folding them in at zero, which would read as a coaching problem.
      */}
      {skippedPreVerdict > 0 && (
        <p className="text-[11px] text-muted">
          {skippedPreVerdict} older {skippedPreVerdict === 1 ? "pitch is" : "pitches are"} not
          included — they were scored before the current breakdown existed.
        </p>
      )}
    </div>
  );
}
