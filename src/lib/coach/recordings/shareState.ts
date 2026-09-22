/**
 * Whether a recording may be played to the rest of the team — guide Step 4, item 7.
 *
 * `recording_share_events` is append-only (0260), so the answer is DERIVED BY REPLAYING the log
 * rather than stored. That is §3.1 applied to a consent: the question a manager asks is "can I
 * play this in a huddle", and the question an auditor asks six months later is "was she asked, and
 * what did she say" — a boolean answers the first and destroys the second.
 *
 * THE VERDICT IS RETURNED AS A VERDICT. `shareable` is the field every caller branches on; no
 * surface re-reads the events to decide for itself whether a revocation counted (§2.2). The one
 * that did would be the button, and the button is the thing that plays the audio.
 */

export type ShareKind = "requested" | "granted" | "declined" | "revoked";

export type ShareEvent = {
  kind: ShareKind;
  actorId: string;
  createdAt: string;
  note?: string | null;
};

export type ShareState = {
  /** THE VERDICT. True only while the most recent answer from the rep is a grant. */
  shareable: boolean;
  /** What the UI shows: nothing asked yet, waiting on the rep, or a settled answer. */
  status: "none" | "pending" | "granted" | "declined" | "revoked";
  /** When the manager last asked, so a pending request can say how long it has been waiting. */
  requestedAt: string | null;
  /** When the rep last answered. */
  answeredAt: string | null;
  /** The rep's note on a decline, or the manager's on a request — whichever is the live one. */
  note: string | null;
};

const ANSWERS: ReadonlySet<ShareKind> = new Set(["granted", "declined", "revoked"]);

/**
 * Replay the log.
 *
 * LAST ANSWER WINS, and a later request does NOT reopen a grant. A rep who granted and then
 * revoked is not put back into "pending" by a manager asking again — the manager's second request
 * is recorded and the clip stays silent until the rep answers it. The alternative would let a
 * manager clear a revocation by asking twice.
 *
 * ORDER IS BY `created_at` ALONE, WITH NO TIE-BREAK, and that is a deliberate deletion. An earlier
 * version broke ties toward the answer, on the reasoning that a request and an answer stamped in
 * the same millisecond can only be a request being answered. Mutation testing survived the
 * reversal, and the reason is that the tie-break can never be observed: the loop below records the
 * latest request and the latest answer INDEPENDENTLY, and the only place they interact is
 * `askedSince`, which compares their timestamps rather than their positions. A line that cannot
 * change any output is not a safeguard, it is something a future reader will trust (A30).
 *
 * The behaviour it was meant to produce is real and is preserved by the strict `>` below: on equal
 * timestamps, `askedSince` is false and the answer governs.
 */
export function shareState(events: readonly ShareEvent[]): ShareState {
  const sorted = [...events].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));

  let requestedAt: string | null = null;
  let requestNote: string | null = null;
  let answer: ShareEvent | null = null;

  for (const e of sorted) {
    if (e.kind === "requested") {
      requestedAt = e.createdAt;
      requestNote = e.note ?? null;
      // A new request after an answer means the rep is being asked again; the previous answer
      // still governs playback until they respond, so `answer` is deliberately NOT cleared.
      continue;
    }
    if (ANSWERS.has(e.kind)) answer = e;
  }

  if (!answer) {
    return {
      shareable: false,
      status: requestedAt ? "pending" : "none",
      requestedAt,
      answeredAt: null,
      note: requestNote,
    };
  }

  // Asked again after an answer: the answer still decides playback, but the UI says pending so the
  // rep sees a live question rather than a settled one.
  const askedSince =
    requestedAt !== null && Date.parse(requestedAt) > Date.parse(answer.createdAt);

  return {
    shareable: answer.kind === "granted",
    status: askedSince ? "pending" : (answer.kind as ShareState["status"]),
    requestedAt,
    answeredAt: answer.createdAt,
    note: askedSince ? requestNote : (answer.note ?? null),
  };
}
