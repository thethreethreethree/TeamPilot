"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

/**
 * CalibrationTool — Phase 6. A manager hand-scores a transcript BLIND on the five judged dimensions, submits, then
 * sees the model's scores + the running agreement report. It answers the honest question the leaderboard depends
 * on: does the score measure what it claims, before ranks affect anyone? Transcripts are anonymized (no rep name).
 */

const DIMS = [
  { key: "opener", label: "Opening & Rapport" },
  { key: "objection", label: "Objection Handling" },
  { key: "tone", label: "Tone" },
  { key: "close", label: "Close" },
  { key: "next_step", label: "Advance / Next Step" },
] as const;
type DimKey = (typeof DIMS)[number]["key"];
type Scores = Record<DimKey, number>;

type DimResult = { dimension: DimKey; n: number; meanAbsDiff: number | null; trustworthy: boolean | null };
type Report = {
  n: number;
  perDimension: DimResult[];
  worstDisagreements: { sessionId: string; dimension: string; human: number; model: number; diff: number }[];
  overallTrustworthy: boolean | null;
};
type Data = { report: Report; scored: number; pool: number; next: { sessionId: string; transcript: string } | null };

const EMPTY: Scores = { opener: 5, objection: 5, tone: 5, close: 5, next_step: 5 };

export function CalibrationTool() {
  const [data, setData] = useState<Data | null>(null);
  const [scores, setScores] = useState<Scores>(EMPTY);
  const [reveal, setReveal] = useState<{ human: Scores; model: Partial<Scores> } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setReveal(null);
    setScores(EMPTY);
    try {
      const res = await fetch("/api/coach/gamification/calibration");
      if (res.ok) setData((await res.json()) as Data);
    } catch {
      /* transient */
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const submit = useCallback(async () => {
    if (!data?.next || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/coach/gamification/calibration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: data.next.sessionId, scores }),
      });
      if (res.ok) {
        const d = (await res.json()) as { model: Partial<Scores> };
        setReveal({ human: scores, model: d.model });
      }
    } finally {
      setBusy(false);
    }
  }, [data, scores, busy]);

  if (!data) return <div className="flex items-center gap-2 p-8 text-sm text-muted"><Loader2 className="animate-spin" size={16} /> Loading…</div>;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5 p-6">
      <div>
        <h1 className="text-xl font-semibold text-primary">Score calibration</h1>
        <p className="mt-1 text-sm text-secondary">
          Score each transcript yourself, then compare to the AI. This checks the score is trustworthy before it drives
          the leaderboard. {data.scored} of ~20 done ({data.pool} available).
        </p>
      </div>

      {/* Report so far */}
      {data.report.n > 0 && (
        <div className="rounded-xl border border-default bg-surface p-4">
          <div className="mb-2 flex items-center gap-2">
            {data.report.overallTrustworthy ? (
              <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400"><CheckCircle2 size={16} /> Agreeing so far</span>
            ) : (
              <span className="flex items-center gap-1.5 text-sm font-medium text-amber-600 dark:text-amber-400"><AlertTriangle size={16} /> Some dimensions disagree</span>
            )}
            <span className="text-xs text-muted">across {data.report.n} scored</span>
          </div>
          <div className="flex flex-col gap-1">
            {data.report.perDimension.filter((d) => d.meanAbsDiff !== null).map((d) => (
              <div key={d.dimension} className="flex items-center justify-between text-sm">
                <span className="text-secondary">{DIMS.find((x) => x.key === d.dimension)?.label ?? d.dimension}</span>
                <span className={d.trustworthy ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}>
                  ±{d.meanAbsDiff} {d.trustworthy ? "" : "⚠"}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-muted">±diff is how far the AI is from you on average (0–10 scale). Above 1.5 (⚠) means that dimension needs another look.</p>
        </div>
      )}

      {/* Scoring */}
      {data.next ? (
        <div className="rounded-xl border border-default bg-surface p-4">
          <h2 className="mb-2 text-sm font-semibold text-primary">Transcript (anonymized)</h2>
          <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-lg border border-default bg-base/40 p-3 text-xs leading-relaxed text-secondary">{data.next.transcript}</pre>

          {!reveal ? (
            <>
              <p className="mt-4 mb-1 text-sm font-medium text-primary">Your scores (0–10)</p>
              {DIMS.map((d) => (
                <div key={d.key} className="flex items-center gap-3 py-1">
                  <label className="flex-1 text-sm text-secondary">{d.label}</label>
                  <input
                    type="range" min={0} max={10} value={scores[d.key]}
                    onChange={(e) => setScores((s) => ({ ...s, [d.key]: Number(e.target.value) }))}
                    className="w-40"
                  />
                  <span className="w-6 text-right text-sm font-semibold tabular-nums text-primary">{scores[d.key]}</span>
                </div>
              ))}
              <button onClick={submit} disabled={busy} className="mt-3 w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                {busy ? "Saving…" : "Submit & compare"}
              </button>
            </>
          ) : (
            <div className="mt-4">
              <p className="mb-2 text-sm font-medium text-primary">You vs the AI</p>
              {DIMS.map((d) => {
                const h = reveal.human[d.key], m = reveal.model[d.key];
                const diff = typeof m === "number" ? Math.abs(h - m) : null;
                return (
                  <div key={d.key} className="flex items-center justify-between py-1 text-sm">
                    <span className="text-secondary">{d.label}</span>
                    <span className="flex items-center gap-3">
                      <span className="text-muted">you {h}</span>
                      <span className="text-muted">AI {m ?? "—"}</span>
                      {diff !== null && <span className={`w-8 text-right ${diff <= 1.5 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>±{diff}</span>}
                    </span>
                  </div>
                );
              })}
              <button onClick={load} className="mt-3 w-full rounded-lg border border-default px-4 py-2 text-sm font-medium text-primary hover:bg-white/5">
                Next transcript →
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-default bg-surface p-6 text-sm text-muted">
          No more transcripts to score right now. {data.report.n > 0 ? "The report above reflects what you've scored." : "Come back once more sessions have been reviewed."}
        </div>
      )}
    </div>
  );
}
