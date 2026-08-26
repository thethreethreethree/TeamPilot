"use client";

import { useCallback, useState } from "react";
import { ClipboardCheck } from "lucide-react";
import { LoadingButton } from "@/components/sales-coach/ui/LoadingButton";
import type { TeamBriefResult } from "@/lib/coach/v5/teamTrainingBrief"; // type-only (server-only module erased at build)

/**
 * Team Training Brief panel (founder 2026-08-26) — the manager builds a team-level training brief from the last 7
 * days of pooled coaching signal, for the next team meeting. Shared by the Coach Assessment view and the Training
 * tab so there's one source (no drift). Honest states for insufficient signal; per §A18 the per-rep line is a focus,
 * never a ranking.
 */
export function TeamTrainingBriefPanel() {
  const [brief, setBrief] = useState<TeamBriefResult | null>(null);
  const [loading, setLoading] = useState(false);

  const run = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/coach/sales-session/team-training-brief", { method: "POST" });
      setBrief(
        res.ok
          ? ((await res.json()) as TeamBriefResult)
          : { ok: false, reason: "llm_empty", dissectCount: 0, periodLabel: "the last 7 days" },
      );
    } catch {
      setBrief({ ok: false, reason: "llm_empty", dissectCount: 0, periodLabel: "the last 7 days" });
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <section className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4">
      <div className="flex items-center justify-between gap-2 mb-1">
        <h2 className="text-sm font-semibold text-primary">Team training brief</h2>
        <LoadingButton
          pending={loading}
          onClick={() => void run()}
          icon={<ClipboardCheck className="w-3.5 h-3.5" aria-hidden />}
          pendingLabel="Building…"
          className="inline-flex items-center gap-1.5 shrink-0 text-xs font-semibold border border-default text-secondary hover:text-primary px-3 py-1.5 rounded-lg disabled:opacity-50"
        >
          {brief?.ok ? "Rebuild" : "Build for the meeting"}
        </LoadingButton>
      </div>
      <p className="text-[11px] text-muted mb-3">
        A team-wide brief from the last 7 days of coaching — the shared patterns to work on, a drill you can run, and
        one focus per rep.
      </p>
      {brief &&
        (brief.ok ? (
          <TeamBriefCard brief={brief.brief} />
        ) : (
          <p className="text-[11px] text-muted">
            {brief.reason === "insufficient"
              ? "Not enough coached sessions in the last 7 days yet — the brief needs a few dissected calls to find the team's pattern."
              : "Couldn't build a brief from the current signal — try again once more sessions are dissected."}
          </p>
        ))}
    </section>
  );
}

// Renders a generated Team Training Brief — themes, a runnable drill, and a one-line focus per rep. Read-only.
export function TeamBriefCard({ brief }: { brief: Extract<TeamBriefResult, { ok: true }>["brief"] }) {
  return (
    <div className="space-y-3 text-[12px]">
      {brief.themes.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted mb-1">Work on as a team</p>
          <ul className="space-y-1.5">
            {brief.themes.map((t, i) => (
              <li key={i}>
                <span className="font-semibold text-primary">{t.title}.</span>{" "}
                <span className="text-secondary">{t.why}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {brief.drill.title && (
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted mb-1">Run this drill</p>
          <p className="font-semibold text-primary">{brief.drill.title}</p>
          {brief.drill.steps.length > 0 && (
            <ol className="list-decimal list-inside text-secondary space-y-0.5 mt-1">
              {brief.drill.steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          )}
        </div>
      )}
      {brief.repFocus.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted mb-1">One focus each</p>
          <ul className="space-y-1">
            {brief.repFocus.map((r, i) => (
              <li key={i}>
                <span className="font-semibold text-primary">{r.rep}:</span>{" "}
                <span className="text-secondary">{r.focus}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
