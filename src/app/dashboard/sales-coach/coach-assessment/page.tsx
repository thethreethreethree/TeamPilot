"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  Lock,
  ClipboardCheck,
  ThumbsUp,
  Lightbulb,
  Star,
} from "lucide-react";
import TopBar from "@/components/layout/TopBar";

/**
 * Sales Coach → Coach Assessment (admin). Per-agent coaching signal pulled
 * from each agent's own Dissect evaluations: what they're doing well and
 * where to grow. §A18/§A10 — FOR COACHING, not a scoreboard: no scores, no
 * ranking, no cross-agent comparison; each agent measured against their own
 * conversations; alphabetical order. §3.4 — real text from the dissects.
 */

type AgentAssessment = {
  agentId: string;
  agentName: string;
  dissectCount: number;
  strengths: string[];
  growthAreas: string[];
  strategies: string[];
  lastAt: string | null;
};

export default function CoachAssessmentPage() {
  const [team, setTeam] = useState<AgentAssessment[] | null>(null);
  const [isManager, setIsManager] = useState(true);
  const [loading, setLoading] = useState(true);
  // §3.4: a server-side query failure is shown as an honest error, NOT as
  // an empty team (which would be indistinguishable from "no assessments").
  const [degraded, setDegraded] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillMsg, setBackfillMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        "/api/coach/sales-session/coach-assessment"
      ).catch(() => null);
      if (res && res.ok) {
        const d = await res.json();
        if (d.degraded) {
          setDegraded(true);
        } else {
          setTeam(d.team ?? []);
        }
      } else if (res && res.status === 403) {
        setIsManager(false);
      } else {
        setDegraded(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Backfill: regenerate dissects for sessions that have a transcript but no
  // dissect yet (the M3 safety net). Batched — run until "0 remaining".
  const runBackfill = useCallback(async () => {
    setBackfilling(true);
    setBackfillMsg(null);
    try {
      const res = await fetch(
        "/api/coach/sales-session/backfill-dissects",
        { method: "POST" }
      );
      if (!res.ok) throw new Error(`failed (${res.status})`);
      const d = await res.json();
      setBackfillMsg(
        `Generated ${d.generated ?? 0}${d.thinOrFailed ? `, ${d.thinOrFailed} too thin/failed` : ""}. ${d.remaining ?? 0} still missing.`
      );
      await load();
    } catch {
      setBackfillMsg("Backfill failed — try again.");
    } finally {
      setBackfilling(false);
    }
  }, [load]);

  const withContent = (team ?? []).filter((a) => a.dissectCount > 0);
  const noContent = (team ?? []).filter((a) => a.dissectCount === 0);

  return (
    <>
      <TopBar title="Coach Assessment" subtitle="How the team is growing" />
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 max-w-4xl mx-auto w-full space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-muted py-12 justify-center">
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
            Loading…
          </div>
        ) : degraded ? (
          <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-4">
            <p className="text-xs text-amber-300">
              Couldn&apos;t load the team assessment right now — this is an
              error, not an empty team. Try again shortly.
            </p>
          </div>
        ) : !isManager ? (
          <div className="rounded-xl border border-default bg-white/[0.01] p-5">
            <div className="inline-flex items-center gap-1.5 text-[11px] text-muted rounded-md border border-default px-2 py-1 mb-3">
              <Lock className="w-3 h-3" aria-hidden />
              Admin only
            </div>
            <h2 className="text-sm font-semibold text-primary mb-1">
              Coach Assessment is admin-only
            </h2>
            <p className="text-xs text-secondary leading-relaxed">
              This is the admin&apos;s coaching overview of the team. Your own
              growth lives under Analytics.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-2 rounded-lg border border-ember-400/30 bg-ember-400/5 p-3">
              <ClipboardCheck className="w-4 h-4 text-brand shrink-0 mt-0.5" aria-hidden />
              <p className="text-xs text-secondary leading-relaxed">
                Each person&apos;s coaching signal from their own conversations —
                auto-built from their Dissects when sessions end.{" "}
                <span className="text-primary">For coaching, not ranking</span>:
                everyone is measured against their own growth, never each other.
              </p>
            </div>

            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] text-muted">
                {backfillMsg ??
                  "Regenerate any dissects that didn't auto-generate (e.g. a closed tab)."}
              </p>
              <button
                type="button"
                onClick={() => void runBackfill()}
                disabled={backfilling}
                className="inline-flex items-center gap-1.5 shrink-0 text-xs font-semibold border border-default text-secondary hover:text-primary px-3 py-1.5 rounded-lg disabled:opacity-50"
              >
                {backfilling ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
                ) : (
                  <ClipboardCheck className="w-3.5 h-3.5" aria-hidden />
                )}
                {backfilling ? "Generating…" : "Generate missing"}
              </button>
            </div>

            {withContent.length === 0 && (
              <p className="text-xs text-muted py-8 text-center">
                No assessments yet. They appear here as the team finishes
                sessions (each completed session is dissected automatically).
              </p>
            )}

            {withContent.map((a) => (
              <section
                key={a.agentId}
                className="rounded-xl border border-default bg-white/[0.01] p-4"
              >
                <div className="flex items-center justify-between gap-2 mb-3">
                  <h2 className="text-sm font-semibold text-primary">
                    {a.agentName}
                  </h2>
                  <span className="text-[10px] text-muted">
                    {a.dissectCount} session{a.dissectCount === 1 ? "" : "s"} dissected
                  </span>
                </div>

                {a.strategies.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    {a.strategies.map((s, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 text-[10px] text-brand border border-ember-400/40 bg-ember-400/[0.06] rounded-full px-2 py-0.5"
                      >
                        <Star className="w-2.5 h-2.5" aria-hidden />
                        {s}
                      </span>
                    ))}
                  </div>
                )}

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <p className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-emerald-300 font-bold mb-2">
                      <ThumbsUp className="w-3 h-3" aria-hidden />
                      Doing well
                    </p>
                    {a.strengths.length === 0 ? (
                      <p className="text-[11px] text-muted">—</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {a.strengths.map((s, i) => (
                          <li key={i} className="text-xs text-secondary leading-relaxed">
                            {s}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <p className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-amber-300 font-bold mb-2">
                      <Lightbulb className="w-3 h-3" aria-hidden />
                      Coaching focus
                    </p>
                    {a.growthAreas.length === 0 ? (
                      <p className="text-[11px] text-muted">—</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {a.growthAreas.map((g, i) => (
                          <li key={i} className="text-xs text-secondary leading-relaxed">
                            {g}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </section>
            ))}

            {noContent.length > 0 && (
              <p className="text-[11px] text-muted">
                No sessions yet:{" "}
                {noContent.map((a) => a.agentName).join(", ")}.
              </p>
            )}
          </>
        )}
      </div>
    </>
  );
}
