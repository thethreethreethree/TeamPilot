/**
 * Roleplay — practising a pitch against the coach.
 *
 * WHY IT IS THE FEATURE MOST WORTH HAVING ON A PHONE. Everything else this app
 * does happens around a real conversation. This one IS a conversation, and it
 * can be had in a car between streets, which is the only place a rep has three
 * spare minutes. The web has it; on a laptop it is a thing you sit down to do.
 *
 * THE ROUTE IS STATELESS, and that shapes everything here. Its own comment says
 * a roleplay "must NOT pollute the rep's session history or metrics", so the
 * server keeps nothing: the CLIENT holds the conversation and posts the whole
 * thing each turn. Which means the phone is the only place a practice run
 * exists while it is happening, and losing it costs the rep the run.
 *
 *   POST { phase: "turn",   context, persona, messages }        → { reply }
 *   POST { phase: "review", context, persona, messages }        → { review }
 *   POST { ..., focus }                                          → { review, scorecard }
 *
 * A LIMIT WORTH KNOWING: the route caps `messages` at 80 and each at 4000
 * characters. Sending an 81st turn is a 400, not a truncation — so the app has
 * to stop before then and say why, rather than let a rep keep typing into a
 * request that will be refused.
 */
import { coachPost } from '@/lib/coach-api';
import type { FromPitchResponse } from '@/lib/roleplay-seed';
import { authFailureOf, type AuthFailure } from '@/lib/auth-failure';
import { practiceScoreView, type PracticeScoreView } from '@/lib/practice-scorecard';
import {
  CONTEXTS,
  MAX_MESSAGES,
  MAX_MESSAGE_CHARS,
  MIN_REP_TURNS_FOR_REVIEW,
  PERSONAS,
  canReview,
  turnsRemaining,
  type RoleplayMessage,
  type RoleplayRole,
} from './roleplay-bounds';

// Re-exported so screens keep one import. The RULES live in roleplay-bounds.ts
// because this file cannot load in a test — see its header.
export {
  CONTEXTS,
  MAX_MESSAGES,
  MAX_MESSAGE_CHARS,
  MIN_REP_TURNS_FOR_REVIEW,
  PERSONAS,
  canReview,
  turnsRemaining,
};
export type { RoleplayMessage, RoleplayRole };

export type RoleplayReview = {
  summary: string;
  whatWorked: string[];
  toImprove: string[];
  correctLine: { line: string; why: string } | null;
};

export type TurnResult =
  | { ok: true; reply: string }
  | { ok: false; reason: 'needs-shim'; why: AuthFailure | null }
  | { ok: false; reason: 'failed'; message: string };

export type ReviewResult =
  /**
   * `skill` is the focused score when one was asked for and came back, and
   * `{kind:'none'}` otherwise — never absent, so a screen cannot forget it the
   * way this module forgot the scorecard for the whole of the first build.
   */
  | { ok: true; review: RoleplayReview; skill: PracticeScoreView }
  | { ok: false; reason: 'needs-shim'; why: AuthFailure | null }
  | { ok: false; reason: 'failed'; message: string };

function classify(
  e: unknown,
): { reason: 'needs-shim'; why: AuthFailure | null } | { reason: 'failed'; message: string } {
  const status = (e as { status?: number })?.status;
  if (status === 401 || status === 403 || status === 404) return { reason: 'needs-shim', why: authFailureOf(e) };
  const message = e instanceof Error && e.message ? e.message : '';
  // The route returns 502 with its own sentence when the model gives nothing
  // back — "The prospect didn't respond — try again." That is written for the
  // rep and is better than anything this file could invent.
  return {
    reason: 'failed',
    message: message || 'Could not reach the coach. Try again when you have signal.',
  };
}

export async function nextProspectLine(input: {
  persona: string;
  context: 'in_person' | 'video';
  messages: RoleplayMessage[];
  /** The reconstructed situation, when replaying a real pitch. */
  customPrompt?: string | null;
  /** The skill this run is scored on, when replaying a real pitch. */
  focus?: string | null;
}): Promise<TurnResult> {
  try {
    const data = await coachPost<{ reply: string }>('/api/coach/sales-session/roleplay', {
      phase: 'turn',
      context: input.context,
      persona: input.persona,
      messages: input.messages,
      // Omitted entirely rather than sent as null: the route's schema marks both
      // optional, and an explicit null fails validation where absence passes.
      ...(input.customPrompt ? { customPrompt: input.customPrompt } : {}),
      ...(input.focus ? { focus: input.focus } : {}),
    });
    const reply = (data?.reply ?? '').trim();
    if (!reply) {
      return { ok: false, reason: 'failed', message: 'The prospect did not respond — try again.' };
    }
    return { ok: true, reply };
  } catch (e) {
    const c = classify(e);
    return { ok: false, ...c };
  }
}

export async function reviewRoleplay(input: {
  persona: string;
  context: 'in_person' | 'video';
  messages: RoleplayMessage[];
  customPrompt?: string | null;
  /** Present → the route returns a focus-anchored SCORED review. */
  focus?: string | null;
}): Promise<ReviewResult> {
  try {
    const data = await coachPost<{ review: RoleplayReview; scorecard?: unknown }>(
      '/api/coach/sales-session/roleplay',
      {
        phase: 'review',
        context: input.context,
        persona: input.persona,
        messages: input.messages,
        ...(input.customPrompt ? { customPrompt: input.customPrompt } : {}),
        ...(input.focus ? { focus: input.focus } : {}),
      },
    );
    if (!data?.review) {
      return { ok: false, reason: 'failed', message: 'Could not build the review — try again.' };
    }
    return { ok: true, review: data.review, skill: practiceScoreView(data) };
  } catch (e) {
    const c = classify(e);
    return { ok: false, ...c };
  }
}

/**
 * Rebuild a practice run from a real recorded pitch.
 *
 * Never throws and never reports a failure to the caller as an error, because
 * the route itself treats "could not rebuild" as an ordinary answer rather than
 * a fault — its comment calls `{scenario:null}` "an honest fallback, not an
 * error". A rep who taps "practise this pitch" with no transcript should get a
 * working practice run and a plain sentence explaining it is a general one, not
 * an error screen. `roleplaySeed` turns the answer into that sentence.
 */
export async function scenarioFromPitch(pitchId: string): Promise<FromPitchResponse> {
  try {
    return await coachPost<FromPitchResponse>(
      '/api/coach/sales-session/practice-scenario/from-pitch',
      { pitchId },
    );
  } catch {
    return null;
  }
}
