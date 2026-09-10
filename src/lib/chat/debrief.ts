/**
 * The coach's debrief on a closed topic.
 *
 * NOTHING DEPLOYED IS NEEDED, though the web reaches it through a route. That
 * route only reads `events` for the caller's own `coach.debrief_generated` row,
 * and `events` carries a company-wide SELECT policy — so the phone asks the same
 * question directly, narrowed to `actor = me` exactly as the route does.
 *
 * WHY IT IS ONLY EVER READ HERE. Generating a debrief is an LLM call the web
 * makes when a topic is closed. The phone never generates one: a rep closing a
 * topic on their phone would otherwise sit watching a spinner for a model call,
 * and a second debrief written for the same conversation would give the thread
 * two different accounts of itself. It reads back what was written.
 *
 * AN ABSENT DEBRIEF IS NORMAL, NOT A FAILURE. Topics closed before this existed
 * have none, and one closed from the phone will not have one until somebody
 * opens it on the website. So there is no error state here — the card is simply
 * not shown, rather than a rep being told something is broken.
 */

export type Debrief = {
  learned: string[];
  workOn: string[];
  closing: string | null;
};

function list(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
}

/**
 * Read a stored debrief payload.
 *
 * Returns null when there is genuinely nothing to show — including a payload
 * that exists but carries no usable content, because an empty card headed
 * "What you learned" is worse than no card.
 */
export function readDebrief(payload: unknown): Debrief | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Record<string, unknown>;
  const learned = list(p.learned);
  const workOn = list(p.work_on);
  const closing = typeof p.closing === 'string' && p.closing.trim() ? p.closing.trim() : null;
  if (!learned.length && !workOn.length && !closing) return null;
  return { learned, workOn, closing };
}
