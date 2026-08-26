"use client";

import { useCallback, useEffect, useState } from "react";
import { GraduationCap } from "lucide-react";
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

function TrainingList({ growthAreas, strategies }: { growthAreas: string[]; strategies: string[] }) {
  if (growthAreas.length === 0 && strategies.length === 0) {
    return <p className="text-[11px] text-muted">No trainings yet — they appear as sessions are coached.</p>;
  }
  return (
    <div className="space-y-2 text-[12px]">
      {growthAreas.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted mb-1">Work on</p>
          <ul className="list-disc list-inside text-secondary space-y-0.5">
            {growthAreas.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
        </div>
      )}
      {strategies.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted mb-1">Moves to add</p>
          <ul className="list-disc list-inside text-secondary space-y-0.5">
            {strategies.map((s, i) => (
              <li key={i}>{s}</li>
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
          <TrainingList growthAreas={mine.growthAreas ?? []} strategies={mine.strategies ?? []} />
        </section>
      )}
    </div>
  );
}
