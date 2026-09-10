import type { DissectEmptyShape } from "./salesDissect";

/**
 * Why a session has no read, in the only terms that change what somebody should DO about it.
 *
 * Measured on production 2026-09-10: 92 of 100 stored declines say `no_signal`, and they are
 * systematically the LONGER calls — median 683 transcript words against 341 for the ones that
 * succeeded. Thin content would be SHORT, so for most of these the rep did everything right and the
 * dashboard showed them nothing at all: no read, no badge, no reason, on more than half of every
 * session recorded.
 *
 * `runAndStoreDissect` now records WHICH empty it hit beside `reason`, so a coach that CRASHED can be
 * told apart from a coach that read the call and honestly found little in it.
 *
 * THE ONE-SIDED RULE IS UNCHANGED and still keyed on `no_agent_turns` alone. The rule that a
 * `no_signal` session must never be shown as a capture problem is right and is kept: telling that rep
 * their audio failed would send them to re-record a call that recorded fine.
 *
 * THIS IS MIRRORED IN THE MOBILE APP (`src/lib/capture-issue.ts` there). The two repositories cannot
 * import from each other — the app reads `coaching_sessions` straight from Supabase and never calls
 * this route — so both pin the SAME shapes in their tests, and a change to one that the other does not
 * follow shows up as a failure rather than as two surfaces quietly disagreeing about the same call.
 */
export type ReadIssue = "one-sided" | "unfinished" | null;

/** The shapes that mean the COACH failed, not the call — the only ones worth offering a retry for. */
const COACH_FAILED: ReadonlySet<string> = new Set<DissectEmptyShape>([
  "llm_empty",
  "unparsable",
  "threw",
]);

export function readIssueFor(
  hasDissect: boolean,
  latestAttemptReason: string | null | undefined,
  latestShape?: string | null
): ReadIssue {
  // A later dissect always wins: re-transcribing, re-labelling or simply rebuilding can rescue a call,
  // and when it does the badge must disappear rather than linger against a call that is now fine.
  if (hasDissect) return null;
  if (latestAttemptReason === "no_agent_turns") return "one-sided";
  // `no_strengths` and `suppressed` stay silent — there the coach really did read the call. So does an
  // older decline carrying no shape at all: we do not know which it was, and guessing would put a retry
  // in front of somebody for a call that may have nothing more to give.
  return latestShape && COACH_FAILED.has(latestShape) ? "unfinished" : null;
}
