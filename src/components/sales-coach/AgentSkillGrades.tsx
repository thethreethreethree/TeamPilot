"use client";

import { useCallback, useEffect, useState } from "react";
import { gradeSkill } from "@/lib/coach/v5/skillGrade";

/**
 * AgentSkillGrades — compact per-agent letter grades for the Coach Assessment roster (Standard).
 *
 * Founder decision 2026-07-21: on Coach Assessment in Standard, a rep's performance shows as the same
 * A+/A- letter grades used on the web Analytics per-rep profiles — NOT the 1500 ELO (A21 parity: a rep
 * looks the same on every manager surface). Expert still shows the ELO badge; this is Standard-only.
 *
 * Mirrors the RepProfile fetch (StandardAnalyticsManagerView): GET /skills?agentId — the route enforces
 * manager+company access. A18: labeled by skill, never ranked. §3.4: a failed read says so; an honest-empty
 * ("still accumulating") is distinct from a low grade.
 */
type SkillRow = { key: string; label: string; score: number | null };

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
    return <p className="text-[11px] text-muted">Loading skills…</p>;
  if (state === "error")
    return <p className="text-[11px] text-muted">Skill read unavailable — retry.</p>;
  if (state === "empty")
    return (
      <p className="text-[11px] text-muted">
        Still accumulating — not enough scored calls yet.
      </p>
    );

  return (
    <div className="flex flex-wrap gap-1.5">
      {(skills ?? []).map((s) => {
        const g = gradeSkill(s.score);
        return (
          <span
            key={s.key}
            className="inline-flex items-center gap-1 rounded-md border border-white/[0.07] bg-white/[0.02] px-2 py-0.5 text-[11px]"
          >
            <span className="text-muted">{s.label}</span>
            <span className="font-semibold text-primary tabular-nums">
              {g.letter ?? "—"}
            </span>
          </span>
        );
      })}
    </div>
  );
}
