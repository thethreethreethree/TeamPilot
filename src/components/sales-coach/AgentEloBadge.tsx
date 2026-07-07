"use client";

import { useEffect, useState } from "react";
import {
  Gauge,
  TrendingUp,
  TrendingDown,
  Minus,
  Loader2,
  Info,
  ChevronDown,
} from "lucide-react";
import { EloMeter } from "@/components/sales-coach/EloMeter";

/**
 * Agent Sales Effectivity Rating badge (founder 2026-07-07). An ELO the rep
 * plays against OUR MEASUREMENT STANDARD (fixed 1500), never against other reps.
 *
 * §A11/§A18 — this is growth-vs-a-standard, NOT a leaderboard: it shows ONE
 * agent's own number + their trend, framed against the standard, with a
 * "provisional" flag until enough games (§4). Callers must NOT sort a list by it.
 * §A10 — the rep sees their OWN (pass no agentId / their own id); a manager may
 * pass a rep's agentId (the /elo route enforces access).
 */

type EloHistoryEntry = {
  sessionId: string;
  at: string;
  gameScore: number;
  ratingBefore: number;
  ratingAfter: number;
  delta: number;
};
type AgentElo = {
  rating: number;
  gamesPlayed: number;
  provisional: boolean;
  /** Latest game's rating change. Always present; history may be empty for a
   *  manager viewer (§A18 — the per-session breakdown is owner-only). */
  lastDelta: number;
  history: EloHistoryEntry[];
};

export function AgentEloBadge({
  agentId,
  self = false,
}: {
  agentId?: string;
  self?: boolean;
}) {
  const [elo, setElo] = useState<AgentElo | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "empty" | "error">(
    "loading"
  );
  // Founder 2026-07-07: click the score to reveal how it's calculated.
  const [showExplain, setShowExplain] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const qs = agentId ? `?agentId=${encodeURIComponent(agentId)}` : "";
    void fetch(`/api/coach/sales-session/elo${qs}`)
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          setState("error");
          return;
        }
        const d = await res.json();
        const e = d.elo as AgentElo | undefined;
        if (!e || e.gamesPlayed === 0) {
          setElo(e ?? null);
          setState("empty");
          return;
        }
        setElo(e);
        setState("ok");
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [agentId]);

  if (state === "error") return null; // fail quiet — never a broken shell

  if (state === "loading") {
    return (
      <div className="inline-flex items-center gap-1.5 text-[11px] text-muted">
        <Loader2 className="w-3 h-3 animate-spin" aria-hidden /> Rating…
      </div>
    );
  }

  if (state === "empty") {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-lg border border-default px-2.5 py-1.5">
        <Gauge className="w-3.5 h-3.5 text-muted" aria-hidden />
        <span className="text-[11px] text-muted">
          {self ? "Your Sales ELO rating" : "Sales ELO rating"} — needs a
          dissected call to start
        </span>
      </div>
    );
  }

  const e = elo!;
  const lastDelta = e.lastDelta ?? 0;
  const Trend = lastDelta > 0 ? TrendingUp : lastDelta < 0 ? TrendingDown : Minus;
  const trendCls =
    lastDelta > 0
      ? "text-emerald-300"
      : lastDelta < 0
        ? "text-amber-300"
        : "text-muted";

  return (
    <div className="rounded-xl border border-ember-400/30 bg-ember-400/[0.05] px-3 py-2.5">
      {/* Founder 2026-07-07: the score is clickable — reveals how it's calculated
          (removed the inline "vs. the standard" descriptor). §3.6 make-visible. */}
      <button
        type="button"
        onClick={() => setShowExplain((v) => !v)}
        aria-expanded={showExplain}
        className="w-full text-left group"
      >
        <div className="flex items-center gap-2">
          <EloMeter rating={e.rating} size={44} />
          <span className="text-xl font-bold text-primary tabular-nums">
            {e.rating}
          </span>
          <span className={`inline-flex items-center gap-0.5 text-[11px] ${trendCls}`}>
            <Trend className="w-3 h-3" aria-hidden />
            {lastDelta > 0 ? `+${lastDelta}` : lastDelta}
          </span>
          {e.provisional && (
            <span className="text-[10px] uppercase tracking-wide text-muted border border-default rounded px-1 py-0.5">
              provisional
            </span>
          )}
          <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-muted group-hover:text-secondary shrink-0">
            <Info className="w-3 h-3" aria-hidden />
            how it&apos;s calculated
            <ChevronDown
              className={`w-3 h-3 transition-transform ${showExplain ? "rotate-180" : ""}`}
              aria-hidden
            />
          </span>
        </div>
        <p className="text-[11px] text-secondary mt-1 leading-snug">
          {self ? "Your " : ""}
          <span className="text-primary">Sales ELO Rating</span>
          <span className="text-muted">
            {" · "}
            {e.gamesPlayed} scored call{e.gamesPlayed === 1 ? "" : "s"}
            {e.provisional ? " · still settling" : ""}
          </span>
        </p>
      </button>
      {showExplain && <EloExplanation self={self} />}
    </div>
  );
}

/** Accurate, plain-language explanation of the ELO methodology (founder 2026-07-07:
 *  "understand how the score is calculated"). Kept in sync with salesElo.ts —
 *  1500 standard, K≈24, [100,3000] bounds, provisional < 5, balanced game score. */
function EloExplanation({ self }: { self: boolean }) {
  const you = self ? "you" : "the rep";
  const your = self ? "your" : "their";
  const You = self ? "You" : "They";
  return (
    <div className="mt-2 border-t border-ember-400/20 pt-2 space-y-1.5 text-[11px] leading-relaxed">
      <p className="text-primary font-semibold">How this is calculated</p>
      {/* Rendered as template-literal strings so JSX never strips the space at an
          {expr}↔text boundary (the "yourdissected" typo the founder caught). */}
      <p className="text-secondary">
        {`System scoring analysis, based on ${your} dissected agent sessions. It's an ELO rating — like chess — but ${you} play against our measurement standard (a competent call = 1500), never against other reps.`}
      </p>
      <ul className="space-y-1 text-muted list-disc pl-4">
        <li>
          {`Each dissected call is one “game.” ${You} score 0–100%: half from the call's quality (Dissect strengths vs growth + After-Pitch scores where available), half from the outcome (sold / follow-up / no-sale) when it was logged — otherwise on quality alone.`}
        </li>
        <li>{`Beat the standard and the rating climbs; fall short and it dips — up to about 24 points a call.`}</li>
        <li>{`The scale starts at 1500, floors at 100, and tops out at 3000 (chess's max).`}</li>
        <li>{`Under 5 scored calls it's marked provisional — still settling, don't over-read it yet.`}</li>
      </ul>
    </div>
  );
}
