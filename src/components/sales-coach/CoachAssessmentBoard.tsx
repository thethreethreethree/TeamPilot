"use client";

import { useCallback, useEffect, useState } from "react";
// The LETTER GRADE, not the raw ELO number. The board's column is headed COACHING GRADE and
// shows "B+ Solid"; `AgentEloBadge` renders the number and gauge instead. Same data, same
// endpoint — the old page chose between them on the user's Expert/Standard mode, and the board
// draws the Standard one, so the rebuild follows the board.
import { AgentGradeBadge } from "@/components/sales-coach/AgentGradeBadge";
import { RepSkillGrades } from "@/components/sales-coach/RepSkillGrades";
import RecordingsTab from "@/components/sales-coach/RecordingsTab";
import { ReviewFlagQueue } from "@/components/sales-coach/ReviewFlagQueue";
import type { ReviewFlag } from "@/lib/coach/assessment/reviewFlags";
import type { RepRow, SectionBar, PriorityCard } from "@/lib/coach/assessment/teamAssessment";
import type { RepDetail } from "@/lib/coach/assessment/readTeamAssessment";
// The PITCH SCORE band, which wraps the gamification authority and returns its label. Its own
// docblock records why a local four-band version was wrong: a 95-point pitch read "Elite" in the
// Arena gauge and "Strong" in the card beneath it, on one page. Scores run 0-130 and the band
// scale is 0-100; `bandFor` clamps, so 106.5 bands as Elite, which is the right answer.
import { bandFor } from "@/lib/coach/pitchScore/storePitchScore";

/**
 * Coach Assessment — the manager dashboard, guide Step 3.
 *
 * Built from `Coach Assessment  manager dashboard (web).pdf` and the higher-resolution capture the
 * founder sent on 2026-09-22, both opened and described in
 * `docs/SYSTEM UPDATES AND REVISION 09-22-2026/EVIDENCE.md`.
 *
 * THIS REPLACES THE OLD PAGE, and the founder's ruling set what happens to what was there:
 * *"rebuild the page, keep ELO inside rep detail."* The Sales ELO rating, the coaching notes
 * (Doing well / Coaching focus) and the skill scores are not deleted — they stop being the page's
 * headline and become attributes of one rep, which is exactly where the board draws them. The
 * guide is explicit that they stay: *"The existing coaching grade and notes stay unranked; only
 * the Pitch Score and KPIs are compared across reps."*
 *
 * TWO READS, DELIBERATELY. The new dashboard route supplies everything Pitch Score; the existing
 * `/coach-assessment` route supplies the coaching notes and strategy tags it has always supplied.
 * Merging them server-side would have meant one route owning two systems, and
 * `TWO-SCORING-SYSTEMS.md` is a catalogue of what happens when those two get confused for each
 * other. They are joined here, on rep id, at the surface — which is the only place a manager
 * actually reads them together.
 */

type Wire = {
  period: "day" | "week" | "month" | "all";
  team: {
    aggregate: {
      avgPitchScore: number;
      avgBase: number;
      avgBonus: number;
      avgViolations: number;
      counted: number;
      pitchesTotal: number;
      notCountedReasons: Record<string, number>;
    };
    kpis: {
      doorsKnocked: number;
      presentations: number;
      sold: number;
      doorToPresentationRate: number | null;
      closeRate: number | null;
    };
    totalPoints: number;
    counted: number;
    pitchesTotal: number;
    prizeEligible: number;
    repCount: number;
    minPitchesForPrize: number;
  };
  bars: SectionBar[];
  priorities: PriorityCard[];
  reps: RepRow[];
  detail: Record<string, RepDetail>;
  capped: boolean;
  unattributed: number;
  briefGeneratedAt: string | null;
  /** Null = the read failed. [] = every flag has been dealt with. Never conflate them. */
  reviewFlags: ReviewFlag[] | null;
};

/** The shape the EXISTING coach-assessment route has always returned. Unchanged. */
type Coaching = {
  agentId: string;
  agentName: string;
  strengths: string[];
  growthAreas: string[];
  strategies: string[];
  dissectCount: number;
};

type State =
  | { kind: "loading" }
  | { kind: "failed" }
  | { kind: "forbidden" }
  | { kind: "ready"; wire: Wire };

const PERIODS = [
  ["day", "Day"],
  ["week", "Week"],
  ["month", "Month"],
  ["all", "All time"],
] as const;

const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);
const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);

function Card({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: string;
}) {
  return (
    <div className="rounded-lg border border-default bg-surface px-4 py-3">
      <p className="text-[10px] uppercase tracking-widest text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${tone ?? "text-primary"}`}>{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-muted leading-snug">{sub}</p>}
    </div>
  );
}

export function CoachAssessmentBoard() {
  const [period, setPeriod] = useState<Wire["period"]>("week");
  const [state, setState] = useState<State>({ kind: "loading" });
  const [coaching, setCoaching] = useState<Map<string, Coaching>>(new Map());
  const [selected, setSelected] = useState<string | null>(null);
  // The rep panel's two tabs, as the board shows them: the assessment, and "Recordings (n)".
  // Resets to the assessment when the manager picks a different rep — carrying "Recordings" over
  // would drop them into someone else's audio without having asked for it.
  const [repTab, setRepTab] = useState<"assessment" | "recordings">("assessment");
  const [backfilling, setBackfilling] = useState(false);
  const [backfillMsg, setBackfillMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const res = await fetch(
        `/api/coach/sales-session/coach-assessment/dashboard?period=${period}`
      );
      if (res.status === 403) {
        setState({ kind: "forbidden" });
        return;
      }
      if (!res.ok) {
        setState({ kind: "failed" });
        return;
      }
      const wire = (await res.json()) as Wire;
      setState({ kind: "ready", wire });
      setSelected((prev) => prev ?? wire.reps[0]?.repId ?? null);
    } catch {
      setState({ kind: "failed" });
    }
  }, [period]);

  useEffect(() => {
    void load();
  }, [load]);

  // The coaching notes, from the route that has always owned them. Best-effort and independent:
  // a failure here costs the Doing-well / Coaching-focus panel, not the dashboard.
  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const res = await fetch("/api/coach/sales-session/coach-assessment");
        if (!res.ok) return;
        const body = (await res.json()) as { team?: Coaching[] };
        if (!live) return;
        setCoaching(new Map((body.team ?? []).map((t) => [t.agentId, t])));
      } catch {
        /* the panel below simply stays empty; nothing else depends on it */
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  /**
   * "Generate missing" — carried over verbatim, because the guide's item 4 says to KEEP it.
   *
   * It is the M3 safety net: sessions that never got a dissect. The old page owned this button and
   * a rebuild that quietly dropped it would remove a manager's only way to recover them, which is
   * the kind of loss a redesign hides behind looking better.
   */
  const runBackfill = useCallback(async () => {
    setBackfilling(true);
    setBackfillMsg(null);
    try {
      const res = await fetch("/api/coach/sales-session/backfill-dissects", { method: "POST" });
      if (!res.ok) throw new Error(String(res.status));
      const d = (await res.json()) as { generated?: number; remaining?: number; thinOrFailed?: number };
      setBackfillMsg(
        `Generated ${d.generated ?? 0}${d.thinOrFailed ? `, ${d.thinOrFailed} too thin` : ""}. ${d.remaining ?? 0} still to generate.`
      );
      await load();
    } catch {
      setBackfillMsg("Couldn't generate the missing reviews right now — please try again.");
    } finally {
      setBackfilling(false);
    }
  }, [load]);

  const wire = state.kind === "ready" ? state.wire : null;
  const rep = wire?.reps.find((r) => r.repId === selected) ?? wire?.reps[0] ?? null;

  const repId = rep?.repId ?? null;
  useEffect(() => {
    setRepTab("assessment");
  }, [repId]);
  const repDetail = rep ? wire?.detail[rep.repId] : undefined;
  const notes = rep ? coaching.get(rep.repId) : undefined;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-5 py-4 border-b border-default flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold text-primary">Team Dashboard</h1>
          <p className="mt-0.5 text-xs text-muted">How the team is pitching</p>
        </div>
        {/* One toggle for the whole page — the guide's framing, not a per-card control. */}
        <div className="flex items-center gap-1 rounded-lg border border-default bg-surface p-1">
          {PERIODS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setPeriod(value)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                period === value ? "bg-brand text-[#09090B]" : "text-muted hover:text-primary"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-5 space-y-4">
        {state.kind === "forbidden" ? (
          <div className="rounded-lg border border-default bg-surface px-5 py-8 text-center">
            <p className="text-sm text-primary font-medium">Managers only</p>
            <p className="mx-auto mt-2 max-w-md text-xs text-muted">
              This page compares reps to each other. Your own figures are on My Progress.
            </p>
          </div>
        ) : state.kind === "loading" ? (
          <p className="py-8 text-center text-xs text-muted">Loading the team&apos;s figures…</p>
        ) : state.kind === "failed" || !wire ? (
          <div className="rounded-lg border border-red-500/30 bg-red-500/[0.06] px-5 py-6 text-center">
            <p className="text-sm text-primary font-medium">The team&apos;s figures could not be loaded</p>
            {/* NOT zeros. A dashboard of zeros about a week the team worked reads as a collapse. */}
            <p className="mx-auto mt-2 max-w-md text-xs text-muted">
              This is a failure to read them, not a team that did nothing.
            </p>
            <button
              type="button"
              onClick={() => void load()}
              className="mt-3 rounded-md border border-default px-3 py-1.5 text-xs text-secondary hover:text-primary"
            >
              Try again
            </button>
          </div>
        ) : (
          <>
            {/* 1 — Team score cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Card
                label="Team avg Pitch Score"
                value={String(wire.team.aggregate.avgPitchScore)}
                sub={`${wire.team.aggregate.avgBase} base · ${signed(wire.team.aggregate.avgBonus)} bonus · −${wire.team.aggregate.avgViolations} violations`}
              />
              <Card label="Team total points" value={wire.team.totalPoints.toLocaleString()} sub="Pitch Score points" />
              <Card
                label="Pitches counted"
                value={`${wire.team.counted} of ${wire.team.pitchesTotal}`}
                sub={
                  wire.team.pitchesTotal - wire.team.counted > 0
                    ? `${wire.team.pitchesTotal - wire.team.counted} didn't reach Discovery or scored under 40 base`
                    : undefined
                }
              />
              <Card
                label="Prize-eligible reps"
                value={`${wire.team.prizeEligible} of ${wire.team.repCount}`}
                sub={`${wire.team.minPitchesForPrize} counted pitches needed`}
              />
            </div>

            {wire.capped && (
              <p className="text-[11px] text-amber-700 dark:text-amber-400">
                This period has more pitches than one read returns, so these averages cover only
                part of it. A shorter period will be complete.
              </p>
            )}
            {wire.unattributed > 0 && (
              <p className="text-[11px] text-amber-700 dark:text-amber-400">
                {wire.unattributed} scored{" "}
                {wire.unattributed === 1 ? "pitch is" : "pitches are"} not attached to a rep and
                {wire.unattributed === 1 ? " is" : " are"} excluded from every figure here.
              </p>
            )}

            {/* 2 — Team activity */}
            <section className="rounded-lg border border-default bg-surface p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-sm font-semibold text-primary">Team activity</h2>
                <p className="text-[11px] text-muted">
                  Doors come from rep logs; presentations are doors spoken to
                </p>
              </div>
              <div className="mt-3 grid grid-cols-2 lg:grid-cols-5 gap-3">
                <Card label="Doors knocked" value={wire.team.kpis.doorsKnocked.toLocaleString()} />
                <Card label="Presentations" value={wire.team.kpis.presentations.toLocaleString()} />
                <Card label="Sold" value={wire.team.kpis.sold.toLocaleString()} />
                {/* The denominator travels with the rate — a 33% on three doors is not performance. */}
                <Card
                  label="Door → presentation"
                  value={pct(wire.team.kpis.doorToPresentationRate)}
                  sub={`of ${wire.team.kpis.doorsKnocked} doors`}
                />
                <Card
                  label="Close rate"
                  value={pct(wire.team.kpis.closeRate)}
                  sub={`of ${wire.team.kpis.presentations} presentations`}
                />
              </div>
            </section>

            {/* 3 — Team rubric averages */}
            <section className="rounded-lg border border-default bg-surface p-4">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-sm font-semibold text-primary">Team rubric averages</h2>
                <p className="text-xs text-muted tabular-nums">
                  Avg base <span className="font-semibold text-primary">{wire.team.aggregate.avgBase}</span> / 100
                </p>
              </div>
              <div className="mt-3 space-y-2">
                {wire.bars.map((b) => (
                  <div key={b.id} className="flex items-center gap-3">
                    <p className="w-28 shrink-0 text-xs text-secondary">
                      {b.label}
                      {b.lowest && (
                        <span className="ml-1.5 rounded bg-red-500/15 px-1 py-0.5 text-[9px] font-bold uppercase text-red-600 dark:text-red-400">
                          Lowest
                        </span>
                      )}
                    </p>
                    <div className="h-1.5 flex-1 rounded-full bg-base">
                      <div
                        className={`h-1.5 rounded-full ${b.lowest ? "bg-red-500" : "bg-brand"}`}
                        style={{ width: `${Math.min(100, (b.avg / b.max) * 100)}%` }}
                      />
                    </div>
                    <p className="w-16 shrink-0 text-right text-xs tabular-nums text-primary">
                      {b.avg} <span className="text-muted">/ {b.max}</span>
                    </p>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-muted">
                Across all counted pitches for the period. Select a rep below to compare them to the team.
              </p>
            </section>

            {/* 4 — Needs your attention */}
            <section className="rounded-lg border border-default bg-surface p-4">
              <h2 className="text-sm font-semibold text-primary">Needs your attention</h2>
              <div className="mt-3 space-y-2">
                {/* Reps short of prize eligibility — computable from what this page already has. */}
                {wire.reps
                  .filter((r) => (wire.detail[r.repId]?.aggregate.counted ?? 0) < wire.team.minPitchesForPrize)
                  .slice(0, 4)
                  .map((r) => {
                    const c = wire.detail[r.repId]?.aggregate.counted ?? 0;
                    return (
                      <div key={r.repId} className="flex items-start gap-2.5 rounded-md border border-default px-3 py-2">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted" aria-hidden />
                        <p className="text-xs text-secondary">
                          <span className="font-semibold text-primary">
                            {r.fullName ?? r.repId.slice(0, 8)}
                          </span>{" "}
                          · Not prize eligible yet — {c} counted{" "}
                          {c === 1 ? "pitch" : "pitches"} this period; needs {wire.team.minPitchesForPrize}.
                        </p>
                      </div>
                    );
                  })}

                <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-default px-3 py-2">
                  <p className="text-xs text-secondary">
                    Some sessions may not have been reviewed yet — usually a closed tab.
                  </p>
                  <button
                    type="button"
                    onClick={() => void runBackfill()}
                    disabled={backfilling}
                    className="rounded-md border border-default px-3 py-1.5 text-xs text-secondary hover:text-primary disabled:opacity-50"
                  >
                    {backfilling ? "Generating…" : "Generate missing"}
                  </button>
                </div>
                {backfillMsg && <p className="text-[11px] text-muted">{backfillMsg}</p>}

                {/* The rubric's one escalated violation, now wired. It was named-not-faked here
                    for three builds; the line that said so has been replaced by the thing it was
                    apologising for. */}
                <ReviewFlagQueue flags={wire.reviewFlags} onReviewed={() => void load()} />

                {/* Open disputes are not listed HERE because they are rendered in full above this
                    board by <DisputeQueue />, which the page keeps. Duplicating them as a summary
                    line would be a second count of the same thing on one screen. */}
                <p className="text-[11px] text-muted">Open score disputes are shown in full above.</p>
              </div>
            </section>

            {/* 5 — What the team needs to work on */}
            <section className="rounded-lg border border-default bg-surface p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-sm font-semibold text-primary">What the team needs to work on</h2>
                {wire.briefGeneratedAt && (
                  <p className="text-[11px] text-muted">
                    From the training brief · generated{" "}
                    {new Date(wire.briefGeneratedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
              {wire.priorities.length === 0 ? (
                <p className="mt-2 text-xs text-muted">
                  No training brief yet. These cards reshape the brief the Training page generates —
                  once one exists, the team&apos;s three priorities appear here with the points each
                  is worth.
                </p>
              ) : (
                <div className="mt-3 grid gap-3 lg:grid-cols-3">
                  {wire.priorities.map((p) => (
                    <div key={p.rank} className="rounded-lg border border-ember-400/30 bg-ember-400/[0.06] p-3.5">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-brand">
                        Priority {p.rank} · {p.sectionLabel}
                      </p>
                      <p className="mt-1 text-[13px] font-semibold text-primary">{p.title}</p>
                      <p className="mt-1 text-[11px] text-secondary leading-relaxed">{p.why}</p>
                      <div className="mt-2 flex items-baseline justify-between gap-2 text-[11px]">
                        <span className="text-muted tabular-nums">
                          Team avg {p.teamAvg} / {p.max}
                        </span>
                        <span className="font-semibold text-red-600 dark:text-red-400 tabular-nums">
                          {p.pointsLeft} pts/pitch left
                        </span>
                      </div>
                      {/* An assigned section is factually right about its numbers and was not named
                          by the brief. Saying so is the difference between a finding and a guess. */}
                      {!p.matched && (
                        <p className="mt-1.5 text-[10px] text-muted">
                          Section matched by largest gap — the brief did not name one.
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* 6 — Reps table */}
            <section className="rounded-lg border border-default bg-surface overflow-hidden">
              <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 border-b border-default">
                <h2 className="text-sm font-semibold text-primary">Reps</h2>
                <p className="text-[11px] text-muted">
                  Ranked by total points · select a rep for detail
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-widest text-muted">
                      <th className="px-3 py-2 text-left font-medium">Rank</th>
                      <th className="px-3 py-2 text-left font-medium">Rep</th>
                      <th className="px-3 py-2 text-right font-medium">Avg Pitch Score</th>
                      <th className="px-3 py-2 text-right font-medium">Total pts</th>
                      <th className="px-3 py-2 text-right font-medium">Doors</th>
                      <th className="px-3 py-2 text-right font-medium">Pres.</th>
                      <th className="px-3 py-2 text-right font-medium">Sold</th>
                      <th className="px-3 py-2 text-right font-medium">Close %</th>
                      <th className="px-3 py-2 text-left font-medium">Lowest section</th>
                      <th className="px-3 py-2 text-left font-medium">Coaching grade</th>
                      <th className="px-3 py-2 text-left font-medium">This week&apos;s focus</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wire.reps.map((r, i) => {
                      const band = r.avgPitchScore > 0 ? bandFor(r.avgPitchScore) : null;
                      const on = r.repId === rep?.repId;
                      return (
                        <tr
                          key={r.repId}
                          onClick={() => setSelected(r.repId)}
                          className={`cursor-pointer border-t border-default transition-colors ${
                            on ? "bg-ember-400/[0.06]" : "hover:bg-base/40"
                          }`}
                        >
                          <td className="px-3 py-2.5 text-muted tabular-nums">#{i + 1}</td>
                          <td className="px-3 py-2.5 font-semibold text-primary">
                            {r.fullName ?? r.repId.slice(0, 8)}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums">
                            <span className="font-semibold text-primary">{r.avgPitchScore}</span>
                            {band && <span className="ml-1.5 text-[10px] text-brand">{band}</span>}
                          </td>
                          <td className="px-3 py-2.5 text-right font-semibold text-primary tabular-nums">
                            {r.totalPoints.toLocaleString()}
                          </td>
                          <td className="px-3 py-2.5 text-right text-secondary tabular-nums">{r.doors}</td>
                          <td className="px-3 py-2.5 text-right text-secondary tabular-nums">{r.presentations}</td>
                          <td className="px-3 py-2.5 text-right text-secondary tabular-nums">{r.sold}</td>
                          <td className="px-3 py-2.5 text-right text-secondary tabular-nums">
                            {r.closeRate === null ? "—" : `${r.closeRate}%`}
                          </td>
                          <td className="px-3 py-2.5 text-secondary">{r.lowestSectionLabel ?? "—"}</td>
                          {/* A COLUMN, never the sort. The guide forbids ranking the grade. */}
                          <td className="px-3 py-2.5">
                            <AgentGradeBadge agentId={r.repId} />
                          </td>
                          <td className="px-3 py-2.5 text-secondary max-w-[22rem]">
                            {r.focus ?? (
                              <span className="text-muted">
                                Not in this brief. Rebuild the brief to generate a focus.
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {wire.reps.length === 0 && (
                <p className="px-4 py-8 text-center text-xs text-muted">
                  No rep has scored a pitch or logged a door in this period.
                </p>
              )}
            </section>

            {/* 7 — Rep detail, Overview */}
            {rep && repDetail && (
              <section className="rounded-lg border border-default bg-surface p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-primary">
                      {rep.fullName ?? rep.repId.slice(0, 8)}
                    </h2>
                    <p className="mt-0.5 text-xs text-muted">
                      #{wire.reps.findIndex((x) => x.repId === rep.repId) + 1} this period
                    </p>
                  </div>
                  <AgentGradeBadge agentId={rep.repId} />
                </div>

                {/* The board's tab strip. Recordings is Project 4 and it is the screen the other
                    four depend on: until a manager can press play at the second a score moved,
                    every number on this page asks to be trusted rather than checked (3.3). */}
                <div className="mt-4 flex gap-1 border-b border-default">
                  {([
                    ["assessment", "Assessment"],
                    ["recordings", "Recordings"],
                  ] as const).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setRepTab(id)}
                      className={`-mb-px border-b-2 px-3 py-2 text-xs font-medium transition ${
                        repTab === id
                          ? "border-ember-400 text-primary"
                          : "border-transparent text-muted hover:text-primary"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {repTab === "recordings" && (
                  <div className="mt-4">
                    <RecordingsTab repId={rep.repId} isManager />
                  </div>
                )}

                {repTab === "assessment" && (
                  <>
                <div className="mt-4 grid grid-cols-2 lg:grid-cols-5 gap-3">
                  <Card label="Doors knocked" value={String(repDetail.kpis.doorsKnocked)} />
                  <Card label="Presentations" value={String(repDetail.kpis.presentations)} />
                  <Card label="Sold" value={String(repDetail.kpis.sold)} />
                  <Card label="Door → presentation" value={pct(repDetail.kpis.doorToPresentationRate)} />
                  <Card label="Close rate" value={pct(repDetail.kpis.closeRate)} />
                </div>

                <div className="mt-3 grid grid-cols-2 lg:grid-cols-5 gap-3">
                  <Card label="Avg Pitch Score" value={String(repDetail.aggregate.avgPitchScore)} />
                  <Card label="Total points" value={String(repDetail.aggregate.totalPoints)} />
                  <Card label="Avg base" value={`${repDetail.aggregate.avgBase}`} sub="of 100" />
                  <Card
                    label="Avg bonus"
                    value={signed(repDetail.aggregate.avgBonus)}
                    sub="of 30 cap"
                    tone="text-emerald-700 dark:text-emerald-400"
                  />
                  <Card
                    label="Avg violations"
                    value={`−${repDetail.aggregate.avgViolations}`}
                    sub="per pitch"
                    tone="text-red-600 dark:text-red-400"
                  />
                </div>

                {/* Sections vs a team-average marker — the board's black tick. */}
                <div className="mt-4">
                  <div className="flex items-baseline justify-between">
                    <h3 className="text-xs font-semibold text-primary">Rubric sections vs. team</h3>
                    <p className="text-[10px] text-muted">
                      <span className="inline-block h-1.5 w-3 rounded-full bg-brand align-middle" /> Rep
                      <span className="ml-2 inline-block h-2.5 w-px bg-primary align-middle" /> Team avg
                    </p>
                  </div>
                  <div className="mt-2 space-y-2">
                    {wire.bars.map((b) => {
                      const mine = repDetail.aggregate.sectionAverages?.[b.id] ?? 0;
                      const delta = Math.round((mine - b.avg) * 10) / 10;
                      return (
                        <div key={b.id} className="flex items-center gap-3">
                          <p className="w-28 shrink-0 text-xs text-secondary">{b.label}</p>
                          <div className="relative h-1.5 flex-1 rounded-full bg-base">
                            <div
                              className="h-1.5 rounded-full bg-brand"
                              style={{ width: `${Math.min(100, (mine / b.max) * 100)}%` }}
                            />
                            <span
                              className="absolute top-[-3px] h-3 w-px bg-primary"
                              style={{ left: `${Math.min(100, (b.avg / b.max) * 100)}%` }}
                              aria-hidden
                            />
                          </div>
                          <p className="w-24 shrink-0 text-right text-xs tabular-nums">
                            <span className="text-primary">{Math.round(mine * 10) / 10}</span>
                            <span className="text-muted"> / {b.max} </span>
                            <span className={delta < 0 ? "text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"}>
                              {delta === 0 ? "±0.0" : signed(delta)}
                            </span>
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {rep.focus && (
                  <div className="mt-4 rounded-lg border border-ember-400/30 bg-ember-400/[0.06] p-3.5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-brand">
                      One focus this period
                    </p>
                    <p className="mt-1 text-xs text-secondary leading-relaxed">{rep.focus}</p>
                  </div>
                )}

                {/* The coaching notes, kept. They are this rep's own words from their Dissects and
                    are never ranked against anyone — which is why they live here and not in the
                    table above. */}
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
                      Doing well
                    </p>
                    {notes && notes.strengths.length > 0 ? (
                      <ul className="mt-1 space-y-1">
                        {notes.strengths.slice(0, 3).map((s, i) => (
                          <li key={i} className="text-xs text-secondary leading-relaxed">{s}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-xs text-muted">
                        No coaching signal yet for this rep.
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-brand">
                      Coaching focus
                    </p>
                    {notes && notes.growthAreas.length > 0 ? (
                      <ul className="mt-1 space-y-1">
                        {notes.growthAreas.slice(0, 3).map((s, i) => (
                          <li key={i} className="text-xs text-secondary leading-relaxed">{s}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-xs text-muted">
                        No coaching signal yet for this rep.
                      </p>
                    )}
                  </div>
                </div>

                {/* Skill scores — guide Step 3 item 7. The same component the old page used, moved
                    rather than rewritten, so the six /10 scores have one reading. */}
                <div className="mt-4 pt-4 border-t border-default">
                  <RepSkillGrades agentId={rep.repId} />
                </div>
                  </>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
