"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { GraduationCap, Dumbbell, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { TeamTrainingBriefPanel } from "@/components/sales-coach/TeamTrainingBriefPanel";
// Type-only (the module is server-only — erased at build, so no runtime import of it into this client page).
import type { RepPracticeSummary, ManagerPracticeSummary, TeamPracticeSummary } from "@/lib/coach/v5/practiceAnalytics";

/**
 * /dashboard/sales-coach/training — the Training tab (founder 2026-08-26).
 * Managers see the team training brief + each rep's specified trainings + practice growth; a rep sees their OWN
 * trainings + practice trend on their portal. "Trainings" for a rep = the growth areas + strategy gaps drawn from
 * their own Dissects. Practice growth (§A18): the manager sees a rep's activity + growth DIRECTION, never a ranking.
 */

type RepTraining = {
  agentId: string;
  agentName: string;
  dissectCount: number;
  growthAreas: string[];
  strategies: string[];
  practice?: ManagerPracticeSummary | null;
};
type Mine = {
  dissectCount: number;
  growthAreas: string[];
  strategies: string[];
  strengths: string[];
  practice?: RepPracticeSummary;
};

// Trend chip — a growth DIRECTION, not a rank (§A18). Up = improving, down = slipping, flat = holding.
function TrendChip({ trend }: { trend: "up" | "flat" | "down" | null }) {
  if (trend === "up")
    return <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400"><TrendingUp className="w-3 h-3" aria-hidden />improving</span>;
  if (trend === "down")
    return <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-400"><TrendingDown className="w-3 h-3" aria-hidden />slipping</span>;
  if (trend === "flat")
    return <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-muted"><Minus className="w-3 h-3" aria-hidden />holding</span>;
  return null;
}

// Team practice rollup (founder's team-level meeting data). Pure aggregate — how much the team is practicing and which
// way it's moving — no individual named (§A18-safest). Honest empty when nobody has practiced.
function TeamPracticeCard({ team }: { team: TeamPracticeSummary }) {
  if (team.activeReps === 0) {
    return (
      <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
        <h2 className="text-sm font-semibold text-primary mb-1">Team practice</h2>
        <p className="text-[11px] text-muted">No one has practiced yet — it fills in as reps drill their focuses.</p>
      </section>
    );
  }
  const Stat = ({ n, label }: { n: string; label: string }) => (
    <div className="flex-1 min-w-0">
      <div className="text-lg font-bold text-primary tabular-nums leading-none">{n}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted mt-1">{label}</div>
    </div>
  );
  return (
    <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
      <h2 className="text-sm font-semibold text-primary mb-3">Team practice</h2>
      <div className="flex items-start gap-3">
        <Stat n={String(team.totalAttempts)} label="Practices" />
        <Stat n={String(team.activeReps)} label="Reps practising" />
        {team.avgLatest !== null && <Stat n={`${team.avgLatest}`} label="Avg score" />}
        <Stat n={`${team.improving}`} label="Improving" />
        {team.slipping > 0 && <Stat n={`${team.slipping}`} label="Slipping" />}
      </div>
    </section>
  );
}

// Manager's per-rep practice line — activity + growth direction, UNRANKED (§A18). Never shows a bare leaderboard score.
function ManagerPracticeLine({ practice }: { practice?: ManagerPracticeSummary | null }) {
  if (!practice || practice.attempts === 0) {
    return <p className="text-[10px] text-muted mt-1">No practice yet.</p>;
  }
  return (
    <div className="flex items-center gap-2 mt-1 text-[10px] text-muted">
      <Dumbbell className="w-3 h-3 shrink-0" aria-hidden />
      <span>{practice.attempts} practice{practice.attempts === 1 ? "" : "s"}</span>
      {practice.latest !== null && <span className="text-secondary">· latest {practice.latest}/100</span>}
      {practice.trend && <TrendChip trend={practice.trend} />}
    </div>
  );
}

// The rep's own practice trend — per-skill latest score + direction (self-data). Honest empty when they've not practiced.
function MyPractice({ practice }: { practice?: RepPracticeSummary }) {
  if (!practice || practice.totalAttempts === 0) {
    return (
      <p className="text-[11px] text-muted">
        No practice yet — hit Practice on a focus above to drill it and start your trend.
      </p>
    );
  }
  return (
    <div className="space-y-2 text-[12px]">
      <div className="flex items-center gap-2">
        <span className="text-secondary">{practice.totalAttempts} practice{practice.totalAttempts === 1 ? "" : "s"}</span>
        {practice.latest !== null && <span className="text-primary font-semibold">latest {practice.latest}/100</span>}
        {practice.trend && <TrendChip trend={practice.trend} />}
      </div>
      {practice.byFocus.length > 0 && (
        <ul className="space-y-1">
          {practice.byFocus.map((f, i) => (
            <li key={i} className="flex items-start justify-between gap-2">
              <span className="text-secondary min-w-0">{f.focus}</span>
              <span className="shrink-0 inline-flex items-center gap-1.5">
                {f.latest !== null ? (
                  <span className="text-primary font-semibold tabular-nums">{f.latest}</span>
                ) : (
                  // Drilled but never executed the skill — honest, not a fabricated 0 (§3.4).
                  <span className="text-[10px] text-muted">not applied yet</span>
                )}
                <TrendChip trend={f.latest !== null && f.attempts >= 2 ? f.trend : null} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// A single focus line. In the rep's own view it's practiceable — a "Practice" link seeds the roleplay with this exact
// skill (?focus=...) so the rep drills it against the AI prospect and gets scored on it (founder 2026-08-26).
function FocusItem({ text, practiceable }: { text: string; practiceable: boolean }) {
  if (!practiceable) return <li className="text-secondary">{text}</li>;
  return (
    <li className="flex items-start justify-between gap-2 group">
      <span className="text-secondary">{text}</span>
      <Link
        href={`/dashboard/sales-coach/roleplay?focus=${encodeURIComponent(text)}`}
        className="shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold text-brand/80 hover:text-brand border border-ember-400/30 hover:border-ember-400/60 rounded-md px-1.5 py-0.5 transition-colors"
        title="Practice this against the AI prospect"
      >
        <Dumbbell className="w-3 h-3" aria-hidden />
        Practice
      </Link>
    </li>
  );
}

function TrainingList({
  growthAreas,
  strategies,
  practiceable = false,
}: {
  growthAreas: string[];
  strategies: string[];
  practiceable?: boolean;
}) {
  if (growthAreas.length === 0 && strategies.length === 0) {
    return <p className="text-[11px] text-muted">No trainings yet — they appear as sessions are coached.</p>;
  }
  return (
    <div className="space-y-2 text-[12px]">
      {growthAreas.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted mb-1">Work on</p>
          <ul className={`space-y-1 ${practiceable ? "" : "list-disc list-inside"}`}>
            {growthAreas.map((g, i) => (
              <FocusItem key={i} text={g} practiceable={practiceable} />
            ))}
          </ul>
        </div>
      )}
      {strategies.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted mb-1">Moves to add</p>
          <ul className={`space-y-1 ${practiceable ? "" : "list-disc list-inside"}`}>
            {strategies.map((s, i) => (
              <FocusItem key={i} text={s} practiceable={practiceable} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function TrainingPage() {
  const [mode, setMode] = useState<"loading" | "manager" | "rep" | "error">("loading");
  const [team, setTeam] = useState<RepTraining[]>([]);
  const [teamPractice, setTeamPractice] = useState<TeamPracticeSummary | null>(null);
  const [mine, setMine] = useState<Mine | null>(null);
  const [error, setError] = useState(false);

  const fail = useCallback(() => {
    setError(true);
    setMode("error"); // never leave the page stuck on "Loading…" behind the error banner (F3)
  }, []);

  const load = useCallback(async () => {
    try {
      // Managers can read the team; ONLY a 403 (not a manager) falls back to the rep's own trainings. A 5xx / network
      // error must NOT silently downgrade a real manager to the rep view (F2) — it's an error, shown as one.
      const res = await fetch("/api/coach/sales-session/coach-assessment").catch(() => null);
      if (res && res.ok) {
        const d = await res.json();
        if (d.degraded) fail();
        else {
          setTeam(((d.team ?? []) as RepTraining[]).filter((r) => r.growthAreas?.length || r.strategies?.length || r.dissectCount));
          setTeamPractice((d.teamPractice as TeamPracticeSummary | undefined) ?? null);
          setMode("manager");
        }
        return;
      }
      if (!res || res.status !== 403) {
        fail(); // a transient/server error — not a rep, so don't show the rep view
        return;
      }
      // 403 → not a manager → the rep portal: their own trainings.
      const meRes = await fetch("/api/coach/sales-session/my-training").catch(() => null);
      if (meRes && meRes.ok) {
        const d = await meRes.json();
        if (d.degraded) fail();
        else {
          setMine(d as Mine);
          setMode("rep");
        }
      } else {
        fail();
      }
    } catch {
      fail();
    }
  }, [fail]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <header className="flex items-center gap-2">
        <GraduationCap className="w-5 h-5 text-primary" aria-hidden />
        <div>
          <h1 className="text-base font-semibold text-primary">Training</h1>
          <p className="text-[11px] text-muted">
            {mode === "rep" ? "Your training focuses, from your own coached sessions." : "Team training + each rep's focuses."}
          </p>
        </div>
      </header>

      {error && (
        <p className="text-[11px] text-muted">Couldn't load training right now — please refresh.</p>
      )}

      {mode === "loading" && <p className="text-[11px] text-muted">Loading…</p>}

      {mode === "manager" && (
        <>
          <TeamTrainingBriefPanel />
          {teamPractice && <TeamPracticeCard team={teamPractice} />}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-primary">Per-rep trainings</h2>
            {team.length === 0 ? (
              <p className="text-[11px] text-muted">No rep trainings yet — they appear as the team's sessions are coached.</p>
            ) : (
              team.map((r) => (
                <div key={r.agentId} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-primary">{r.agentName}</h3>
                    <span className="text-[10px] text-muted">{r.dissectCount} session{r.dissectCount === 1 ? "" : "s"}</span>
                  </div>
                  <TrainingList growthAreas={r.growthAreas ?? []} strategies={r.strategies ?? []} />
                  <ManagerPracticeLine practice={r.practice} />
                </div>
              ))
            )}
          </section>
        </>
      )}

      {mode === "rep" && mine && (
        <>
          <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
            <h2 className="text-sm font-semibold text-primary mb-2">Your trainings</h2>
            <p className="text-[11px] text-muted mb-3">
              Each is a skill from your coached calls — hit Practice to drill it against the AI prospect and get scored.
            </p>
            <TrainingList growthAreas={mine.growthAreas ?? []} strategies={mine.strategies ?? []} practiceable />
          </section>
          <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
            <h2 className="text-sm font-semibold text-primary mb-2">Your practice</h2>
            <MyPractice practice={mine.practice} />
          </section>
        </>
      )}
    </div>
  );
}
