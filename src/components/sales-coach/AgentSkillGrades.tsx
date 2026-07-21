"use client";

import { useCallback, useEffect, useState } from "react";
import { gradeSkill, type SkillGrade } from "@/lib/coach/v5/skillGrade";

/**
 * AgentSkillGrades — the per-agent LETTER-GRADE view for the Coach Assessment roster (Standard).
 *
 * Founder decision 2026-07-21: on Coach Assessment in Standard, a rep's performance shows as the A+/A- letter
 * grades used on the web Analytics per-rep profiles — NOT the 1500 ELO (A21 parity: a rep reads the same on
 * every manager surface). Expert keeps the ELO badge; this is Standard-only.
 *
 * Restructured 2026-07-21 (founder: "restructure the user View to reflect the Letter grade system") from a row of
 * small inline chips into a prominent grade GRID — each skill is a large, tier-coloured letter with its label and
 * the /10 it summarizes. This gives the letter grades the visual weight the ELO gauge had in Expert, so the page
 * reads AS a letter-grade system.
 *
 * DELIBERATELY no single "overall grade": §A18 warns a lone prominent grade invites RANKING, which this page
 * refuses (cards stay alphabetical, never sorted by score). Per-skill grades are coaching targets, not a rank.
 * Each letter travels WITH its /10 basis (A11 — the countable fact rides with the verdict) and a coaching-framed
 * tier colour (A18 — strong/solid/developing/growth-area; there is deliberately no "F"). §3.4: a failed read
 * says so; an honest-empty ("still accumulating") is distinct from a low grade — a null score never becomes a
 * bad letter.
 */
type SkillRow = { key: string; label: string; score: number | null };

/** Coaching-framed colour for a grade tier (A18): strong≈emerald, solid/developing≈brand, growth-area≈amber. */
function tierColor(tier: SkillGrade["tier"]): string {
  switch (tier) {
    case "strong":
      return "text-emerald-400";
    case "solid":
      return "text-ember-300";
    case "developing":
      return "text-ember-200";
    case "growth-area":
      return "text-amber-400";
    default:
      return "text-muted";
  }
}

export function AgentSkillGrades({ agentId }: { agentId: string }) {
  const [skills, setSkills] = useState<SkillRow[] | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "empty" | "error">("loading");

  const load = useCallback(async () => {
    setState("loading");
    try {
      const r = await fetch(
        `/api/coach/sales-session/skills?agentId=${encodeURIComponent(agentId)}`
      );
      if (!r.ok) throw new Error("skills read failed");
      const d = await r.json();
      const rows: SkillRow[] = d.skills ?? [];
      setSkills(rows);
      setState(rows.some((s) => s.score !== null) ? "ok" : "empty");
    } catch {
      setState("error");
    }
  }, [agentId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (state === "loading")
    return <p className="text-[11px] text-muted">Loading skill grades…</p>;
  if (state === "error")
    return <p className="text-[11px] text-muted">Skill grades unavailable — retry.</p>;
  if (state === "empty")
    return (
      <p className="text-[11px] text-muted">
        Still accumulating — not enough scored calls for grades yet.
      </p>
    );

  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-muted mb-2">
        Skill grades
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {(skills ?? []).map((s) => {
          const g = gradeSkill(s.score);
          return (
            <div
              key={s.key}
              className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2"
            >
              <div className="text-[10px] text-muted truncate" title={s.label}>
                {s.label}
              </div>
              <div className="flex items-baseline gap-1.5">
                <span
                  className={`text-2xl font-bold leading-none tabular-nums ${tierColor(g.tier)}`}
                >
                  {g.letter ?? "—"}
                </span>
                {g.fromScore !== null && (
                  <span className="text-[10px] text-muted tabular-nums">
                    {g.fromScore.toFixed(1)}/10
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
