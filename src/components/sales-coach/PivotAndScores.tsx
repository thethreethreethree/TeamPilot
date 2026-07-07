"use client";

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Loader2, ChevronDown } from "lucide-react";

/**
 * PivotAndScores — the two additions the founder asked to append to the summary
 * surfaces (2026-07-07): the bidirectional PIVOT MOMENT and the after-pitch-style
 * SCORES. ONE shared component (§A13 — author the space once; §A21 — same feature,
 * same everywhere) so the Summarize panel and the Conversation-summary card render
 * identical logic + structure.
 *
 * §A18 privacy: the pivot is a manager-visible observation (passed in as a prop,
 * read from the manager-visible summary event). The SCORES are the rep's PRIVATE
 * self-assessment — this component fetches them from the OWNER-ONLY
 * /summary-scores endpoint, which returns 403 to a manager. On 403 the whole
 * scores section renders NOTHING (a manager viewing a rep's session sees the
 * pivot but never the scores). Types are declared locally because the engines
 * are `server-only` and cannot be imported into a client component.
 */

type PivotDirection = "gained" | "lost";
export type PivotMoment = {
  atSeq: number;
  timestampLabel: string | null;
  direction: PivotDirection;
  label: string;
  customerLine: string | null;
  repLine: string | null;
  whatHappened: string;
  whyItMattered: string;
};
type ScoreCategory = {
  key: string;
  label: string;
  score: number;
  display: string;
  rationale: string;
  citation: string | null;
  computed: boolean;
};

type ScoresResult =
  | { state: "ok"; scores: ScoreCategory[]; hasSignal: boolean }
  | { state: "forbidden" } // §A18 — caller is not the owner
  | { state: "error" };

// Module-level per-session cache so the two on-page instances (Summarize panel +
// Conversation-summary card) share ONE owner-gated fetch instead of each firing
// its own LLM scoring call. Keyed by sessionId; holds the in-flight promise.
const scoresCache = new Map<string, Promise<ScoresResult>>();

function fetchScores(sessionId: string): Promise<ScoresResult> {
  const cached = scoresCache.get(sessionId);
  if (cached) return cached;
  const p = (async (): Promise<ScoresResult> => {
    try {
      const res = await fetch(
        `/api/coach/sales-session/${sessionId}/summary-scores`,
        { method: "POST" }
      );
      if (res.status === 403) return { state: "forbidden" };
      if (!res.ok) return { state: "error" };
      const d = await res.json();
      return {
        state: "ok",
        scores: Array.isArray(d.scores) ? d.scores : [],
        hasSignal: !!d.hasSignal,
      };
    } catch {
      return { state: "error" };
    }
  })().then((r) => {
    // Cache only settled, meaningful results (ok / forbidden). A transient
    // ERROR must NOT stick — otherwise one failed fetch would hide the owner's
    // scores until a full page reload. Evicting on error lets a remount retry.
    if (r.state === "error") scoresCache.delete(sessionId);
    return r;
  });
  scoresCache.set(sessionId, p);
  return p;
}

export function PivotAndScores({
  sessionId,
  pivot,
}: {
  sessionId: string;
  pivot: PivotMoment | null;
}) {
  return (
    <div className="mt-4 space-y-4">
      {pivot && <PivotCard pivot={pivot} />}
      <ScoresSection sessionId={sessionId} />
    </div>
  );
}

function PivotCard({ pivot }: { pivot: PivotMoment }) {
  const gained = pivot.direction === "gained";
  // Green when the rep won ground, amber when they lost it (matching the
  // burnt-amber "breakdown" language used on the After-Pitch surface).
  const tone = gained
    ? "border-emerald-500/30 bg-emerald-500/[0.04]"
    : "border-amber-500/30 bg-amber-500/[0.04]";
  const chip = gained
    ? "text-emerald-300 bg-emerald-500/10"
    : "text-amber-300 bg-amber-500/10";
  const Icon = gained ? TrendingUp : TrendingDown;

  return (
    <div className={`rounded-lg border p-3 ${tone}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${chip}`}
        >
          <Icon className="h-3 w-3" />
          Pivot moment · {gained ? "gained ground" : "lost ground"}
        </span>
        {pivot.timestampLabel && (
          <span className="text-[11px] text-tertiary tabular-nums">
            {pivot.timestampLabel}
          </span>
        )}
      </div>
      <p className="text-xs font-semibold text-primary mt-2">{pivot.label}</p>
      {(pivot.customerLine || pivot.repLine) && (
        <div className="mt-2 space-y-1">
          {pivot.customerLine && (
            <p className="text-[11px] text-secondary">
              <span className="text-tertiary">Customer:</span> “
              {pivot.customerLine}”
            </p>
          )}
          {pivot.repLine && (
            <p className="text-[11px] text-secondary">
              <span className="text-tertiary">You:</span> “{pivot.repLine}”
            </p>
          )}
        </div>
      )}
      <p className="text-xs text-secondary leading-relaxed mt-2">
        {pivot.whatHappened}
      </p>
      <p className="text-[11px] text-tertiary leading-relaxed mt-1">
        <span className="font-medium text-secondary">Why it mattered: </span>
        {pivot.whyItMattered}
      </p>
    </div>
  );
}

function ScoresSection({ sessionId }: { sessionId: string }) {
  const [result, setResult] = useState<ScoresResult | null>(null);
  const [showReview, setShowReview] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchScores(sessionId).then((r) => {
      if (!cancelled) setResult(r);
    });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  // §A18 — a non-owner (manager) gets 403; render NOTHING for scores. Errors
  // also render nothing rather than a broken shell.
  if (!result) {
    return (
      <div className="flex items-center gap-2 text-[11px] text-tertiary">
        <Loader2 className="h-3 w-3 animate-spin" /> Loading your scores…
      </div>
    );
  }
  if (result.state === "forbidden" || result.state === "error") return null;
  if (!result.hasSignal || result.scores.length === 0) {
    return (
      <p className="text-[11px] text-tertiary">
        Not enough of your side of the call to score yet.
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-default bg-white/[0.01] p-3">
      <div className="flex items-baseline gap-2">
        <h4 className="text-xs font-semibold text-primary">Your scores</h4>
        <span className="text-[11px] text-tertiary">Private to you</span>
      </div>
      <div className="mt-2 grid grid-cols-5 gap-1.5">
        {result.scores.map((c) => (
          <div
            key={c.key}
            className="rounded-md bg-white/[0.02] px-1 py-2 text-center"
          >
            <div className="text-[10px] uppercase tracking-wide text-tertiary leading-tight">
              {c.label}
            </div>
            <div className="text-sm font-semibold text-primary mt-1 tabular-nums">
              {c.display}
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setShowReview((v) => !v)}
        aria-expanded={showReview}
        className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-brand hover:text-ember-400"
      >
        Score assessment review
        <ChevronDown
          className={`h-3 w-3 transition-transform ${showReview ? "rotate-180" : ""}`}
        />
      </button>
      {showReview && (
        <div className="mt-2 space-y-2 border-t border-default pt-2">
          {result.scores.map((c) => (
            <div key={c.key}>
              <p className="text-[11px] font-semibold text-secondary">
                {c.label} · {c.display}
                {c.computed && (
                  <span className="ml-1 text-tertiary font-normal">
                    (measured)
                  </span>
                )}
              </p>
              <p className="text-[11px] text-tertiary leading-relaxed">
                {c.rationale}
              </p>
              {c.citation && (
                <p className="text-[11px] text-tertiary italic leading-relaxed">
                  “{c.citation}”
                </p>
              )}
            </div>
          ))}
          <p className="text-[10px] text-tertiary pt-1">
            A mirror of this one call against your own growth — not a ranking.
            Only you see these.
          </p>
        </div>
      )}
    </div>
  );
}
