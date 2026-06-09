"use client";

import { useEffect, useState } from "react";
import { BookOpen, Loader2, TriangleAlert } from "lucide-react";
import TopBar from "@/components/layout/TopBar";

/**
 * /dashboard/admin/coach-readout
 *
 * The §4 readout for the Conversational Coach v1. Closes the loop the
 * Coach was shipped against — see asset A2 ("design backwards from
 * the §4 readout, not forward from features").
 *
 * Discipline this page enforces (asset A3, anti-game-your-own-eval):
 *
 *   - No "Coach is working!" verdict. The reader interprets. The
 *     page deliberately presents raw counts, side-by-side, with an
 *     explicit caveat that N is small until the data crosses a
 *     readout-meaningful threshold.
 *   - "Acceptance rate" is presented as a leading indicator only,
 *     NOT a consequence measure. The consequence comparison is
 *     coached vs uncoached topic durability — those columns sit
 *     above the heuristic table so the eye lands there first.
 *
 * What would falsify the Coach (and thus be cause for rollback):
 *   - At N ≥ 10 coached topics, the held-resolution rate is no better
 *     than uncoached.
 *   - At N ≥ 30 offered suggestions per heuristic, the dismissed
 *     rate exceeds 60% — heuristic is mis-calibrated (per A4 the
 *     readout, not a pre-decision).
 */

type TopicStats = {
  total: number;
  closed: number;
  held: number;
  reopened: number;
  partial: number;
  unknown: number;
  avgCloseHours: number | null;
  avgMessages: number;
};

type HeuristicStats = {
  id: string;
  offered: number;
  accepted: number;
  dismissed: number;
  acceptRate: number | null;
};

type SurfaceStats = {
  surface: string;
  offered: number;
  accepted: number;
  dismissed: number;
  acceptRate: number | null;
  topHeuristic: string | null;
};

type Readout = {
  coached: TopicStats;
  uncoached: TopicStats;
  heuristics: HeuristicStats[];
  surfaces: SurfaceStats[];
  generatedAt: string;
};

const SURFACE_LABEL: Record<string, string> = {
  chat_topic: "Chat topics",
  task: "Tasks",
  decision: "Decision Dialogue",
  feedback: "Feedback drafts",
  smoke_test_result: "Smoke test notes",
};

const HEURISTIC_LABEL: Record<string, { name: string; source: string }> = {
  "nvc-evaluation": {
    name: "NVC — evaluation vs observation",
    source: "Nonviolent Communication — Rosenberg",
  },
  "voss-bare-assertion": {
    name: "Voss — assertion before label",
    source: "Never Split the Difference — Voss",
  },
  "stone-identity-collision": {
    name: "Stone-Heen — identity vs behavior",
    source: "Difficult Conversations — Stone, Patton, Heen",
  },
};

// Thresholds below which we explicitly call out "N too small to compare."
// Picked deliberately small so the readout becomes meaningful within a
// realistic walk-the-Coach window (60 days from §4 readout language),
// not arbitrarily strict.
const COACHED_TOPIC_THRESHOLD = 10;
const HEURISTIC_OFFERED_THRESHOLD = 30;

function fmtPct(num: number, denom: number): string {
  if (denom === 0) return "—";
  return `${Math.round((num / denom) * 100)}%`;
}

function fmtHours(h: number | null): string {
  if (h == null) return "—";
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h < 24) return `${h.toFixed(1)}h`;
  return `${(h / 24).toFixed(1)}d`;
}

export default function CoachReadoutPage() {
  const [data, setData] = useState<Readout | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/admin/coach-readout");
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        const json = (await res.json()) as Readout;
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const enoughCoached =
    (data?.coached.total ?? 0) >= COACHED_TOPIC_THRESHOLD;

  return (
    <div className="min-h-screen bg-base">
      <TopBar
        title="Coach readout"
        subtitle="§4 instrument · raw counts, no verdicts — the reader interprets"
      />
      <div className="p-6 max-w-5xl mx-auto space-y-5">
        {/* Discipline preamble — explicit so the reader knows what
            this surface IS and IS NOT. */}
        <div className="glass-card p-4 border border-[#C8232C]/30 bg-[#C8232C]/5">
          <p className="text-xs text-secondary leading-relaxed">
            This page surfaces what the chain says about whether the
            Conversational Coach changes downstream consequence — NOT
            whether testers agree with the Coach&apos;s suggestions.
            That distinction is the difference between measuring
            agreement and measuring consequence (§3.5). It deliberately
            does not present a verdict. The reader interprets.
          </p>
          <p className="text-[11px] text-muted leading-relaxed mt-2">
            <span className="font-semibold text-brand">Coach v2 — mirror frame:</span>{" "}
            chips no longer assert a verdict on a single draft. They
            surface a per-user pattern count drawn from the §3.1 record
            (past <code className="font-mono">coach.pattern_observed</code>{" "}
            events) and ask a question. The user renders the verdict; the
            System only reports a count. Asset A11 in the Library.
          </p>
          <p className="text-[11px] text-muted leading-relaxed mt-2">
            What would falsify the Coach: at N ≥ {COACHED_TOPIC_THRESHOLD}{" "}
            coached topics, the held-resolution rate is no better than
            uncoached. Or at N ≥ {HEURISTIC_OFFERED_THRESHOLD} offered
            per heuristic, the dismiss rate exceeds 60%.
          </p>
        </div>

        {loading && (
          <div className="flex items-center justify-center gap-2 text-xs text-muted py-10">
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
            Loading readout…
          </div>
        )}
        {error && <p className="text-xs text-red-400">{error}</p>}

        {data && (
          <>
            {/* N-too-small caveat */}
            {!enoughCoached && (
              <div className="glass-card p-3 border border-gold-400/40 bg-gold-400/5 flex items-start gap-2">
                <TriangleAlert
                  className="w-4 h-4 text-accent-text flex-shrink-0 mt-0.5"
                  aria-hidden
                />
                <p className="text-xs text-secondary leading-relaxed">
                  <span className="font-semibold text-accent-text">
                    N too small for an honest comparison.
                  </span>{" "}
                  We have <span className="font-mono">{data.coached.total}</span>{" "}
                  coached topics; the comparison becomes meaningful at{" "}
                  <span className="font-mono">{COACHED_TOPIC_THRESHOLD}</span>.
                  The numbers below are visible for transparency, but
                  drawing a conclusion this early would be the imitation-of-
                  intelligence trap §5 explicitly warns against.
                </p>
              </div>
            )}

            {/* Topic outcomes side-by-side */}
            <div className="glass-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="w-4 h-4 text-brand" aria-hidden />
                <h2 className="text-sm font-semibold text-primary">
                  Topic outcomes — coached vs uncoached
                </h2>
              </div>
              <p className="text-[11px] text-muted leading-relaxed mb-4">
                Consequence measure (§3.5). Topics where{" "}
                <span className="font-mono">coach_enabled</span> was true
                during the conversation vs topics where it was false. We
                read the durability column FIRST — that&apos;s the
                §3.5-anchored outcome — then time-to-close and average
                message count as efficiency signals.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-widest text-muted border-b border-default">
                      <th className="py-2 pr-4">Metric</th>
                      <th className="py-2 pr-4">Coach OFF</th>
                      <th className="py-2 pr-4">Coach ON</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-default">
                    <Row
                      label="Total topics"
                      left={`${data.uncoached.total}`}
                      right={`${data.coached.total}`}
                    />
                    <Row
                      label="Closed"
                      left={`${data.uncoached.closed} (${fmtPct(data.uncoached.closed, data.uncoached.total)})`}
                      right={`${data.coached.closed} (${fmtPct(data.coached.closed, data.coached.total)})`}
                    />
                    <Row
                      label="Held"
                      left={`${data.uncoached.held} (${fmtPct(data.uncoached.held, data.uncoached.closed)} of closed)`}
                      right={`${data.coached.held} (${fmtPct(data.coached.held, data.coached.closed)} of closed)`}
                      emphasize
                    />
                    <Row
                      label="Reopened"
                      left={`${data.uncoached.reopened}`}
                      right={`${data.coached.reopened}`}
                    />
                    <Row
                      label="Partial"
                      left={`${data.uncoached.partial}`}
                      right={`${data.coached.partial}`}
                    />
                    <Row
                      label="Unknown / unreviewed"
                      left={`${data.uncoached.unknown}`}
                      right={`${data.coached.unknown}`}
                    />
                    <Row
                      label="Avg time to close"
                      left={fmtHours(data.uncoached.avgCloseHours)}
                      right={fmtHours(data.coached.avgCloseHours)}
                    />
                    <Row
                      label="Avg messages per topic"
                      left={data.uncoached.avgMessages.toFixed(1)}
                      right={data.coached.avgMessages.toFixed(1)}
                    />
                  </tbody>
                </table>
              </div>
            </div>

            {/* Per-surface — Coach reach across communication surfaces */}
            <div className="glass-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="w-4 h-4 text-brand" aria-hidden />
                <h2 className="text-sm font-semibold text-primary">
                  By surface — where the Coach is firing
                </h2>
              </div>
              <p className="text-[11px] text-muted leading-relaxed mb-4">
                Coach v1.1 runs on chat topics, tasks, feedback drafts,
                smoke-test notes (and Decision Dialogue once that mount
                lands). Per-surface acceptance shows where the heuristics
                land vs where they read as noise — input to surface-
                specific calibration, NOT a consequence measure for the
                Coach as a whole.
              </p>
              {data.surfaces.length === 0 ? (
                <p className="text-xs text-muted text-center py-6">
                  No Coach activity on any surface yet.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-[10px] uppercase tracking-widest text-muted border-b border-default">
                        <th className="py-2 pr-4">Surface</th>
                        <th className="py-2 pr-4">Offered</th>
                        <th className="py-2 pr-4">Accepted</th>
                        <th className="py-2 pr-4">Dismissed</th>
                        <th className="py-2 pr-4">Accept rate</th>
                        <th className="py-2 pr-4">Top heuristic</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-default">
                      {data.surfaces.map((s) => (
                        <tr key={s.surface}>
                          <td className="py-2 pr-4 text-primary">
                            {SURFACE_LABEL[s.surface] ?? s.surface}
                          </td>
                          <td className="py-2 pr-4 font-mono">{s.offered}</td>
                          <td className="py-2 pr-4 font-mono">{s.accepted}</td>
                          <td className="py-2 pr-4 font-mono">{s.dismissed}</td>
                          <td className="py-2 pr-4 font-mono">
                            {s.acceptRate == null
                              ? "—"
                              : `${Math.round(s.acceptRate * 100)}%`}
                          </td>
                          <td className="py-2 pr-4 text-[10px] text-muted font-mono">
                            {s.topHeuristic
                              ? (HEURISTIC_LABEL[s.topHeuristic]?.name ?? s.topHeuristic)
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Per-heuristic acceptance */}
            <div className="glass-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="w-4 h-4 text-brand" aria-hidden />
                <h2 className="text-sm font-semibold text-primary">
                  Per-heuristic — calibration signals
                </h2>
              </div>
              <p className="text-[11px] text-muted leading-relaxed mb-4">
                Leading indicator (NOT consequence). High dismiss rate at
                N ≥ {HEURISTIC_OFFERED_THRESHOLD} = heuristic is over-firing
                on phrasing testers don&apos;t consider a problem. That&apos;s
                input to a calibration PR, not a Coach verdict — the
                consequence comparison above is what answers the §4
                question of whether the Coach earns its keep.
              </p>
              {data.heuristics.length === 0 ? (
                <p className="text-xs text-muted text-center py-8">
                  No coach.suggestion_* events on the chain yet.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-[10px] uppercase tracking-widest text-muted border-b border-default">
                        <th className="py-2 pr-4">Heuristic</th>
                        <th className="py-2 pr-4">Offered</th>
                        <th className="py-2 pr-4">Accepted</th>
                        <th className="py-2 pr-4">Dismissed</th>
                        <th className="py-2 pr-4">Accept rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-default">
                      {data.heuristics.map((h) => {
                        const label = HEURISTIC_LABEL[h.id];
                        const enoughOffered =
                          h.offered >= HEURISTIC_OFFERED_THRESHOLD;
                        return (
                          <tr key={h.id}>
                            <td className="py-2 pr-4">
                              <p className="text-primary">
                                {label?.name ?? h.id}
                              </p>
                              {label && (
                                <p className="text-[10px] text-muted font-mono">
                                  {label.source}
                                </p>
                              )}
                            </td>
                            <td className="py-2 pr-4 font-mono">{h.offered}</td>
                            <td className="py-2 pr-4 font-mono">{h.accepted}</td>
                            <td className="py-2 pr-4 font-mono">{h.dismissed}</td>
                            <td className="py-2 pr-4 font-mono">
                              {h.acceptRate == null
                                ? "—"
                                : enoughOffered
                                  ? `${Math.round(h.acceptRate * 100)}%`
                                  : `${Math.round(h.acceptRate * 100)}% (low N)`}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <p className="text-[10px] text-muted text-center font-mono">
              generated {new Date(data.generatedAt).toLocaleString()}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function Row({
  label,
  left,
  right,
  emphasize,
}: {
  label: string;
  left: string;
  right: string;
  emphasize?: boolean;
}) {
  return (
    <tr className={emphasize ? "bg-emerald-500/5" : ""}>
      <td className="py-2 pr-4 text-secondary">{label}</td>
      <td className="py-2 pr-4 font-mono text-primary">{left}</td>
      <td className="py-2 pr-4 font-mono text-primary">{right}</td>
    </tr>
  );
}
