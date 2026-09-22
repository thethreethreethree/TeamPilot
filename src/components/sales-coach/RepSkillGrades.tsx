"use client";

import { useEffect, useState } from "react";
import { gradeSkill } from "@/lib/coach/v5/skillGrade";

/**
 * A rep's skill scores and process breakdown — EXTRACTED 2026-09-22 from the old Coach Assessment
 * page so the rebuilt board can keep them.
 *
 * The founder's ruling on the rebuild was "keep ELO inside rep detail", and the guide's Step 3
 * item 7 lists skill scores among what the rep detail Overview shows. Rewriting them would have
 * produced a second reading of the same six numbers; moving the component keeps one.
 *
 * Unchanged from the original except for being exported. The lazy scoresOnly=1 fetch, the honest
 * empty state and the failed-read message are all as they were.
 */
type SkillRow = { label: string; score: number | null };

/**
 * Per-rep skill scores (the former Analytics content, merged into the Coach Assessment card — founder 2026-08-28).
 * Lazily fetches the rep's six /10 skill scores when their card is EXPANDED (this component mounts inside the
 * expanded block), using scoresOnly=1 so the page never fires an LLM breakdown pass per rep. §3.4: a failed read
 * says so; not-enough-sessions is an honest empty, not a zero score. The full AI breakdowns stay on the rep's own
 * Analytics self-view.
 */
// Process breakdown (partner meeting 9/2): per-phase aggregate rendered UNDER the skill scores.
type PhaseRow = { key: string; label: string; avg: number | null; samples: number; tip: string };

export function RepSkillGrades({ agentId }: { agentId: string }) {
  const [skills, setSkills] = useState<SkillRow[] | null>(null);
  const [phases, setPhases] = useState<PhaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    fetch(`/api/coach/sales-session/skills?agentId=${encodeURIComponent(agentId)}&scoresOnly=1`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("skills read failed"))))
      .then((d) => {
        if (cancelled) return;
        setSkills((d.skills ?? []) as SkillRow[]);
        setPhases((d.processBreakdown ?? []) as PhaseRow[]);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [agentId]);

  const graded = (skills ?? []).map((s) => ({ ...s, grade: gradeSkill(s.score) }));
  const scored = graded.filter((g) => g.grade.letter !== null);

  return (
    <>
    <div className="mt-4 pt-3 border-t border-white/5">
      <p className="text-[10px] uppercase tracking-widest text-sky-300/80 font-bold mb-2">Skill scores</p>
      {loading ? (
        <p className="text-[11px] text-muted">Loading skill scores…</p>
      ) : error ? (
        <p className="text-[11px] text-muted">Couldn&apos;t load skill scores — reopen to retry.</p>
      ) : scored.length === 0 ? (
        <p className="text-[11px] text-muted">Not enough recorded sessions yet for skill scores.</p>
      ) : (
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
          {graded.map((g) => (
            <div key={g.label} className="flex items-center justify-between text-xs">
              <span className="text-secondary">{g.label}</span>
              <span className="text-muted tabular-nums shrink-0 ml-2">
                {g.grade.letter === null ? "—" : `${g.grade.letter} · ${g.grade.fromScore}/10`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>

      {/* Process breakdown (partner meeting 9/2) — per-phase read + the tip from the rep's weakest session. */}
      {!loading && !error && phases.length > 0 && (
        <div className="mt-4 pt-3 border-t border-white/5">
          <p className="text-[10px] uppercase tracking-widest text-amber-300/80 font-bold mb-2">Process breakdown</p>
          <div className="flex flex-col gap-2.5">
            {phases.map((ph) => (
              <div key={ph.key}>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-secondary">{ph.label}</span>
                  <span className="text-muted tabular-nums shrink-0 ml-2">
                    {ph.avg === null ? "—" : `${ph.avg}/10`}
                    {ph.samples ? ` · ${ph.samples} session${ph.samples === 1 ? "" : "s"}` : ""}
                  </span>
                </div>
                {ph.tip && <p className="mt-0.5 text-[11px] leading-snug text-muted">{ph.tip}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
