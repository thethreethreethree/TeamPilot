"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { GraduationCap, Dumbbell } from "lucide-react";
import { TeamTrainingBriefPanel } from "@/components/sales-coach/TeamTrainingBriefPanel";

/**
 * /dashboard/sales-coach/training — the Training tab (founder 2026-08-26).
 * Managers see the team training brief + each rep's specified trainings; a rep sees their OWN trainings on their
 * portal. "Trainings" for a rep = the growth areas + strategy gaps drawn from their own Dissects (what to work on).
 * The interactive practice engine (materials / exercises / AI feedback) is the founder-chosen NEXT slice.
 */

type RepTraining = {
  agentId: string;
  agentName: string;
  dissectCount: number;
  growthAreas: string[];
  strategies: string[];
};
type Mine = { dissectCount: number; growthAreas: string[]; strategies: string[]; strengths: string[] };

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
  const [mode, setMode] = useState<"loading" | "manager" | "rep">("loading");
  const [team, setTeam] = useState<RepTraining[]>([]);
  const [mine, setMine] = useState<Mine | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      // Managers can read the team; reps get 403 → fall back to their own trainings.
      const res = await fetch("/api/coach/sales-session/coach-assessment").catch(() => null);
      if (res && res.ok) {
        const d = await res.json();
        if (d.degraded) setError(true);
        else {
          setTeam(((d.team ?? []) as RepTraining[]).filter((r) => r.growthAreas?.length || r.strategies?.length || r.dissectCount));
          setMode("manager");
        }
        return;
      }
      // Rep portal — their own trainings.
      const meRes = await fetch("/api/coach/sales-session/my-training").catch(() => null);
      if (meRes && meRes.ok) {
        const d = await meRes.json();
        if (d.degraded) setError(true);
        else {
          setMine(d as Mine);
          setMode("rep");
        }
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    }
  }, []);

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
                </div>
              ))
            )}
          </section>
        </>
      )}

      {mode === "rep" && mine && (
        <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
          <h2 className="text-sm font-semibold text-primary mb-2">Your trainings</h2>
          <p className="text-[11px] text-muted mb-3">
            Each is a skill from your coached calls — hit Practice to drill it against the AI prospect and get scored.
          </p>
          <TrainingList growthAreas={mine.growthAreas ?? []} strategies={mine.strategies ?? []} practiceable />
        </section>
      )}
    </div>
  );
}
