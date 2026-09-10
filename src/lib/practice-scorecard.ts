/**
 * The score for the ONE SKILL a rep set out to practise.
 *
 * THIS FEATURE WAS SOLD, PROMISED IN THE APP, AND NEVER SHOWN. The store listing
 * says a rep can "practise the one skill your coaching says to work on, and get
 * scored on that skill rather than on the pitch in general". The roleplay screen
 * says, above the run, that "the review at the end scores whether you actually
 * applied it". The server does exactly that — `/roleplay` at phase `review`
 * returns `{ review, scorecard }`, where the scorecard carries the focus skill,
 * whether the rep applied it, a 0-100 score on THAT skill, and what to do on the
 * next rep.
 *
 * The app read `review` and threw `scorecard` away. So a rep chose a skill, was
 * told they would be scored on it, practised it, and got back the same general
 * review they would have got without choosing anything. The promise was made on
 * the screen immediately before the thing that did not keep it.
 *
 * WHY THE BANDS ARE THE SESSION BANDS. `bandFor` already turns 0-100 into the
 * five words this app uses for a real recorded call. A practice score is the same
 * kind of number about the same rep, and giving it a second private vocabulary
 * would mean "solid" on a session and some other word on a practice run meant the
 * same thing — or worse, different things. One scale, one set of words.
 *
 * PURE, so what a rep is told about their own skill is a tested rule.
 */
import { bandFor, bandLabel } from "@/lib/gamification/points";

export type PracticeScorecard = {
  /** The skill the run was anchored to. */
  focus: string;
  /** Whether the rep actually used it, as judged by the coach. */
  applied: boolean;
  /** 0-100 on that skill alone — NOT on the pitch as a whole. */
  score: number;
  /** The one thing to do differently on the next rep. */
  nextRep: string;
};

export type PracticeScoreView =
  /** The skill was used, and here is how it went. */
  | {
      kind: "scored";
      focus: string;
      score: number;
      band: string;
      nextRep: string;
    }
  /** The run never reached the skill. Said plainly, with the way in. */
  | { kind: "not-attempted"; focus: string; nextRep: string }
  /** No focus was set, or none came back. The review stands on its own. */
  | { kind: "none" };

/**
 * Pull the scorecard out of the response without trusting any of it.
 *
 * Mirrors `readDissect`: a field of the wrong type means a shape this build does
 * not know, and guessing is how the app printed JSON at a rep in the first place.
 */
export function readScorecard(payload: unknown): PracticeScorecard | null {
  const s = (payload as { scorecard?: unknown } | null)?.scorecard;
  if (!s || typeof s !== "object") return null;
  const o = s as Record<string, unknown>;
  // `applied` must be a real boolean. Absent is not false: false is a finding
  // about the run, and absent is a shape we cannot read.
  if (typeof o.applied !== "boolean") return null;
  const raw = typeof o.score === "number" ? o.score : Number(o.score);
  return {
    focus: str(o.focus),
    applied: o.applied,
    // Clamped and rounded on the way in, matching the route, so no screen ever
    // has to think about a 103 or a 47.6.
    score: Number.isFinite(raw)
      ? Math.max(0, Math.min(100, Math.round(raw)))
      : 0,
    nextRep: str(o.nextRep),
  };
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * What the screen shows under the review.
 *
 * NO NUMBER WHEN THE SKILL WAS NEVER USED, and this is the one real judgement
 * call in the file. The route scores an unapplied skill low on purpose — its
 * prompt forbids inflating it — so the number is honest, but it is honest about
 * a thing that did not happen. A rep who never got to their objection-handling
 * line reading "Objection handling · 14 · Needs coaching" reads it as a grade on
 * their selling, because that is what a percentage under a skill name means
 * everywhere else in this app. It is the same defect as showing a zero for a
 * figure nobody could read: a confident measurement of nothing.
 *
 * So the absence is reported as an absence, and `nextRep` — which the route
 * writes for exactly this case — becomes the whole answer.
 *
 * AN UNREADABLE SCORECARD RETURNS `none` RATHER THAN AN ERROR, because the
 * review beside it is the main thing on the screen and it arrived intact. A
 * malformed extra must never take down the content it was added to.
 */
export function practiceScoreView(payload: unknown): PracticeScoreView {
  const s = readScorecard(payload);
  // A score attached to no named skill cannot be read by anyone. The generic
  // review is then the honest whole of what came back.
  if (!s || !s.focus) return { kind: "none" };
  if (!s.applied)
    return { kind: "not-attempted", focus: s.focus, nextRep: s.nextRep };
  const band = bandLabel(bandFor(s.score));
  // bandFor only returns null for a non-number, and `score` is always a number
  // by here — but the fallback keeps the type honest rather than asserting.
  return {
    kind: "scored",
    focus: s.focus,
    score: s.score,
    band: band ?? "",
    nextRep: s.nextRep,
  };
}

/** The heading over the score, naming what was measured. */
export const SCORE_HEADING = "The skill you practised";

/** What a rep reads when the run never reached the skill. */
export const NOT_ATTEMPTED_BODY =
  "This run did not get to it, so there is nothing to score yet. Run it again and use the skill early — the coach only scores what it hears.";

/** The heading over the one thing to change next time. */
export const NEXT_REP_HEADING = "Next rep";
