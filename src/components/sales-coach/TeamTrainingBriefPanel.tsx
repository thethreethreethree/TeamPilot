"use client";

import { useCallback, useEffect, useState } from "react";
import { ClipboardCheck } from "lucide-react";
import { LoadingButton } from "@/components/sales-coach/ui/LoadingButton";
// type-only (server-only module erased at build)
import type { TeamBriefResult, CachedTeamBrief } from "@/lib/coach/v5/teamTrainingBrief";

type Period = "day" | "week";

/**
 * Team Training Brief panel (founder 2026-08-26; day/week + overnight pre-generation 2026-08-27). The manager opens to
 * the PRE-GENERATED brief (fetched on mount) and can rebuild for the previous day or week. Shared by the Coach
 * Assessment view and the Training tab (one source, no drift). Honest states for insufficient signal; per §A18 the
 * per-rep line is a focus, never a ranking.
 */
export function TeamTrainingBriefPanel() {
  const [brief, setBrief] = useState<TeamBriefResult | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>("week");
  const [loading, setLoading] = useState(false);

  // Show the pre-generated brief the overnight cron cached, so the manager opens to a ready brief (no Build click).
  useEffect(() => {
    let alive = true;
    fetch("/api/coach/sales-session/team-training-brief")
      .then((r) => (r.ok ? r.json() : { cached: null }))
      .then((d: { cached: CachedTeamBrief | null }) => {
        if (!alive || !d?.cached) return;
        setBrief(d.cached.result);
        setGeneratedAt(d.cached.generatedAt || null);
        setPeriod(d.cached.periodDays <= 1 ? "day" : "week");
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const run = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/coach/sales-session/team-training-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period }),
      });
      const fallbackLabel = period === "day" ? "the last day" : "the last 7 days";
      setBrief(
        res.ok
          ? ((await res.json()) as TeamBriefResult)
          : { ok: false, reason: "llm_empty", dissectCount: 0, periodLabel: fallbackLabel },
      );
      setGeneratedAt(null); // freshly built now, not from the cache
    } catch {
      setBrief({ ok: false, reason: "llm_empty", dissectCount: 0, periodLabel: period === "day" ? "the last day" : "the last 7 days" });
    } finally {
      setLoading(false);
    }
  }, [period]);

  const readyNote = (() => {
    if (!generatedAt) return null;
    const d = new Date(generatedAt);
    if (Number.isNaN(d.getTime())) return null;
    return `Ready — generated ${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })} at ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
  })();

  return (
    <section className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4">
      <div className="flex items-center justify-between gap-2 mb-1">
        <h2 className="text-sm font-semibold text-primary">Team training brief</h2>
        <div className="flex items-center gap-2 shrink-0">
          {/* Day / week look-back toggle (founder 2026-08-27). Sets the window the next build looks over. */}
          <div className="inline-flex rounded-lg border border-default overflow-hidden text-[11px] font-semibold">
            {(["day", "week"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                aria-pressed={period === p}
                className={`px-2.5 py-1.5 transition-colors ${period === p ? "bg-white/10 text-primary" : "text-muted hover:text-primary"}`}
              >
                {p === "day" ? "Day" : "Week"}
              </button>
            ))}
          </div>
          <LoadingButton
            pending={loading}
            onClick={() => void run()}
            icon={<ClipboardCheck className="w-3.5 h-3.5" aria-hidden />}
            pendingLabel="Building…"
            className="inline-flex items-center gap-1.5 text-xs font-semibold border border-default text-secondary hover:text-primary px-3 py-1.5 rounded-lg disabled:opacity-50"
          >
            {brief?.ok ? "Rebuild" : "Build"}
          </LoadingButton>
        </div>
      </div>
      <p className="text-[11px] text-muted mb-3">
        A team-wide brief from {period === "day" ? "the last day" : "the last 7 days"} of coaching — the shared patterns
        to work on, a drill you can run, and one focus per rep. {readyNote && <span className="text-brand/80">· {readyNote}</span>}
      </p>
      {brief &&
        (brief.ok ? (
          <TeamBriefCard brief={brief.brief} />
        ) : (
          <p className="text-[11px] text-muted">
            {brief.reason === "insufficient"
              ? "Not enough coached sessions in this window yet — the brief needs a few dissected calls to find the team's pattern."
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
