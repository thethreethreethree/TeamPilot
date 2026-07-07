"use client";

import { useEffect, useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  Loader2,
  ChevronDown,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Swords,
  Tag,
} from "lucide-react";

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

// §A13 — the shapes come from the single shared source (summaryTypes), not a
// client-local re-declaration. Re-exported so the surfaces that render this
// component (SessionCoachTools, the session page) can keep importing from here.
import type {
  MomentKind,
  MomentSentiment,
  SalesMoment,
  PivotMoment,
  ScoreCategory,
  SalesIntel,
} from "@/lib/coach/v5/summaryTypes";
export type {
  SalesMoment,
  PivotMoment,
  SalesIntel,
} from "@/lib/coach/v5/summaryTypes";

type ScoresResult =
  | { state: "ok"; scores: ScoreCategory[]; hasSignal: boolean }
  | { state: "forbidden" } // §A18 — caller is not the owner
  | { state: "error" };

// Module-level per-session cache so the two on-page instances (Summarize panel +
// Conversation-summary card) share ONE owner-gated fetch instead of each firing
// its own LLM scoring call. Keyed by sessionId; holds the in-flight promise.
const scoresCache = new Map<string, Promise<ScoresResult>>();

/** Drop a session's cached scores so the next mount re-derives them. Call after
 *  Re-summarize (audit 2026-07-07): the cache otherwise freezes a settled `ok`
 *  result for the SPA session, so private scores would silently desync from a
 *  freshly-regenerated timeline. §A14 — data path complete ≠ render path fresh. */
export function evictScoresCache(sessionId: string): void {
  scoresCache.delete(sessionId);
}

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
  moments = [],
  intel = null,
}: {
  sessionId: string;
  pivot: PivotMoment | null;
  moments?: SalesMoment[];
  intel?: SalesIntel | null;
}) {
  return (
    <div className="mt-4 space-y-4">
      {/* Conversation Timeline — the hero visual (founder 2026-07-07): the whole
          arc (opener → objection → breakdown → close), breakdown highlighted, with
          the customer-sentiment direction per moment. Above the pivot. */}
      {moments.length > 0 && <MomentsTimeline moments={moments} />}
      {pivot && <PivotCard pivot={pivot} />}
      {/* Conversation intelligence — competitors named + topics discussed
          (manager-visible observation, founder 2026-07-07). */}
      {intel && (intel.competitors.length > 0 || intel.topics.length > 0) && (
        <IntelSection intel={intel} />
      )}
      <ScoresSection sessionId={sessionId} />
    </div>
  );
}

const SENTIMENT_META: Record<
  MomentSentiment,
  { label: string; cls: string; Icon: typeof ArrowUpRight } | null
> = {
  warming: { label: "warming", cls: "text-emerald-400", Icon: ArrowUpRight },
  cooling: { label: "cooling", cls: "text-amber-400", Icon: ArrowDownRight },
  neutral: null,
};

function IntelSection({ intel }: { intel: SalesIntel }) {
  return (
    <div className="rounded-lg border border-default bg-white/[0.01] p-3 space-y-2">
      {intel.competitors.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5">
            <Swords className="h-3.5 w-3.5 text-tertiary" aria-hidden />
            <h4 className="text-xs font-semibold text-primary">
              Competitors mentioned
            </h4>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {intel.competitors.map((c) => (
              <span
                key={c}
                className="rounded-full bg-amber-500/10 text-amber-300 text-[11px] px-2 py-0.5"
              >
                {c}
              </span>
            ))}
          </div>
        </div>
      )}
      {intel.topics.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5">
            <Tag className="h-3.5 w-3.5 text-tertiary" aria-hidden />
            <h4 className="text-xs font-semibold text-primary">
              Topics discussed
            </h4>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {intel.topics.map((t) => (
              <span
                key={t}
                className="rounded-full bg-white/[0.04] text-secondary text-[11px] px-2 py-0.5"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const KIND_LABEL: Record<MomentKind, string> = {
  opener: "Opener",
  discovery: "Discovery",
  objection: "Objection",
  breakdown: "Breakdown",
  close: "Close",
  other: "Moment",
};

function MomentsTimeline({ moments }: { moments: SalesMoment[] }) {
  return (
    <div className="rounded-lg border border-default bg-white/[0.01] p-3">
      <h4 className="text-xs font-semibold text-primary mb-3">
        Conversation timeline
      </h4>
      <ol className="relative border-l border-white/10 ml-1.5 space-y-3">
        {moments.map((m, i) => (
          <li key={`${m.atSeq}-${i}`} className="ml-3">
            {/* node — amber + ring for the breakdown, muted dot otherwise */}
            <span
              className={`absolute -left-[5px] mt-1 h-2.5 w-2.5 rounded-full ${
                m.isBreakdown
                  ? "bg-amber-400 ring-2 ring-amber-400/30"
                  : "bg-white/25"
              }`}
              aria-hidden
            />
            <div className="flex items-baseline gap-2 flex-wrap">
              {m.timestampLabel && (
                <span className="text-[11px] text-tertiary tabular-nums">
                  {m.timestampLabel}
                </span>
              )}
              <span
                className={`text-[11px] font-semibold ${
                  m.isBreakdown ? "text-amber-300" : "text-secondary"
                }`}
              >
                {m.isBreakdown && (
                  <AlertTriangle className="inline h-3 w-3 mr-0.5 -mt-0.5" />
                )}
                {KIND_LABEL[m.kind]} · {m.label}
              </span>
              {/* Customer-sentiment direction at this moment (founder 2026-07-07). */}
              {m.sentiment &&
                SENTIMENT_META[m.sentiment] &&
                (() => {
                  const s = SENTIMENT_META[m.sentiment]!;
                  return (
                    <span
                      className={`inline-flex items-center gap-0.5 text-[10px] ${s.cls}`}
                    >
                      <s.Icon className="h-3 w-3" aria-hidden />
                      {s.label}
                    </span>
                  );
                })()}
            </div>
            {m.customerLine && (
              <p className="text-[11px] text-secondary mt-1">
                <span className="text-tertiary">Customer:</span> “
                {m.customerLine}”
              </p>
            )}
            {m.repLine && (
              <p className="text-[11px] text-secondary">
                <span className="text-tertiary">You:</span> “{m.repLine}”
              </p>
            )}
            {m.note && (
              <p className="text-[11px] text-tertiary mt-0.5">{m.note}</p>
            )}
            {/* The breakdown's correction — the "what to say instead" box. */}
            {m.isBreakdown && m.correction && (
              <div className="mt-2 rounded-md border border-amber-500/25 bg-amber-500/[0.05] p-2">
                <p className="text-[11px] text-secondary">
                  <span className="text-amber-300 font-medium">
                    Try instead:{" "}
                  </span>
                  “{m.correction.correctLine}”
                </p>
                <p className="text-[11px] text-tertiary mt-0.5">
                  {m.correction.whyItWorks}
                </p>
              </div>
            )}
          </li>
        ))}
      </ol>
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
    // Neutral loading text: a MANAGER also mounts this briefly before the 403
    // resolves to "forbidden" (→ nothing). "Loading your scores…" would wrongly
    // imply a manager has scores here (§A18 hygiene) — keep it generic.
    return (
      <div className="flex items-center gap-2 text-[11px] text-tertiary">
        <Loader2 className="h-3 w-3 animate-spin" /> Loading…
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
      <div className="mt-2 grid grid-cols-4 gap-1.5">
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
