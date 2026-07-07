"use client";

import { useEffect, useState } from "react";
import { Gauge, TrendingUp, TrendingDown, Minus, Loader2 } from "lucide-react";

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
          {self ? "Your effectivity rating" : "Effectivity rating"} — needs a
          scored call with an outcome to start
        </span>
      </div>
    );
  }

  const e = elo!;
  const lastDelta = e.history.length ? e.history[e.history.length - 1]!.delta : 0;
  const Trend = lastDelta > 0 ? TrendingUp : lastDelta < 0 ? TrendingDown : Minus;
  const trendCls =
    lastDelta > 0
      ? "text-emerald-300"
      : lastDelta < 0
        ? "text-amber-300"
        : "text-muted";

  return (
    <div className="rounded-xl border border-ember-400/30 bg-ember-400/[0.05] px-3 py-2.5">
      <div className="flex items-center gap-2">
        <Gauge className="w-4 h-4 text-brand shrink-0" aria-hidden />
        <div className="flex items-baseline gap-2">
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
        </div>
      </div>
      <p className="text-[11px] text-secondary mt-1.5 leading-snug">
        {self ? "Your" : ""} <span className="text-primary">Sales Effectivity Rating</span>{" "}
        — you vs. our measurement standard (1500), not other reps.{" "}
        <span className="text-muted">
          {e.gamesPlayed} scored call{e.gamesPlayed === 1 ? "" : "s"}
          {e.provisional ? " · still settling" : ""}.
        </span>
      </p>
    </div>
  );
}
