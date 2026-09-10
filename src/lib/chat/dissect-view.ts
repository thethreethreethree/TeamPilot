/**
 * The coach's read of a pasted conversation, as a person reads it.
 *
 * THIS EXISTS BECAUSE THE APP PRINTED JSON AT A REP. Found on TestFlight,
 * 4 September: "Read the prospect" rendered
 *
 *   { "dissect": { "hasSignal": false, "summary": "", "strengths": [], ... } }
 *
 * under the heading "WHAT THE COACH READS IN THIS". The screen looked for
 * `reply`, `summary` or `text` at the top level, found none of them — the route
 * returns `{ dissect }` — and fell back to `JSON.stringify`. A developer
 * artefact, on a screen a door rep opens between houses.
 *
 * TWO SEPARATE FAILURES, and the second is the worse one:
 *
 *   1. The shape was never read. Fixed by reading the real one, which is
 *      `SalesTextDissect` in the web repo: hasSignal, summary, strengths (each
 *      with a real quote), opportunity, nextMove, guidingQuestion.
 *
 *   2. `hasSignal: false` WAS IGNORED. That flag is the server's own honesty
 *      signal — it means the conversation was too thin to read, and the route's
 *      own comment says "never a fabricated read". The app already respects the
 *      identical flag on the after-pitch debrief (`hasContent`). Here it
 *      rendered the empty structure instead, which is the shape of a verdict
 *      with nothing behind it.
 *
 * PURE, so what a rep is shown is a tested rule rather than a chain of
 * `typeof` checks in a screen.
 */

/** One thing the rep did well, with the line from the conversation that shows it. */
export type DissectStrength = { point: string; excerpt: string };

export type Dissect = {
  hasSignal: boolean;
  summary: string;
  strengths: DissectStrength[];
  opportunity: string;
  nextMove: string;
  guidingQuestion: string;
};

/** What the screen should show. */
export type DissectView =
  /** A real read, already written out for display. */
  | { kind: 'read'; text: string }
  /** The coach found nothing to say, and says so. */
  | { kind: 'no-signal' }
  /** The answer did not arrive in a shape this app understands. */
  | { kind: 'unreadable' };

/** Pull the dissect out of whatever the route returned, without trusting it. */
export function readDissect(payload: unknown): Dissect | null {
  const d = (payload as { dissect?: unknown } | null)?.dissect;
  if (!d || typeof d !== 'object') return null;
  const o = d as Record<string, unknown>;
  // `hasSignal` must be a real boolean. Absent means a shape we do not know,
  // and guessing `true` would print empty sections as if they were findings.
  if (typeof o.hasSignal !== 'boolean') return null;
  return {
    hasSignal: o.hasSignal,
    summary: str(o.summary),
    strengths: Array.isArray(o.strengths)
      ? o.strengths
          .map((s) => ({ point: str((s as Record<string, unknown>)?.point), excerpt: str((s as Record<string, unknown>)?.excerpt) }))
          .filter((s) => s.point.length > 0)
      : [],
    opportunity: str(o.opportunity),
    nextMove: str(o.nextMove),
    guidingQuestion: str(o.guidingQuestion),
  };
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/**
 * Turn a dissect into the paragraphs a rep reads, or say there is nothing.
 *
 * NO HEADINGS FOR EMPTY SECTIONS. A heading with nothing under it reads as a
 * finding the coach declined to explain, which is worse than the heading being
 * absent. Every block below appears only when it has content.
 *
 * THE QUOTE COMES WITH THE POINT, because the route guarantees each strength is
 * grounded in a real line from the conversation — "every 'working' point must
 * quote a REAL line from the pasted text or it is dropped". Showing the point
 * without its quote would throw away the thing that makes it checkable.
 */
export function dissectView(payload: unknown): DissectView {
  const d = readDissect(payload);
  if (!d) return { kind: 'unreadable' };
  if (!d.hasSignal) return { kind: 'no-signal' };

  const parts: string[] = [];
  if (d.summary) parts.push(d.summary);

  if (d.strengths.length > 0) {
    parts.push(
      ['What is working', ...d.strengths.map((s) => (s.excerpt ? `• ${s.point}\n  “${s.excerpt}”` : `• ${s.point}`))].join(
        '\n',
      ),
    );
  }
  if (d.opportunity) parts.push(`The opportunity\n${d.opportunity}`);
  if (d.nextMove) parts.push(`Your next move\n${d.nextMove}`);
  // Last, deliberately: it invites the rep's own read rather than closing with
  // an instruction, which is the shape the route was written to produce.
  if (d.guidingQuestion) parts.push(d.guidingQuestion);

  // Signal was claimed and every field came back empty. That is not a read.
  if (parts.length === 0) return { kind: 'no-signal' };
  return { kind: 'read', text: parts.join('\n\n') };
}

/** What the screen says when the coach had nothing to work with. */
export const NO_SIGNAL_TEXT =
  'There was not enough in this conversation for the coach to read. Paste more of it — what they said as well as what you said — and try again.';

/** What the screen says when the answer came back in a shape it does not know. */
export const UNREADABLE_TEXT =
  'The coach answered in a form this app does not recognise. Nothing is wrong with your conversation — this one needs somebody to look at the server.';

/**
 * What a 402 from the coach routes means, said in the app's own terms.
 *
 * WHY THIS IS NOT JUST THE SERVER'S SENTENCE. The coach routes are shared with
 * the browser extension, and they label themselves for it: a locked account gets
 * "Your plan doesn't include the Sales Coach extension" or "Your 14-day Sales
 * Coach extension trial has ended". Both are TRUE, and both are confusing on a
 * phone — a rep reads that they are missing a browser add-on they have never
 * seen, and concludes the app is telling them about the wrong product.
 *
 * The cause is right and only the noun is wrong, so the app names the thing the
 * rep is actually holding. It keeps the trial distinction, because "your trial
 * ended" and "your plan never included this" send a rep to different
 * conversations with different people.
 *
 * NOT A FIX ON THE SERVER, deliberately: that label is correct for the
 * extension, which is the route's other caller, and changing it there would
 * trade one wrong noun for another.
 */
export function planBlockedMessage(serverMessage: string | null | undefined): string {
  const trialEnded = /trial has ended/i.test(serverMessage ?? '');
  return trialEnded
    ? 'Your trial of the coach has ended. An administrator at your company can turn it back on.'
    : 'Your plan does not include the coach. An administrator at your company can add it.';
}

/** True when an error is the server saying the account is not entitled. */
export function isPlanBlocked(e: unknown): boolean {
  return (e as { status?: number } | null)?.status === 402;
}
