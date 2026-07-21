"use client";

import { useEffect, useState } from "react";
import {
  GraduationCap,
  TrendingUp,
  TrendingDown,
  Minus,
  Loader2,
  Info,
  ChevronDown,
} from "lucide-react";
import { eloToGrade, type EloGrade } from "@/lib/coach/v5/salesEloGrade";

/**
 * Standard-mode counterpart to AgentEloBadge (founder 2026-07-22): shows a LETTER GRADE instead of the
 * raw ELO number. Same data, same endpoint (/api/coach/sales-session/elo) — only the presentation
 * changes. Expert mode still renders AgentEloBadge (the number + gauge); Standard renders this.
 *
 * This mirrors the Analytics page's rule ("the ELO number stays Expert-only") now applied to Coach
 * Assessment. The letter comes from eloToGrade (salesEloGrade.ts) — see that file for the §A18 (no F),
 * §A11 (letter travels with its count basis), §A4 (bands are instrumentation) reasoning.
 *
 * §A11 defense lives HERE: the letter never stands alone — it renders beside the real counts ("N scored
 * calls") and the trend delta. §A18: framed as growth vs the standard, never a peer rank (callers must
 * not sort by it). §A10: rep sees their own (self), manager may pass a rep's agentId (the /elo route
 * enforces access). §3.5: no scored calls yet → an honest "not yet", never a low letter.
 */

type AgentElo = {
  rating: number;
  gamesPlayed: number;
  provisional: boolean;
  lastDelta: number;
};

const TIER_STYLE: Record<
  EloGrade["tier"],
  { text: string; ring: string; bg: string; label: string }
> = {
  strong: {
    text: "text-emerald-300",
    ring: "border-emerald-500/40",
    bg: "bg-emerald-500/10",
    label: "Strong",
  },
  solid: {
    text: "text-brand",
    ring: "border-ember-400/40",
    bg: "bg-ember-400/10",
    label: "Solid",
  },
  developing: {
    text: "text-amber-300",
    ring: "border-amber-500/40",
    bg: "bg-amber-500/10",
    label: "Developing",
  },
  "growth-area": {
    text: "text-amber-300",
    ring: "border-amber-500/30",
    bg: "bg-amber-500/[0.07]",
    label: "Growth area",
  },
};

export function AgentGradeBadge({
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
        <Loader2 className="w-3 h-3 animate-spin" aria-hidden /> Grading…
      </div>
    );
  }

  if (state === "empty") {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-lg border border-default px-2.5 py-1.5">
        <GraduationCap className="w-3.5 h-3.5 text-muted" aria-hidden />
        <span className="text-[11px] text-muted">
          {self ? "Your coaching grade" : "Coaching grade"} — needs a dissected
          call to start
        </span>
      </div>
    );
  }

  const e = elo!;
  const grade = eloToGrade(e.rating);
  const style = TIER_STYLE[grade.tier];
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
      <button
        type="button"
        onClick={(ev) => {
          // The coach-assessment card wraps this in a role="button" collapse
          // toggle (Standard mode). Stop propagation so clicking to see how the
          // grade is calculated doesn't also collapse the card.
          ev.stopPropagation();
          setShowExplain((v) => !v);
        }}
        aria-expanded={showExplain}
        className="w-full text-left group"
      >
        <div className="flex items-center gap-3">
          {/* The letter. A11: it never stands alone — the count basis rides beside it below. */}
          <span
            className={`inline-flex items-center justify-center w-[52px] h-[52px] rounded-xl border ${style.ring} ${style.bg} ${style.text} text-2xl font-extrabold tracking-tight shrink-0`}
            aria-hidden
          >
            {grade.letter}
          </span>
          <div className="min-w-0">
            <p className={`text-sm font-bold ${style.text} leading-tight`}>
              {style.label}
            </p>
            <span
              className={`inline-flex items-center gap-0.5 text-[11px] ${trendCls}`}
            >
              <Trend className="w-3 h-3" aria-hidden />
              {lastDelta > 0 ? "improving" : lastDelta < 0 ? "dipped last call" : "steady"}
            </span>
            {e.provisional && (
              <span className="ml-1.5 text-[10px] uppercase tracking-wide text-muted border border-default rounded px-1 py-0.5">
                provisional
              </span>
            )}
          </div>
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
          <span className="text-primary">coaching grade</span>
          <span className="text-muted">
            {" · "}
            {e.gamesPlayed} scored call{e.gamesPlayed === 1 ? "" : "s"}
            {e.provisional ? " · still settling" : ""}
          </span>
        </p>
      </button>
      {showExplain && <GradeExplanation self={self} />}
    </div>
  );
}

/** Plain-language explanation of the grade — kept honest and aligned to salesEloGrade.ts / salesElo.ts. */
function GradeExplanation({ self }: { self: boolean }) {
  const you = self ? "you" : "the rep";
  const your = self ? "your" : "their";
  return (
    <div className="mt-2 border-t border-ember-400/20 pt-2 space-y-1.5 text-[11px] leading-relaxed">
      <p className="text-primary font-semibold">How this grade is calculated</p>
      <p className="text-secondary">
        {`It summarizes how ${your} dissected calls score against our fixed "competent call" standard — never against other reps. A "B" means ${you} meet the standard; above is beating it, below is a growth area.`}
      </p>
      <ul className="space-y-1 text-muted list-disc pl-4">
        <li>{`Each dissected call is scored 0–100% — half on call quality (Dissect strengths vs growth + After-Pitch scores), half on the logged outcome (sold / follow-up / no-sale).`}</li>
        <li>{`Beat the standard and the grade climbs; fall short and it eases down. It's a trajectory, not a verdict.`}</li>
        <li>{`The lowest band is a "growth area" — a coaching target, never a fail. There is no F here on purpose.`}</li>
        <li>{`Under 5 scored calls it's provisional — still settling, don't over-read it yet.`}</li>
      </ul>
    </div>
  );
}
