import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Practice analytics (founder 2026-08-26, picker "Build practice analytics"; §A18 framing "closest to the original
 * feedback" — the manager sees each rep's per-skill GROWTH OVER TIME to coach from, never a ranked leaderboard).
 *
 * The practice engine (roleplay ?focus=) is stateless by design; this adds the ONE durable thing analytics needs — an
 * append-only `coach.practice_scored` event per scored attempt (§3.1 events-are-immutable; reuses the events store, no
 * new table). Reads derive a rep's own trend (their portal) and, for the manager, a per-rep growth direction.
 *
 * §A18: this is behaviour data surfaced to a leader, so the manager summary is a GROWTH DIRECTION (up/flat/down) +
 * activity, framed as coaching signal, and callers render it UNRANKED (alphabetical, like door metrics) — the label is
 * the structural defense, never a scoreboard. §3.4: an honest empty state when a rep hasn't practiced — never a fake 0.
 */

export const PRACTICE_EVENT_KIND = "coach.practice_scored";

// A meaningful move in either direction; smaller deltas read as "holding steady" (avoids trend noise on 1-2 points).
const TREND_DELTA = 6;

export type PracticeScoreEventRow = { payload: unknown; created_at: unknown };

type Attempt = { focus: string; applied: boolean; score: number; at: string };

export type FocusTrend = {
  focus: string;
  attempts: number;
  latest: number | null; // most-recent APPLIED score (0-100); null if the skill was drilled but never once executed
  first: number | null; // earliest APPLIED score in the window; null if never applied
  trend: "up" | "flat" | "down";
};

export type RepPracticeSummary = {
  totalAttempts: number;
  appliedAttempts: number; // attempts where the rep actually reached the skill
  byFocus: FocusTrend[]; // per skill, most-recently-practiced first
  latest: number | null; // most-recent applied score across all focuses (null = never applied)
  trend: "up" | "flat" | "down" | null; // overall direction (null = <2 applied points)
};

function coerceAttempt(row: PracticeScoreEventRow): Attempt | null {
  const p = (row?.payload ?? null) as Record<string, unknown> | null;
  if (!p || typeof p !== "object") return null;
  const focus = typeof p.focus === "string" ? p.focus.trim() : "";
  if (!focus) return null;
  const rawScore = typeof p.score === "number" ? p.score : Number(p.score);
  const score = Number.isFinite(rawScore) ? Math.max(0, Math.min(100, Math.round(rawScore))) : 0;
  const at = typeof row.created_at === "string" ? row.created_at : "";
  return { focus, applied: p.applied === true, score, at };
}

function trendOf(first: number, latest: number): "up" | "flat" | "down" {
  const d = latest - first;
  if (d >= TREND_DELTA) return "up";
  if (d <= -TREND_DELTA) return "down";
  return "flat";
}

/**
 * Aggregate a rep's practice events into a summary. `rows` may be in ANY order — we sort by created_at ascending here
 * so "first" and "latest" are the true chronological ends. Only APPLIED attempts carry a score (a skill the rep never
 * reached this attempt has no meaningful number — §3.4); trend is computed from applied scores only.
 */
export function aggregateRepPractice(rows: PracticeScoreEventRow[]): RepPracticeSummary {
  const attempts = rows
    .map(coerceAttempt)
    .filter((a): a is Attempt => a !== null)
    .sort((a, b) => a.at.localeCompare(b.at)); // oldest → newest

  const byFocusMap = new Map<string, Attempt[]>();
  for (const a of attempts) {
    const arr = byFocusMap.get(a.focus) ?? [];
    arr.push(a);
    byFocusMap.set(a.focus, arr);
  }

  const byFocus: FocusTrend[] = [...byFocusMap.entries()]
    .map(([focus, list]) => {
      const applied = list.filter((a) => a.applied);
      // null (not 0) when the rep drilled this skill but never once executed it — a fabricated 0 would read as a real
      // score (§3.4). The row renders "not applied yet" in that case.
      const first = applied.length ? applied[0]!.score : null;
      const latest = applied.length ? applied[applied.length - 1]!.score : null;
      return {
        focus,
        attempts: list.length,
        latest,
        first,
        trend:
          applied.length >= 2 ? trendOf(applied[0]!.score, applied[applied.length - 1]!.score) : ("flat" as const),
        lastAt: list[list.length - 1]?.at ?? "",
      };
    })
    // Most-recently-practiced skill first (a rep's current focus is the useful one to see on top).
    .sort((a, b) => b.lastAt.localeCompare(a.lastAt))
    .map(({ lastAt: _lastAt, ...f }) => f);

  const appliedAll = attempts.filter((a) => a.applied);
  const overallFirst = appliedAll[0]?.score ?? null;
  const overallLatest = appliedAll[appliedAll.length - 1]?.score ?? null;

  return {
    totalAttempts: attempts.length,
    appliedAttempts: appliedAll.length,
    byFocus,
    latest: overallLatest,
    trend:
      appliedAll.length >= 2 && overallFirst !== null && overallLatest !== null
        ? trendOf(overallFirst, overallLatest)
        : null,
  };
}

// The manager-facing per-rep summary (§A18: activity + growth DIRECTION, never a ranked score). Reuses the rep
// aggregate but exposes only what a leader should coach from.
export type ManagerPracticeSummary = {
  attempts: number;
  latest: number | null;
  trend: "up" | "flat" | "down" | null;
};

export function summarizePracticeForManager(rows: PracticeScoreEventRow[]): ManagerPracticeSummary {
  const s = aggregateRepPractice(rows);
  return { attempts: s.totalAttempts, latest: s.latest, trend: s.trend };
}

// Team-level practice rollup for the manager's meeting (founder's original "team-level data" ask). §A18-SAFEST: a pure
// AGGREGATE — how much the team is practicing and which way it's moving — with NO individual named or rankable. Built
// from the per-rep summaries the manager view already computes (no extra query). §3.4: honest zeros/nulls when nobody
// has practiced, never a fabricated average.
export type TeamPracticeSummary = {
  activeReps: number; // reps with >=1 practice attempt
  totalAttempts: number;
  avgLatest: number | null; // mean of reps' latest applied scores (reps who have one); null if none
  improving: number; // reps trending up
  slipping: number; // reps trending down
};

export function summarizeTeamPractice(perRep: ManagerPracticeSummary[]): TeamPracticeSummary {
  const active = perRep.filter((r) => r.attempts > 0);
  const withLatest = active.filter((r) => r.latest !== null) as (ManagerPracticeSummary & { latest: number })[];
  const avgLatest = withLatest.length
    ? Math.round(withLatest.reduce((sum, r) => sum + r.latest, 0) / withLatest.length)
    : null;
  return {
    activeReps: active.length,
    totalAttempts: active.reduce((sum, r) => sum + r.attempts, 0),
    avgLatest,
    improving: active.filter((r) => r.trend === "up").length,
    slipping: active.filter((r) => r.trend === "down").length,
  };
}

/**
 * Append a scored practice attempt as an immutable event. Best-effort (a missed write just means one attempt isn't in
 * the trend — never blocks the practice or the score the rep sees). Mirrors salesDissect's event insert.
 */
export async function recordPracticeScore(args: {
  companyId: string;
  repId: string;
  focus: string;
  applied: boolean;
  score: number;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("events").insert({
      company_id: args.companyId,
      actor: args.repId,
      kind: PRACTICE_EVENT_KIND,
      subject: `practice:${args.repId}`,
      payload: {
        focus: args.focus,
        applied: args.applied,
        score: Math.max(0, Math.min(100, Math.round(args.score))),
        coach_version: "practice-v1",
      },
    });
  } catch {
    /* best-effort — analytics is additive; a missed event just isn't in the trend */
  }
}
