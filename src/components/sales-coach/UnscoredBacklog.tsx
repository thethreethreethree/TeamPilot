"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Play } from "lucide-react";

/**
 * "142 recordings have never been scored" — and the button that changes it.
 *
 * WHY A SURFACE EXISTS AT ALL. `pitch_scores` had one writer reachable only from a button on one
 * session page, so the Recordings tab, the leaderboard, best-pitches, the breakdown, milestones,
 * disputes and every Pattern Interrupt screen showed only the pitches somebody remembered to grade
 * by hand. A partner asked why his manager dashboard was empty and that was the answer
 * (docs/AUDIT-UNTRIGGERED-ARTIFACTS-2026-09-24.md). Shipping the drain route without a way to press
 * it would have reproduced the same defect one level up — a capability with no door.
 *
 * IT SHOWS THE NUMBER BEFORE IT SPENDS ANYTHING. Each recording is one LLM grading call, so the
 * count comes from a free GET and sits on screen before the button is touched.
 *
 * IT DISAPPEARS WHEN THERE IS NOTHING TO DO. A permanent "0 unscored" panel would be furniture.
 */

type Refusals = Partial<Record<string, number>>;

type DrainResponse = {
  scored: number;
  remaining: number;
  refused: Refusals;
  more: boolean;
  note: string | null;
};

/** What a raw refusal code should read as on screen. */
const REFUSAL_LABEL: Record<string, string> = {
  not_found: "could not be read",
  not_a_sales_call: "were not sales calls",
  no_agent_turns: "have no rep speech to grade",
  suppressed: "were skipped — AI guidance is off",
  llm_empty: "the scorer returned nothing for",
  parse_failed: "the scorer's answer could not be read for",
  store_failed: "could not be saved",
};

export function UnscoredBacklog({ onDone }: { onDone?: () => void }) {
  const [unscored, setUnscored] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [scoredSoFar, setScoredSoFar] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const [refused, setRefused] = useState<Refusals>({});
  const [failed, setFailed] = useState(false);

  const count = useCallback(async () => {
    try {
      const res = await fetch("/api/coach/sales-session/pitch-score/backfill");
      if (!res.ok) {
        // A failed count is NOT "nothing to score". Saying zero here would be the confident-zero
        // this whole feature exists to remove.
        setFailed(true);
        return;
      }
      const body = (await res.json()) as { unscored: number };
      setUnscored(body.unscored);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void count();
  }, [count]);

  /**
   * Drain until a pass scores nothing new.
   *
   * The loop condition is `more`, NOT `remaining > 0`. Recordings that can never be scored — no rep
   * speech — stay candidates forever, because there is no attempted-at column, so looping on
   * `remaining` would never terminate and every pass would be paid for.
   */
  const run = async () => {
    setRunning(true);
    setScoredSoFar(0);
    setNote(null);
    setRefused({});
    const seen: Refusals = {};
    try {
      for (;;) {
        const res = await fetch("/api/coach/sales-session/pitch-score/backfill", { method: "POST" });
        if (!res.ok) {
          setNote("Scoring stopped because the request failed. Nothing already scored is lost.");
          break;
        }
        const body = (await res.json()) as DrainResponse;
        setScoredSoFar((n) => n + body.scored);
        setUnscored(body.remaining);
        for (const [reason, n] of Object.entries(body.refused ?? {})) {
          seen[reason] = (seen[reason] ?? 0) + (n ?? 0);
        }
        setRefused({ ...seen });
        if (!body.more) {
          setNote(body.note);
          break;
        }
      }
    } catch {
      setNote("Scoring stopped because the connection dropped. Nothing already scored is lost.");
    } finally {
      setRunning(false);
      onDone?.();
    }
  };

  if (failed) {
    return (
      <div className="rounded-xl border border-default bg-surface px-4 py-3 text-xs text-muted">
        The unscored-recording count could not be read, so this may be understating how many are
        waiting. Reloading usually fixes it.
      </div>
    );
  }

  // Nothing waiting and nothing just done — no panel. Furniture that always says zero teaches
  // people to stop reading it.
  if (unscored === null || (unscored === 0 && scoredSoFar === 0)) return null;

  const refusalLines = Object.entries(refused).filter(([, n]) => (n ?? 0) > 0);

  return (
    <div className="rounded-xl border border-ember-400/40 bg-ember-400/[0.06] px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-primary">
            {unscored > 0
              ? `${unscored} recording${unscored === 1 ? "" : "s"} ${unscored === 1 ? "has" : "have"} never been scored`
              : "Every recording has been scored"}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {unscored > 0
              ? "Until a pitch is scored it appears on no dashboard — not the rep's, not the team's, not Recordings. Scoring is one AI grading call per recording."
              : `${scoredSoFar} scored just now. The dashboards below will fill as you look.`}
          </p>
        </div>

        {unscored > 0 && (
          <button
            type="button"
            onClick={() => void run()}
            disabled={running}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-ember-400 px-3 py-2 text-xs font-semibold text-[#09090B] hover:bg-ember-500 disabled:opacity-60 transition-colors"
          >
            {running ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                Scoring… {scoredSoFar} done
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" aria-hidden />
                Score them all
              </>
            )}
          </button>
        )}
      </div>

      {/* Why it stopped, when it stopped early. §1.5.3 — a run that scores nothing must say so in
          words, never as a silent 0. */}
      {note && <p className="mt-2 text-xs text-secondary">{note}</p>}

      {refusalLines.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-[11px] text-muted">
          {refusalLines.map(([reason, n]) => (
            <li key={reason}>
              {n} {REFUSAL_LABEL[reason] ?? `could not be scored (${reason})`}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
