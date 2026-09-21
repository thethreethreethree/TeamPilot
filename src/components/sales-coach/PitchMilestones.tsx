"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import {
  PITCH_MILESTONE_KEYS,
  PITCH_MILESTONE_TITLES,
  PITCH_MILESTONE_CAPTIONS,
  type PitchMilestoneDates,
} from "@/lib/coach/pitchScore/milestones";

/**
 * The MILESTONES strip from the rep dashboard sheet.
 *
 * SIX BADGES, ALWAYS. An unearned milestone is shown greyed with its caption, not hidden — the
 * sheet draws all six, and a strip that only showed what a rep had already earned would be empty
 * on their first day and would never tell them what there is to earn. That is the difference
 * between a trophy case and a map.
 *
 * NOT THE ARENA'S MILESTONES. Those count sessions on the points ledger; these count counted
 * pitches. A rep sees both, under labels that say which is which — `gamification/milestones.ts`
 * was relabelled the same day so its first badge reads "First session scored" rather than
 * "First pitch scored".
 *
 * EMPTY AND FAILED ARE DIFFERENT, as everywhere else in this feature. Six grey badges is a
 * statement about the rep — you have earned nothing — and a failed read must not make it.
 */

const ENDPOINT = "/api/coach/sales-session/pitch-score/milestones";

type Resp = { repId: string; milestones: PitchMilestoneDates; capped: boolean };

type State =
  | { kind: "loading" }
  | { kind: "failed" }
  | { kind: "ready"; data: Resp };

/**
 * Short month, no year — the sheet's level of detail, in the READER's order.
 *
 * The sheet draws "12 Aug". `toLocaleDateString` gives "Aug 12" to a US reader and "12 Aug" to a
 * British one, and that difference is deliberately not overridden: day-month order is a convention
 * belonging to whoever is reading, not a design decision the sheet was making. What the sheet DOES
 * specify — a short month and no year — is honoured.
 */
function earnedLabel(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function PitchMilestones({ repId }: { repId?: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const res = await fetch(repId ? `${ENDPOINT}?repId=${encodeURIComponent(repId)}` : ENDPOINT);
      if (!res.ok) {
        setState({ kind: "failed" });
        return;
      }
      setState({ kind: "ready", data: (await res.json()) as Resp });
    } catch {
      setState({ kind: "failed" });
    }
  }, [repId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section>
      <h3 className="text-[10px] uppercase tracking-widest text-muted mb-2">Milestones</h3>

      {state.kind === "loading" && (
        <p className="flex items-center gap-2 text-[12px] text-muted">
          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
          Loading…
        </p>
      )}

      {state.kind === "failed" && (
        <div className="rounded-xl border border-default bg-surface p-4">
          <p className="flex items-center gap-2 text-[12px] font-medium text-amber-700 dark:text-amber-400">
            <AlertTriangle className="w-3.5 h-3.5" aria-hidden />
            Your milestones could not be loaded.
          </p>
          <p className="mt-1 text-[11px] text-muted">
            This is not an empty strip — it is a failure to read.
          </p>
          <button
            type="button"
            onClick={load}
            className="mt-2 text-[11px] font-semibold text-brand hover:underline"
          >
            Try again
          </button>
        </div>
      )}

      {state.kind === "ready" && (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {PITCH_MILESTONE_KEYS.map((key) => {
            const earnedAt = state.data.milestones[key];
            const earned = earnedAt !== null;
            return (
              <li
                key={key}
                className={`rounded-xl border p-3 ${
                  earned ? "border-brand/40 bg-surface" : "border-default bg-base/40"
                }`}
              >
                {/*
                  The state is in the WORDS as well as the styling. "Not yet" is what separates an
                  unearned badge from an earned one for a reader who cannot see the border colour,
                  and it is the only thing distinguishing them in a screen reader.
                */}
                <p className={`text-[13px] font-semibold ${earned ? "text-primary" : "text-muted"}`}>
                  {PITCH_MILESTONE_TITLES[key]}
                </p>
                <p className={`mt-0.5 text-[11px] tabular-nums ${earned ? "text-brand" : "text-muted"}`}>
                  {earned ? earnedLabel(earnedAt) : "Not yet"}
                </p>
                {/* The sheet's own caption, so a rep knows what the badge asks of them. */}
                <p className="mt-1 text-[10px] leading-snug text-muted">
                  {PITCH_MILESTONE_CAPTIONS[key]}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
