"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  Lock,
  GraduationCap,
  ThumbsUp,
  BookOpen,
  TriangleAlert,
} from "lucide-react";
import { LearningHint } from "@/components/learning/LearningHint";
import { useExperienceMode } from "@/components/experience/ExperienceModeProvider";
import {
  gradeCareAggregate,
  type CareCoachAggregate,
  type CareGrade,
} from "@/lib/care/careQualityGrade";

/**
 * C.A.R.E → Coach Assessment (admin/manager). Per-agent coaching roster, backed by the communication
 * books (founder 2026-07-22). Standard mode shows a LETTER GRADE; Expert shows the raw counts. The
 * founder signed off on this per-agent view overriding fetchTeamGrowth's stricter aggregate-only stance,
 * so it carries the same §A18 guardrails the Sales Coach Coach Assessment uses: ALPHABETICAL, never
 * grade-sorted; graded vs a fixed standard, never peers; coaching-framed (no F); letter travels with its
 * counts (§A11). Manager-only (the route enforces the gate); each agent sees their own on /growth (§A10).
 */

type LearningGap = { skill: string; principle: string; book: string };
type Agent = {
  agentId: string;
  agentName: string;
  aggregate: CareCoachAggregate;
  learningGaps: LearningGap[];
};
type Roster = {
  windowDays: number;
  agents: Agent[];
  noData: string[];
  bounded: boolean;
};

const TIER: Record<CareGrade["tier"], { text: string; ring: string; bg: string; label: string }> = {
  strong: { text: "text-emerald-300", ring: "border-emerald-500/40", bg: "bg-emerald-500/10", label: "Strong" },
  solid: { text: "text-brand", ring: "border-ember-400/40", bg: "bg-ember-400/10", label: "Solid" },
  developing: { text: "text-amber-300", ring: "border-amber-500/40", bg: "bg-amber-500/10", label: "Developing" },
  "growth-area": { text: "text-amber-300", ring: "border-amber-500/30", bg: "bg-amber-500/[0.07]", label: "Growth area" },
  "not-yet": { text: "text-muted", ring: "border-default", bg: "bg-white/[0.02]", label: "Not yet" },
};

export default function CareCoachAssessmentPage() {
  const [roster, setRoster] = useState<Roster | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "degraded" | "forbidden">("loading");
  const { isExpert } = useExperienceMode();

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/care/coach-assessment").catch(() => null);
      if (res && res.ok) {
        const d = await res.json();
        if (d.degraded) setState("degraded");
        else {
          setRoster(d.roster as Roster);
          setState("ok");
        }
      } else if (res && res.status === 403) {
        setState("forbidden");
      } else {
        setState("degraded");
      }
    } catch {
      setState("degraded");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <header className="px-4 md:px-8 py-4 border-b border-default bg-base/60 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-semibold text-primary">Coach Assessment</h1>
          <p className="text-[11px] text-muted">
            How each agent is growing · last 30 days · graded vs a standard, never against each other (§A18)
          </p>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 max-w-4xl w-full mx-auto space-y-4 bg-base">
        {state === "loading" ? (
          <div className="flex items-center gap-2 text-xs text-muted py-12 justify-center">
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> Loading…
          </div>
        ) : state === "degraded" ? (
          <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-4 flex items-center gap-3">
            <TriangleAlert className="w-4 h-4 text-amber-300 shrink-0" aria-hidden />
            <p className="text-xs text-amber-300">
              Couldn&apos;t load the assessment right now — this is an error, not an empty team. Try again shortly.
            </p>
          </div>
        ) : state === "forbidden" ? (
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
            <div className="inline-flex items-center gap-1.5 text-[11px] text-muted rounded-md border border-default px-2 py-1 mb-3">
              <Lock className="w-3 h-3" aria-hidden /> Admin only
            </div>
            <h2 className="text-sm font-semibold text-primary mb-1">Coach Assessment is admin-only</h2>
            <p className="text-xs text-secondary leading-relaxed">
              This is the admin&apos;s coaching overview of the support team. Your own growth lives on your
              Growth page.
            </p>
          </div>
        ) : (
          <>
            <LearningHint
              as="block"
              category="C.A.R.E · Coach Assessment"
              title="A coaching roster, not a leaderboard"
              whatItIs="Each agent's coaching grade + the book principles they'd most benefit from reinforcing, drawn from their own graded replies over the last 30 days."
              why="The grade is a glance-value; the real output is the learning gaps — which communication-book principle to coach next. Everyone is measured against a fixed competent-reply standard, never against each other, and the list is alphabetical so it can't become a rank."
              how="Read each agent's learning gaps and coach the one principle that recurs. In Standard mode you see a letter; switch to Expert to see the raw signal counts behind it."
              principle="Measure people against a standard and their own growth, never against each other — that's what keeps a grade coaching instead of ranking."
            >
              <div className="flex items-start gap-2 rounded-lg border border-ember-400/30 bg-ember-400/5 p-3">
                <GraduationCap className="w-4 h-4 text-brand shrink-0 mt-0.5" aria-hidden />
                <p className="text-xs text-secondary leading-relaxed">
                  Each agent is graded on their own replies against a fixed competent-reply standard —{" "}
                  <span className="text-primary">never against each other</span>. The grade travels with
                  the raw signal counts, and the <span className="text-primary">learning gaps</span> name
                  the communication-book principle worth reinforcing next. There is no &ldquo;F&rdquo; — the
                  lowest band is a growth area.
                </p>
              </div>
            </LearningHint>

            {roster && roster.bounded && (
              <p className="text-[11px] text-amber-300">
                Heads up: a high volume of replies means these counts may undercount (scan cap hit).
              </p>
            )}

            {roster && roster.agents.length === 0 && (
              <p className="text-xs text-muted py-8 text-center">
                No graded replies yet. Cards appear here as agents answer customers (each reply is graded
                automatically).
              </p>
            )}

            {roster?.agents.map((a) => {
              const grade = gradeCareAggregate(a.aggregate);
              const tier = TIER[grade.tier];
              const n = a.aggregate.repliesGraded;
              const riskTotal =
                a.aggregate.risks.unsupportedAbsolutes +
                a.aggregate.risks.fabricatedSpecifics +
                a.aggregate.risks.emptyFiller;
              return (
                <section
                  key={a.agentId}
                  className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4"
                >
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <h2 className="text-sm font-semibold text-primary">{a.agentName}</h2>
                    <span className="text-[10px] text-muted">
                      {n} repl{n === 1 ? "y" : "ies"} graded
                    </span>
                  </div>

                  {/* The grade (Standard) or the raw counts (Expert). A11: counts are shown in both. */}
                  {!isExpert && grade.letter && (
                    <div className="flex items-center gap-3 mb-3">
                      <span
                        className={`inline-flex items-center justify-center w-[52px] h-[52px] rounded-xl border ${tier.ring} ${tier.bg} ${tier.text} text-2xl font-extrabold shrink-0`}
                        aria-hidden
                      >
                        {grade.letter}
                      </span>
                      <div className="min-w-0">
                        <p className={`text-sm font-bold ${tier.text} leading-tight`}>{tier.label}</p>
                        <p className="text-[11px] text-muted leading-snug">
                          coaching grade · vs the competent-reply standard
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Count basis — always shown (§A11). Positive signals first (§A17). */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                    <CountChip label="Acknowledged" value={a.aggregate.acknowledgedCount} of={n} positive />
                    <CountChip label="Answered" value={a.aggregate.answeredCount} of={n} positive />
                    <CountChip label="Next step" value={a.aggregate.nextStepCount} of={n} positive />
                    <CountChip label="Risk flags" value={riskTotal} of={n} positive={false} />
                  </div>

                  {/* Learning gaps — the hero: which book principle to coach next. */}
                  {a.learningGaps.length > 0 ? (
                    <div>
                      <p className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-amber-300 font-bold mb-2">
                        <BookOpen className="w-3 h-3" aria-hidden /> Learning gaps · reinforce next
                      </p>
                      <ul className="space-y-1.5">
                        {a.learningGaps.map((g, i) => (
                          <li key={i} className="text-xs text-secondary leading-relaxed">
                            <span className="text-primary font-medium">{g.skill}</span> — {g.principle}{" "}
                            <span className="text-muted italic">({g.book})</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="inline-flex items-center gap-1.5 text-[11px] text-emerald-300">
                      <ThumbsUp className="w-3 h-3" aria-hidden /> Solid across the board — nothing flagged
                      to reinforce.
                    </p>
                  )}
                </section>
              );
            })}

            {roster && roster.noData.length > 0 && (
              <p className="text-[11px] text-muted">
                No graded replies yet: {roster.noData.join(", ")}.
              </p>
            )}
          </>
        )}
      </div>
    </>
  );
}

function CountChip({
  label,
  value,
  of,
  positive,
}: {
  label: string;
  value: number;
  of: number;
  positive: boolean;
}) {
  const tone = positive
    ? "border-emerald-500/30 bg-emerald-500/[0.06]"
    : value > 0
      ? "border-amber-500/30 bg-amber-500/[0.06]"
      : "border-default bg-white/[0.02]";
  return (
    <div className={`rounded-lg border ${tone} px-2.5 py-1.5`}>
      <p className="text-[9px] uppercase tracking-wider text-muted">{label}</p>
      <p className="text-sm font-bold text-primary tabular-nums">
        {value}
        <span className="text-[10px] font-normal text-muted"> / {of}</span>
      </p>
    </div>
  );
}
