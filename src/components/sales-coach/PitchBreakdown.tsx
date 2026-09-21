"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, AlertTriangle, Info, TrendingUp } from "lucide-react";
// `lowestSection` is imported, not re-implemented. An identical four-line copy lived here for
// an hour and was caught by an orphan/duplicate sweep — the same §2.2 shape found twice already
// today (the manager predicate, the section totals), and both of those copies also agreed with
// their authority on the day they were written.
import {
  SECTIONS,
  elementsForSection,
  lowestSection,
  type SectionId,
} from "@/lib/coach/pitchScore/rubric";
import { ScoringRubricSheet } from "./ScoringRubricSheet";
import type { PeriodAggregate, ElementStat } from "@/lib/coach/pitchScore/aggregate";
import type { ImprovementVerdict } from "@/lib/coach/pitchScore/improvement";

/**
 * The Breakdown board — a rep's rubric averages over a period.
 *
 * Built to page 2 of the rep dashboard, which I opened and read: a period switcher, "Your rubric
 * averages" with the qualifying count, a BIGGEST OPPORTUNITY callout, BASE SCORE out of 100 with
 * a bar per section, the lowest section expanded into per-element hit/partial/missed rates, then
 * BONUS POINTS and VIOLATIONS tables, and a footer reconciling base + bonus − violations to the
 * average.
 *
 * WHAT THIS SCREEN IS FOR, and it governs every choice below: telling a rep the ONE thing worth
 * practising this week. A wall of thirty accurate percentages is not that — it is the same data
 * with the decision handed back to the reader. So the opportunity callout is computed from the
 * largest points-per-pitch gap and stated in points the rep can picture.
 */

const ENDPOINT = "/api/coach/sales-session/pitch-score/breakdown";
const PERIODS = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "all", label: "All time" },
] as const;

type State =
  | { kind: "loading" }
  | { kind: "failed" }
  | { kind: "ready"; agg: PeriodAggregate; skipped: number; improvement?: ImprovementVerdict; capped?: boolean };

const pct = (n: number) => `${Math.round(n * 100)}%`;

/**
 * The single biggest gap, in points per pitch.
 *
 * Ranked by unearned points (`maxPoints − avgPoints`), NOT by hit rate. A rep missing an 8-point
 * element half the time is losing four points a pitch; one missing a 2-point element entirely is
 * losing two. Ranking by rate would send them after the second, which is the smaller prize and
 * feels like being nagged about something that barely counts.
 */
/**
 * What the rep is doing BEST — the element they hit closest to its ceiling.
 *
 * Exists because of the founder's 2026-09-22 ruling and `docs/SalesCoach-KPI-System.md`, whose
 * agent-view clause is not only about ranking: *"Growth-framed — lead with what improved, then
 * growth areas, per the coaching philosophy."* This board opened with BIGGEST OPPORTUNITY, which
 * is a deficit, and led with it.
 *
 * HONEST ABOUT WHAT THIS IS NOT. The document says lead with what IMPROVED, which is a comparison
 * against the rep's own past and needs a period-over-period read this board does not have. Leading
 * with a strength is the growth-framing that today's data can support; it is not the clause's
 * literal requirement, and the gap is recorded rather than papered over.
 *
 * Measured as the smallest gap to the ceiling rather than the highest raw points, so a 2-point
 * element hit every time beats a 4-point element hit half the time — the question is what the rep
 * does WELL, not which element is worth most.
 */
export function strongestElement(stats: readonly ElementStat[]): ElementStat | null {
  let best: ElementStat | null = null;
  let bestGap = Infinity;
  for (const s of stats) {
    // Never scored is not a strength. An element with no attempts has a gap of its full value and
    // would otherwise win whenever every attempted element had been imperfect.
    if (s.maxPoints <= 0 || s.avgPoints <= 0) continue;
    const gap = s.maxPoints - s.avgPoints;
    if (gap < bestGap) {
      bestGap = gap;
      best = s;
    }
  }
  return best;
}

export function biggestOpportunity(stats: readonly ElementStat[]): ElementStat | null {
  let best: ElementStat | null = null;
  let bestGap = 0;
  for (const s of stats) {
    const gap = s.maxPoints - s.avgPoints;
    if (gap > bestGap) {
      bestGap = gap;
      best = s;
    }
  }
  // A gap under a tenth of a point is not an opportunity, it is rounding. Showing one would make
  // a rep who is doing well chase a number that cannot move.
  return bestGap >= 0.1 ? best : null;
}

export function PitchBreakdown({ repId }: { repId?: string }) {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]["id"]>("week");
  const [state, setState] = useState<State>({ kind: "loading" });
  const [rubricOpen, setRubricOpen] = useState(false);
  const [openSection, setOpenSection] = useState<SectionId | null>(null);

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const qs = new URLSearchParams({ period });
      if (repId) qs.set("repId", repId);
      const res = await fetch(`${ENDPOINT}?${qs}`);
      if (!res.ok) {
        setState({ kind: "failed" });
        return;
      }
      const body = (await res.json()) as {
        aggregate: PeriodAggregate;
        skippedPreVerdict: number;
        improvement?: ImprovementVerdict;
        capped?: boolean;
      };
      setState({
        kind: "ready",
        agg: body.aggregate,
        skipped: body.skippedPreVerdict ?? 0,
        // Optional on the wire: a browser on new code can be served by a server that predates
        // the baseline read, and a missing verdict must render as "not enough evidence" rather
        // than throwing inside the board.
        improvement: body.improvement,
        capped: body.capped === true,
      });
    } catch {
      setState({ kind: "failed" });
    }
  }, [period, repId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="rounded-2xl border border-default bg-base p-4 sm:p-5">
      <header className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-sm font-semibold text-primary">Your rubric averages</h2>
        <button
          type="button"
          onClick={() => setRubricOpen(true)}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand hover:underline"
        >
          <Info className="w-3.5 h-3.5" aria-hidden />
          Rubric
        </button>
      </header>

      <div role="tablist" aria-label="Period" className="flex gap-1 mb-4">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            role="tab"
            aria-selected={period === p.id}
            onClick={() => setPeriod(p.id)}
            className={`flex-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold ${
              period === p.id
                ? "bg-ember-400 text-ink-950"
                : "border border-default text-secondary hover:text-primary"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {state.kind === "loading" && (
        <p className="flex items-center gap-2 text-xs text-muted">
          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
          Loading…
        </p>
      )}

      {state.kind === "failed" && (
        // NOT an empty period. "0 pitches this week" about a week the rep worked reads as the
        // product having lost their calls.
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-3">
          <p className="flex items-start gap-2 text-xs text-primary">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
            <span>Your scores could not be loaded. This is not the same as having none.</span>
          </p>
          <button type="button" onClick={load} className="mt-2 text-[11px] font-semibold text-brand hover:underline">
            Try again
          </button>
        </div>
      )}

      {state.kind === "ready" && <Board agg={state.agg} skipped={state.skipped} improvement={state.improvement} capped={state.capped} openSection={openSection} setOpenSection={setOpenSection} />}

      {rubricOpen && <ScoringRubricSheet onClose={() => setRubricOpen(false)} />}
    </section>
  );
}

function Board({
  agg,
  skipped,
  improvement,
  capped,
  openSection,
  setOpenSection,
}: {
  agg: PeriodAggregate;
  skipped: number;
  /** Optional on the wire: an older server predates the baseline read. Absent renders as nothing. */
  improvement?: ImprovementVerdict;
  /** The read hit its row bound, so these averages cover part of the period rather than the period. */
  capped?: boolean;
  openSection: SectionId | null;
  setOpenSection: (s: SectionId | null) => void;
}) {
  if (agg.counted === 0) {
    return (
      <div>
        <p className="text-xs text-secondary">
          {agg.pitchesTotal === 0
            ? "No pitches scored in this period yet."
            : `${agg.pitchesTotal} pitch${agg.pitchesTotal === 1 ? "" : "es"}, none counted yet.`}
        </p>
        {/* The exclusion reasons, not a bare count — "none counted" with no explanation reads as
            the product being broken rather than as a run of short doors. */}
        {Object.entries(agg.notCountedReasons).map(([reason, n]) => (
          <p key={reason} className="mt-1 text-[11px] text-muted">
            {n} · {reason}
          </p>
        ))}
      </div>
    );
  }

  const opportunity = biggestOpportunity(agg.elementStats);
  const strength = strongestElement(agg.elementStats);
  const lowest = lowestSection(agg.sectionAverages);

  return (
    <div className="space-y-5">
      <p className="text-[11px] text-muted">
        {agg.counted} qualifying pitch{agg.counted === 1 ? "" : "es"}
        {agg.notCounted > 0 && ` · ${agg.notCounted} not counted`}
        {skipped > 0 && ` · ${skipped} scored before section totals were recorded`}
      </p>

      {/*
        A truncated read, said out loud. Every average on this board is over the pitches that came
        back, and when the bound bites that is part of a period rather than the period — which is
        a different claim from the one the numbers appear to make.
      */}
      {capped && (
        <p className="text-[11px] text-amber-700 dark:text-amber-400">
          This period has more pitches than one read returns, so these averages cover only part of
          it. A shorter period will be complete.
        </p>
      )}

      {/*
        WHAT GOT BETTER, above everything.

        `docs/SalesCoach-KPI-System.md` principle 1: *"the primary comparison is
        agent-vs-their-own-past (self-Elo)"*, and of this surface: *"lead with what improved, then
        growth areas."* A strength is a fact about a rep; an improvement is a fact about their
        growth, and this document is about the second.

        INSUFFICIENT IS RENDERED, NOT HIDDEN. Principle 3 of the same document — and §3.2 — make
        "not enough evidence" a state a rep must be able to see. Falling back silently to the
        strength below would look like an answer to a question that was never answered.
      */}
      {improvement?.status === "improved" && (
        <div className="rounded-xl border border-brand/50 bg-surface p-4">
          <p className="text-[10px] uppercase tracking-widest text-brand">Most improved</p>
          <p className="mt-1 text-[13px] font-semibold text-primary tabular-nums">
            {improvement.top.label}: {improvement.top.before} → {improvement.top.after} per pitch
          </p>
          <p className="mt-1 text-[11px] text-muted">
            Up {improvement.top.gained} points a pitch on the period before this one.
          </p>
        </div>
      )}

      {improvement?.status === "no_change" && (
        <div className="rounded-xl border border-default bg-surface p-4">
          <p className="text-[10px] uppercase tracking-widest text-muted">Most improved</p>
          {/*
            A real answer, and deliberately not dressed as a data problem. Telling a rep the system
            could not tell would be a lie in the flattering direction.
          */}
          <p className="mt-1 text-[12px] text-secondary">
            Nothing moved up against the period before this one.
          </p>
        </div>
      )}

      {improvement?.status === "insufficient" && (
        <div className="rounded-xl border border-default bg-base/40 p-4">
          <p className="text-[10px] uppercase tracking-widest text-muted">Most improved</p>
          <p className="mt-1 text-[12px] text-secondary">
            Not enough to compare yet — {improvement.reason}.
          </p>
          <p className="mt-1 text-[11px] text-muted">
            Three counted pitches in each period are needed before a change means anything.
          </p>
        </div>
      )}

      {/*
        WHAT IS GOING WELL, ABOVE THE GAP. The KPI document's agent-view clause asks for a board
        that leads with strength and follows with growth areas; this board used to open on the
        biggest deficit. The order is the whole point — the same two facts, read in the other
        sequence, are a different message to the person reading them.
      */}
      {strength && (
        <div className="rounded-xl border border-emerald-600/40 bg-surface p-4">
          <p className="text-[10px] uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
            Your strongest
          </p>
          <p className="mt-1 text-[13px] font-semibold text-primary">
            {strength.label}: averaging {strength.avgPoints} of {strength.maxPoints}
          </p>
          <p className="mt-1 text-[11px] text-muted">
            Across your {agg.counted} counted pitch{agg.counted === 1 ? "" : "es"}.
          </p>
        </div>
      )}

      {opportunity && (
        <section className="rounded-xl border border-brand/40 bg-brand/5 p-4">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-brand">
            <TrendingUp className="w-3 h-3" aria-hidden />
            Biggest opportunity
          </p>
          <p className="mt-1 text-sm font-semibold text-primary">
            {opportunity.label}: averaging {opportunity.avgPoints} of {opportunity.maxPoints}
          </p>
          {/* Stated in points the rep can picture, and in the period's own terms. A percentage
              here would be accurate and unactionable. */}
          <p className="mt-1 text-[11px] text-secondary leading-relaxed">
            Hitting it every pitch adds {Math.round((opportunity.maxPoints - opportunity.avgPoints) * 10) / 10} points
            per pitch — about {Math.round((opportunity.maxPoints - opportunity.avgPoints) * agg.counted)} points
            across your {agg.counted} counted pitch{agg.counted === 1 ? "" : "es"}.
          </p>
        </section>
      )}

      <section>
        <div className="flex items-baseline justify-between mb-2">
          <h3 className="text-[10px] uppercase tracking-widest text-muted">Base score</h3>
          <p className="text-sm font-semibold text-primary tabular-nums">
            {agg.avgBase} <span className="text-muted font-normal">/ 100</span>
          </p>
        </div>

        <div className="space-y-2">
          {SECTIONS.map((s) => {
            const points = agg.sectionAverages[s.id] ?? 0;
            const isOpen = openSection === s.id;
            const stats = agg.elementStats.filter((e) => e.section === s.id);
            return (
              <div key={s.id} className="rounded-xl border border-default bg-surface overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpenSection(isOpen ? null : s.id)}
                  aria-expanded={isOpen}
                  disabled={stats.length === 0}
                  className="w-full px-4 py-3 text-left disabled:opacity-60"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium text-primary truncate">{s.label}</span>
                      {lowest === s.id && (
                        <span className="shrink-0 rounded bg-brand/15 px-1.5 py-0.5 text-[9px] font-bold text-brand">
                          LOWEST
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-sm tabular-nums">
                      <span className="font-semibold text-primary">{points}</span>
                      <span className="text-muted"> / {s.maxPoints}</span>
                    </span>
                  </span>
                  <span className="mt-2 block h-1.5 rounded-full bg-ink-500/20 overflow-hidden">
                    <span
                      className="block h-full rounded-full bg-ember-400"
                      style={{ width: `${Math.min(100, (points / s.maxPoints) * 100)}%` }}
                    />
                  </span>
                </button>

                {isOpen && stats.length > 0 && (
                  <ul className="border-t border-default">
                    {elementsForSection(s.id).map((def) => {
                      const e = stats.find((x) => x.elementId === def.id);
                      if (!e) return null;
                      return (
                        <li key={def.id} className="px-4 py-2.5 border-b border-default last:border-0">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-[12px] text-primary truncate">{e.label}</span>
                            <span className="shrink-0 text-[12px] tabular-nums">
                              <span className="font-semibold text-primary">{e.avgPoints}</span>
                              <span className="text-muted"> / {e.maxPoints}</span>
                            </span>
                          </div>
                          {/* Three segments, and the numbers repeated underneath — the bar is the
                              glance and the text is the fact, because a colour-only ratio is
                              unreadable to a fair share of reps. */}
                          <div className="mt-1 flex h-1 rounded-full overflow-hidden">
                            <span className="bg-emerald-600" style={{ width: pct(e.hitRate) }} />
                            <span className="bg-amber-500" style={{ width: pct(e.partialRate) }} />
                            <span className="bg-ink-500/30" style={{ width: pct(e.missedRate) }} />
                          </div>
                          <p className="mt-1 text-[10px] text-muted">
                            {pct(e.hitRate)} hit · {pct(e.partialRate)} partial · {pct(e.missedRate)} missed
                            <span className="text-muted"> · in {e.gradedIn} pitch{e.gradedIn === 1 ? "" : "es"}</span>
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {agg.bonusStats.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between mb-2">
            <h3 className="text-[10px] uppercase tracking-widest text-muted">Bonus points</h3>
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
              +{agg.avgBonus} <span className="text-muted font-normal">/ 30 cap</span>
            </p>
          </div>
          <ul className="rounded-xl border border-default bg-surface divide-y divide-default">
            {agg.bonusStats.map((b) => (
              <li key={b.bonusId} className="flex items-center justify-between gap-3 px-4 py-2">
                <span className="text-[12px] text-primary truncate">{b.label}</span>
                <span className="shrink-0 flex items-center gap-3 text-[11px] tabular-nums">
                  <span className="text-muted">{pct(b.earnedInRate)}</span>
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400 w-12 text-right">
                    +{b.avgPoints}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {agg.violationStats.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between mb-2">
            <h3 className="text-[10px] uppercase tracking-widest text-muted">Violations</h3>
            <p className="text-sm font-semibold text-red-700 dark:text-red-400 tabular-nums">
              −{agg.avgViolations}
            </p>
          </div>
          <ul className="rounded-xl border border-default bg-surface divide-y divide-default">
            {agg.violationStats.map((v) => (
              <li key={v.violationId} className="flex items-center justify-between gap-3 px-4 py-2">
                <span className="text-[12px] text-primary truncate">{v.label}</span>
                <span className="shrink-0 flex items-center gap-3 text-[11px] tabular-nums">
                  <span className="text-muted">{pct(v.rate)}</span>
                  <span className="font-semibold text-red-700 dark:text-red-400 w-12 text-right">
                    −{v.avgDeduction}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/*
        The reconciliation, on screen. The launch checklist requires base + bonus − violations to
        equal the displayed average; printing it is what makes that checkable by the person who
        would notice it first — the rep whose number it is.
      */}
      <p className="text-center text-[11px] text-muted tabular-nums">
        {agg.avgBase} base + {agg.avgBonus} bonus − {agg.avgViolations} ={" "}
        <span className="font-semibold text-brand">{agg.avgPitchScore}</span> avg
      </p>
    </div>
  );
}
