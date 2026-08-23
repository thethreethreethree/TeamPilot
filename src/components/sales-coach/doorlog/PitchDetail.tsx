"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, AlertTriangle } from "lucide-react";

/**
 * Per-pitch detail (Macro Mode Report Card drill-down): transcript + per-pitch analysis (summary,
 * strengths, improvements, scores). Read-only; a failed pitch shows the honest failure here (never the
 * Door Log). Reuses the same rubric dimensions the rest of the Sales Coach scores against.
 */
type Detail = {
  id: string;
  name: string;
  status: string;
  error: string | null;
  recordedAt: string;
  outcome: string;
  transcript: string | null;
  analysis: {
    summary: string;
    strengths: string[];
    improvements: string[];
    scores: Record<string, number>;
  } | null;
};

export function PitchDetail({ pitchId }: { pitchId: string }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  // Error-as-no-data fix (audit F4, 2026-08-23): only a real 404 is "not available". A 500 / network drop must
  // NOT collapse into the permanent no-data state (the honesty class the sibling surfaces already handle —
  // PitchPerformance/TodaysMetrics set an explicit error + Retry). Distinct `loadError` → an honest, retryable card.
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setNotFound(false);
    setLoadError(false);
    try {
      const r = await fetch(`/api/coach/sales-session/report-card/${pitchId}`);
      if (r.status === 404) {
        setNotFound(true);
        return;
      }
      if (!r.ok) {
        setLoadError(true);
        return;
      }
      setDetail(await r.json());
    } catch {
      setLoadError(true); // network drop / parse throw → error, not "missing pitch"
    } finally {
      setLoading(false);
    }
  }, [pitchId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-base px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-6 max-w-2xl mx-auto w-full">
      {/* Back link: below the status-bar safe area (was under the clock and untappable), with a real tap target. */}
      <Link
        href="/dashboard/sales-coach/doors/report-card"
        className="inline-flex items-center gap-1.5 -ml-2 px-2 py-2 rounded-lg text-sm font-medium text-secondary hover:text-primary active:bg-white/5 transition-colors mb-3"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden /> Pitch Performance
      </Link>

      {loadError ? (
        <div className="glass-card p-4 border border-red-500/30">
          <p className="text-sm text-red-300">
            Couldn&apos;t load this pitch — this is an error, not a missing pitch. Check your connection and try again.
          </p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-3 text-sm font-semibold text-brand hover:underline"
          >
            Retry
          </button>
        </div>
      ) : loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : notFound || !detail ? (
        <p className="text-sm text-muted">This pitch isn&apos;t available.</p>
      ) : (
        <>
          <h1 className="text-xl font-bold text-primary">{detail.name}</h1>
          <p className="text-xs text-muted mb-5">
            {new Date(detail.recordedAt).toLocaleString()} · {detail.outcome}
          </p>

          {detail.status === "failed" ? (
            <div className="glass-card p-4 mb-5 border border-red-500/30">
              <p className="flex items-center gap-2 text-sm text-red-400 font-semibold">
                <AlertTriangle className="w-4 h-4" aria-hidden /> Processing failed
              </p>
              <p className="text-xs text-secondary mt-1">
                {detail.error ?? "This pitch couldn't be analyzed."}
              </p>
            </div>
          ) : !detail.analysis ? (
            detail.status === "complete" ? (
              // Honest state for a completed pitch with no analysis row (audit H3): the data write failed at some
              // point. NEVER show "still processing" for a terminal pitch — that spinner would never resolve.
              <div className="glass-card p-4 mb-5 border border-amber-500/30">
                <p className="flex items-center gap-2 text-sm text-amber-400 font-semibold">
                  <AlertTriangle className="w-4 h-4" aria-hidden /> Analysis unavailable
                </p>
                <p className="text-xs text-secondary mt-1">
                  This pitch finished, but its analysis didn&apos;t save. The transcript below is still here.
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted mb-5">
                Still processing — the analysis will appear here shortly.
              </p>
            )
          ) : (
            <>
              {/* Scores */}
              <div className="glass-card p-4 mb-5">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-secondary mb-3">Scores</h2>
                <div className="space-y-2.5">
                  {Object.entries(detail.analysis.scores).map(([dim, val]) => (
                    <div key={dim}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-secondary capitalize">{dim}</span>
                        <span className="text-primary tabular-nums">{val}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full bg-ember-400 rounded-full"
                          style={{ width: `${Math.max(0, Math.min(100, val))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Summary */}
              <div className="glass-card p-4 mb-5">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-secondary mb-2">Summary</h2>
                <p className="text-sm text-primary leading-relaxed">{detail.analysis.summary}</p>
              </div>

              {/* Strengths / Improvements */}
              {detail.analysis.strengths.length > 0 && (
                <div className="mb-5">
                  <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-400 mb-2">
                    <CheckCircle2 className="w-3.5 h-3.5" aria-hidden /> Strengths
                  </h2>
                  <ul className="space-y-1.5">
                    {detail.analysis.strengths.map((s, i) => (
                      <li key={i} className="text-sm text-secondary leading-relaxed">• {s}</li>
                    ))}
                  </ul>
                </div>
              )}
              {detail.analysis.improvements.length > 0 && (
                <div className="mb-5">
                  <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ember-400 mb-2">
                    <AlertTriangle className="w-3.5 h-3.5" aria-hidden /> Growth opportunities
                  </h2>
                  <ul className="space-y-1.5">
                    {detail.analysis.improvements.map((s, i) => (
                      <li key={i} className="text-sm text-secondary leading-relaxed">• {s}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          {/* Transcript */}
          {detail.transcript && (
            <div className="glass-card p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-secondary mb-2">Transcript</h2>
              <p className="text-sm text-secondary leading-relaxed whitespace-pre-wrap">
                {detail.transcript}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
