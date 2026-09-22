/**
 * Who may append which `pattern_events` kind — one table, consumed as a verdict.
 *
 * WHY THIS IS A MODULE AND NOT AN `if` IN THE ROUTE. 0258 gives `pattern_events` no insert policy
 * at all, so the database is not carrying this rule and the route is the only thing standing
 * between a rep and "Mark as coached" on their own pattern. A rule in that position gets read by
 * reviewers, copied into the next write path, and drifts. Extracted so the next writer imports
 * the answer instead of retyping the condition (§2.2), and so the rule can be unit-tested
 * without a database — which is how a weakening fails CI rather than review.
 *
 * THE SPLIT, and what each half protects:
 *
 *   manager   coached · drill_assigned · note · fixed
 *   rep       rep_reviewed · note · clip_disputed        (on their OWN pattern only)
 *
 * A rep marking their own pattern coached would make the Stalled rule unfalsifiable — "coached
 * 7+ days ago with no change" is a claim about a human having intervened, and a rep can clear it
 * by asserting the intervention happened. A rep marking their own pattern `fixed` is the same
 * defect pointed at the leaderboard: the streak rule exists so a pattern closes on evidence.
 *
 * A MANAGER MAY NOT WRITE `rep_reviewed`. That is the acknowledgement half of A10 — the whole
 * point of the Ⓡ marker and the "Rep reviewed 2/2" tile is that the REP saw it, and a manager who
 * can tick it on their behalf turns the tile into a record of the manager's own opinion.
 * `clip_disputed` is the rep's objection and is theirs for the same reason.
 *
 * `note` is the one both may write, because the board draws them as peer entries in one list.
 */

// enum-source: pattern_events.kind
export type PatternEventKind =
  | "coached"
  | "drill_assigned"
  | "note"
  | "rep_reviewed"
  | "clip_disputed"
  | "fixed";

/** Exactly 0258's CHECK, so a kind this module accepts cannot be rejected by the database. */
export const PATTERN_EVENT_KINDS: readonly PatternEventKind[] = [
  "coached",
  "drill_assigned",
  "note",
  "rep_reviewed",
  "clip_disputed",
  "fixed",
];

const MANAGER_KINDS: ReadonlySet<string> = new Set(["coached", "drill_assigned", "note", "fixed"]);
const REP_KINDS: ReadonlySet<string> = new Set(["rep_reviewed", "note", "clip_disputed"]);

export type EventActor = {
  /** True when the caller is a Sales Coach manager for this company. */
  isManager: boolean;
  /** True when the pattern being written to belongs to the caller. */
  ownsPattern: boolean;
};

export type EventVerdict =
  | { allowed: true; kind: PatternEventKind }
  /** `reason` is shown to the caller; it never names anything they could not already see. */
  | { allowed: false; reason: string };

/**
 * May this actor append this kind?
 *
 * A MANAGER WHO OWNS THE PATTERN GETS BOTH SETS, which is not an oversight. A manager runs their
 * own pitches in this product — the Coach Assessment board ranks them alongside their reps — so a
 * manager with a pattern of their own is an ordinary rep for the purposes of acknowledging it.
 * Denying `rep_reviewed` to a manager on their own pattern would leave them the only person who
 * cannot answer their own coaching.
 */
export function canAppend(kind: string, actor: EventActor): EventVerdict {
  if (!(PATTERN_EVENT_KINDS as readonly string[]).includes(kind)) {
    return { allowed: false, reason: "Unknown action." };
  }
  const k = kind as PatternEventKind;

  const asManager = actor.isManager && MANAGER_KINDS.has(k);
  const asOwner = actor.ownsPattern && REP_KINDS.has(k);
  if (asManager || asOwner) return { allowed: true, kind: k };

  // ONE MESSAGE FOR EVERY REFUSAL. Splitting it into "you are not a manager" and "that is not
  // your pattern" would let a rep enumerate which patterns exist and whose they are by reading
  // the difference — the 404-vs-403 leak, one layer up.
  return { allowed: false, reason: "That is not yours to record." };
}

/**
 * Does this kind belong in the COACHING NOTES list?
 *
 * The presence of a body, not the kind — see `PatternRow.events`. A "Mark as coached" carrying an
 * instruction is one row that is both a Ⓒ marker and a note, which is exactly what the board
 * shows: the manager's entry reads as coaching, not as a separate memo.
 */
export function isNote(event: { body: string | null }): boolean {
  return typeof event.body === "string" && event.body.trim().length > 0;
}

/** Kinds that require a body to mean anything. A note with no words is not an event. */
export const BODY_REQUIRED: ReadonlySet<string> = new Set(["note", "clip_disputed"]);
