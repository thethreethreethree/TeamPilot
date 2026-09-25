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

/** Mirrors `BATCH` in the route. Display only — the server owns the real number. */
const BATCH_HINT = "8 recordings";
/** At most this many throttle waits in one run, so a throttled caller terminates. */
const MAX_WAITS = 30;

type DrainResponse = {
  scored: number;
  remaining: number;
  refused: Refusals;
  more: boolean;
  note: string | null;
  /** Sent straight back as `?offset=` on the next pass — see the route's cursor note. */
  nextOffset?: number;
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
  errored: "failed unexpectedly for",
};

export function UnscoredBacklog({ onDone }: { onDone?: () => void }) {
  const [unscored, setUnscored] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [scoredSoFar, setScoredSoFar] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const [refused, setRefused] = useState<Refusals>({});
  const [failed, setFailed] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  /** Once a run has happened the panel STAYS, even at zero — otherwise the answer disappears
   *  with it and the press looks like it did nothing. */
  const [ran, setRan] = useState(false);

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
    setRan(true);
    setProgress(null);
    setScoredSoFar(0);
    setNote(null);
    setRefused({});
    const seen: Refusals = {};
    let offset = 0;
    let passes = 0;
    let total = 0;
    let waits = 0;
    try {
      for (;;) {
        passes += 1;
        setProgress(`Pass ${passes} — asking the server for the next ${BATCH_HINT}…`);
        const res = await fetch(
          `/api/coach/sales-session/pitch-score/backfill?offset=${offset}`,
          { method: "POST" }
        );
        /**
         * 429 IS NOT AN ERROR HERE — IT IS THE DRAIN OUTRUNNING ITS OWN THROTTLE.
         *
         * The route allows 12 POSTs a minute and a 194-recording backlog needs 25, so the loop
         * could never finish: it died at pass 13 every single time. It only shows up when passes
         * return FAST, which is exactly what happens when recordings are being refused rather than
         * graded (`no_agent_turns` is decided before any LLM call, so a refusal costs ~nothing and
         * the loop spins through its whole minute's budget in seconds).
         *
         * So the limiter is respected rather than raised past the point of being a limiter: wait
         * the Retry-After it already sends, then carry on. Bounded, so a permanently throttled
         * caller still terminates instead of hanging forever.
         */
        if (res.status === 429 && waits < MAX_WAITS) {
          waits += 1;
          const secs = Math.min(65, Math.max(1, Number(res.headers.get("Retry-After") ?? 5) || 5));
          setProgress(`Rate limit reached after ${total} scored — waiting ${secs}s, then carrying on.`);
          await new Promise((r) => setTimeout(r, secs * 1000));
          continue;
        }
        if (!res.ok) {
          /**
           * SAY WHAT FAILED.
           *
           * This used to read "Scoring stopped because the request failed" and nothing else — the
           * status and the server's own sentence were both discarded. That is the message a
           * manager saw on the first real run against 194 recordings, and it is why the cause had
           * to be found by reading code instead of by reading the screen. An error that does not
           * name itself costs a diagnosis every time it happens.
           */
          const detail = await res
            .json()
            .then((b: { error?: string }) => b?.error)
            .catch(() => null);
          setNote(
            `Scoring stopped: ${detail ?? `the request failed (HTTP ${res.status})`}. ` +
              `Nothing already scored is lost — press the button again to carry on.`
          );
          break;
        }
        const body = (await res.json()) as DrainResponse;
        offset = body.nextOffset ?? offset;
        total += body.scored;
        setScoredSoFar((n) => n + body.scored);
        setUnscored(body.remaining);
        for (const [reason, n] of Object.entries(body.refused ?? {})) {
          seen[reason] = (seen[reason] ?? 0) + (n ?? 0);
        }
        setRefused({ ...seen });
        if (!body.more) {
          /**
           * A RUN THAT CHANGES NOTHING MUST STILL SAY SO.
           *
           * `body.note` is null on every ordinary finish, so this used to end the loop by setting
           * the message to null — clearing the one element that could have reported the outcome.
           * The button un-disabled, no text appeared, and a completed pass was pixel-identical to
           * a dead button. That is what "I pressed it and nothing happened" describes, and it is
           * the same §1.5.3 failure the error path was fixed for this morning: silence read as
           * success. The remedy is the same one — say it out loud, including when the news is
           * that there was no news.
           */
          setNote(
            body.note ??
              (total > 0
                ? `Done — ${total} recording${total === 1 ? "" : "s"} scored in ${passes} pass${passes === 1 ? "" : "es"}. ` +
                  (body.remaining > 0
                    ? `${body.remaining} still unscored for the reasons below.`
                    : `The dashboards below will fill as you look.`)
                : `Done, and nothing was scored. ${body.remaining} recording${body.remaining === 1 ? "" : "s"} remain` +
                  (Object.keys(seen).length > 0
                    ? ` — the reasons are listed below.`
                    : `, and the server gave no reason. That is a defect; please send me this sentence.`))
          );
          break;
        }
        setProgress(`Pass ${passes} done — ${total} scored so far, ${body.remaining} to go.`);
      }
    } catch {
      setNote("Scoring stopped because the connection dropped. Nothing already scored is lost.");
    } finally {
      setRunning(false);
      setProgress(null);
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
  if (unscored === null || (unscored === 0 && scoredSoFar === 0 && !ran)) return null;

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
      {/* Live, per-pass. A drain of 194 is ~25 server round-trips; without this the only feedback
          for minutes at a time is a spinner, and a spinner is what a hung request looks like. */}
      {progress && <p className="mt-2 text-xs text-secondary">{progress}</p>}
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
