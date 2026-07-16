"use client";

import { useCallback, useEffect, useState } from "react";
import { gradeSkill } from "@/lib/coach/v5/skillGrade";

/**
 * ELOSALES Standard revision (PDF Analytics §B) — the MANAGER view of Standard Analytics:
 * a roster of team members → click a name → that rep's profile (strengths, growth areas, and the six
 * skill scores as letter grades). Standard-only; rendered under isStandard for managers. A rep (non-manager)
 * never sees this — they get their own self-view (A10), unchanged.
 *
 * Framework:
 *  - A18: labels invite coaching — "Strengths" / "Growth areas", grades are targets, never a rank.
 *  - A11: each grade carries its /10 basis; strengths/growth are DERIVED from those countable scores, not a
 *    separate verdict.
 *  - A10: the numbers here are the identical computation the rep sees in their own Analytics.
 *  - §3.5/§3.6: a rep with too little data shows "still accumulating", never a fabricated grade.
 *
 * NOTE (Layer 4): this is a functional, framework-correct surface; visual polish is intentionally restrained
 * and open to iteration.
 */

type Member = { id: string; fullName: string | null; companyRole: string | null; salesCoachRole: "admin" | "staff" | null };
type SkillRow = { key?: string; label: string; score: number | null; breakdown: string };

export function StandardAnalyticsManagerView({ fallback }: { fallback: React.ReactNode }) {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [isManager, setIsManager] = useState<boolean | null>(null);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<Member | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/coach/sales-session/team")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("team read failed"))))
      .then((d) => {
        if (cancelled) return;
        setMembers(d.members ?? []);
        setIsManager(Boolean(d.isManager));
      })
      // §3.4: a failed read is NOT "you're not a manager". Show an honest error, never silently the rep view.
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, []);

  if (error) return <div className="text-sm text-muted">Couldn&apos;t load your team — refresh to try again.</div>;
  if (isManager === null) return <div className="text-sm text-muted">Loading team…</div>;
  // Confirmed non-manager → the rep sees their own self-view (A10).
  if (isManager === false) return <>{fallback}</>;

  if (selected) {
    return <RepProfile member={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <div className="glass-card p-5">
      <h2 className="text-sm font-semibold text-primary mb-1">Your team</h2>
      <p className="text-[11px] text-muted mb-4">
        Open a rep to see their strengths and growth areas — data to coach with, never a ranking.
      </p>
      <div className="flex flex-col divide-y divide-white/5">
        {(members ?? []).map((m) => (
          <button
            key={m.id}
            onClick={() => setSelected(m)}
            className="flex items-center justify-between py-3 text-left hover:opacity-80"
          >
            <span className="text-sm text-primary">{m.fullName ?? "Unnamed rep"}</span>
            <span className="text-[11px] text-muted">
              {m.salesCoachRole ?? m.companyRole ?? ""} →
            </span>
          </button>
        ))}
        {(members ?? []).length === 0 && (
          <p className="py-3 text-sm text-muted">No team members yet.</p>
        )}
      </div>
    </div>
  );
}

function RepProfile({ member, onBack }: { member: Member; onBack: () => void }) {
  const [skills, setSkills] = useState<SkillRow[] | null>(null);
  const [sampleSessions, setSampleSessions] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const r = await fetch(`/api/coach/sales-session/skills?agentId=${encodeURIComponent(member.id)}`);
      if (!r.ok) throw new Error("skills read failed");
      const d = await r.json();
      setSkills(d.skills ?? []);
      setSampleSessions(d.sampleSessions ?? 0);
    } catch {
      // §3.4: a failed read must NOT read as "still accumulating" (an honest-empty). Say it failed.
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [member.id]);

  useEffect(() => { void load(); }, [load]);

  const graded = (skills ?? []).map((s) => ({ ...s, grade: gradeSkill(s.score) }));
  const scored = graded.filter((g) => g.grade.letter !== null);
  // Strengths / growth areas — DERIVED from the same graded scores (A11), labeled to invite coaching (A18).
  const strengths = scored.filter((g) => g.grade.tier === "strong");
  const growthAreas = scored.filter((g) => g.grade.tier === "growth-area" || g.grade.tier === "developing");

  return (
    <div className="glass-card p-5">
      <button onClick={onBack} className="text-[11px] text-muted hover:opacity-80 mb-3">← Team</button>
      <h2 className="text-sm font-semibold text-primary mb-1">{member.fullName ?? "Rep"}</h2>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : error ? (
        <p className="text-sm text-muted">Couldn&apos;t load this rep&apos;s skills — try again.</p>
      ) : scored.length === 0 ? (
        // §3.5/§3.6 honest-empty: not enough sessions yet is not a bad grade.
        <p className="text-sm text-muted">
          Still accumulating — not enough recorded sessions yet to show reliable skill reads.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted mb-1">Strengths</p>
              {strengths.length ? strengths.map((g) => (
                <p key={g.label} className="text-sm text-primary">{g.label} · {g.grade.letter}</p>
              )) : <p className="text-sm text-muted">—</p>}
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted mb-1">Growth areas</p>
              {growthAreas.length ? growthAreas.map((g) => (
                <p key={g.label} className="text-sm text-primary">{g.label} · {g.grade.letter}</p>
              )) : <p className="text-sm text-muted">—</p>}
            </div>
          </div>

          <p className="text-[11px] uppercase tracking-wide text-muted mb-2">Skill grades</p>
          <div className="flex flex-col divide-y divide-white/5">
            {graded.map((g) => (
              <div key={g.label} className="py-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-primary">{g.label}</span>
                  <span className="text-sm text-muted">
                    {g.grade.letter === null
                      ? "— still accumulating"
                      : `${g.grade.letter} · ${g.grade.fromScore}/10`}
                  </span>
                </div>
                {/* A11 — the countable behavior the grade is made of. A manager shown only a letter can do
                    nothing but ACCEPT the System's verdict; the count is what makes the grade coachable (you
                    can talk about it with the rep) and challengeable (the rep can dispute a count, never a
                    letter). A11's line is exact: "the first is a verdict that can be wrong; the second is a
                    count that cannot." Rendering the grade WITHOUT this line hands authority a judgment with
                    its evidence stripped out — the inverse of what A11 asks for. */}
                {g.breakdown && (
                  <p className="mt-1 text-[11px] leading-snug text-secondary">{g.breakdown}</p>
                )}
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted mt-3">
            Across {sampleSessions} recent session{sampleSessions === 1 ? "" : "s"}. Grades summarize the
            countable behavior behind each skill — coaching targets, not a rank.
          </p>
        </>
      )}
    </div>
  );
}
