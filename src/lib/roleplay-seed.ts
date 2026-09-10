/**
 * Turning a real recorded pitch into a practice run against that same customer.
 *
 * The phone's pitch detail offers "the coach plays this same customer and the
 * objections they raised". That sentence is a promise, and this module is what
 * decides whether the app is actually in a position to keep it.
 *
 * IT OFTEN IS NOT, AND THAT IS FINE. The route returns `{scenario: null}` as an
 * HONEST fallback — its own comment says so — when the pitch has no transcript
 * or the reconstruction came back malformed. A plain roleplay still works. What
 * must not happen is the screen going on claiming to replay that customer while
 * actually running a generic prospect: the rep would practise against an invented
 * objection and believe they had rehearsed the real one.
 *
 * THE LENGTH CAPS ARE NOT COSMETIC. The roleplay route validates
 * `customPrompt` and `focus` at 600 characters and `persona` at 200, and it
 * REJECTS an over-long body with a 400 rather than trimming. A reconstructed
 * situation drawn from a forty-minute transcript will sail past 600, so seeding
 * it unclamped would turn "practise this pitch" into a roleplay that fails on
 * its first turn — the exact button the rep pressed, broken by the thing that
 * was supposed to make it good.
 */

/** The route's own bounds. Named here so a change there is a change here. */
export const MAX_PERSONA = 200;
export const MAX_CUSTOM_PROMPT = 600;
export const MAX_FOCUS = 600;

/** What the from-pitch route sends back. Every field is optional in practice. */
export type FromPitchResponse = {
  scenario: { persona?: string | null; situation?: string | null } | null;
  focus?: string | null;
} | null;

export type RoleplaySeed =
  | {
      kind: 'replay';
      /** Free-form — a reconstructed customer, not one of the four presets. */
      persona: string;
      situation: string | null;
      focus: string | null;
    }
  | {
      kind: 'plain';
      /** Said on screen. The rep is told which practice they are actually in. */
      reason: string;
    };

/** Trim to a whole word where possible, so a seed never ends mid-syllable. */
function clamp(value: string, max: number): string {
  const t = value.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const space = cut.lastIndexOf(' ');
  // Only prefer the word boundary when it is not throwing most of it away.
  return (space > max * 0.6 ? cut.slice(0, space) : cut).trim();
}

export function roleplaySeed(res: FromPitchResponse): RoleplaySeed {
  const persona = res?.scenario?.persona?.trim();
  if (!persona) {
    // No customer to play. The route says this is expected when the pitch has
    // no transcript, so it is not an error — but it IS a different practice.
    return {
      kind: 'plain',
      reason:
        'This pitch could not be rebuilt into a practice run, so this is a general practice instead — not that customer.',
    };
  }
  const situation = res?.scenario?.situation?.trim();
  const focus = res?.focus?.trim();
  return {
    kind: 'replay',
    persona: clamp(persona, MAX_PERSONA),
    situation: situation ? clamp(situation, MAX_CUSTOM_PROMPT) : null,
    focus: focus ? clamp(focus, MAX_FOCUS) : null,
  };
}

/**
 * A practice seeded by a SKILL rather than by a past pitch.
 *
 * The Training screen names what a rep should work on, and every one of those
 * lines is now practiseable — the same button the website puts on them. It
 * carries only a focus: there is no pitch to rebuild, so the prospect stays one
 * of the four presets and only the REVIEW changes, scoring whether the rep
 * actually applied the skill they came to drill.
 *
 * Bounded by the same limit the route enforces, so a long growth-area sentence
 * cannot be rejected server-side for length after the rep has done the work.
 *
 * An empty or whitespace focus yields null — an unusable seed must not start a
 * practice that silently scores nothing.
 */
export function focusSeed(focus: string | null | undefined): string | null {
  const t = (focus ?? '').trim();
  if (!t) return null;
  return clamp(t, MAX_FOCUS);
}
