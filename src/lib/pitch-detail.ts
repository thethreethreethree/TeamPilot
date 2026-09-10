/**
 * What a single pitch's detail screen is allowed to say.
 *
 * The web's PitchDetail draws four different conclusions from what looks like
 * one condition ("there is no analysis"), and each of them is a different thing
 * to tell a rep. Getting them wrong is not cosmetic:
 *
 *   FAILED           the pitch was processed and it did not work. Say why.
 *   LOST             the pitch COMPLETED but its analysis never saved. Saying
 *                    "still processing" here shows a spinner that will never
 *                    resolve — the rep waits forever for a thing that is not
 *                    coming.
 *   PROCESSING       genuinely still running. Worth waiting for.
 *   READY            the analysis is here.
 *
 * The transcript is deliberately independent of all four: a pitch whose analysis
 * was lost still has its transcript, and that is the part the rep can act on.
 *
 * A 404 IS NOT AN ERROR, AND AN ERROR IS NOT A 404. The web carries a comment
 * about this (audit F4) because the two collapsed once: a network drop rendered
 * as "this pitch isn't available", which reads as deleted. They stay separate
 * here for the same reason — one is retryable and the other never will be.
 *
 * ONE THING IS TRUE HERE THAT IS NOT TRUE ON THE LIST. Elsewhere in this app a
 * 404 from a coach route means the app's token was refused. It cannot
 *
 * (Corrected 2026-09-04: this used to say "the bearer shim is not deployed yet".
 * The shim is merged — report-card is one of the routes using it — so a refusal
 * now means the deployment is behind, not that the change is unwritten. The
 * handling is unchanged and still correct; only the explanation was stale.)
 * mean that here: reaching this screen requires the list to have loaded from the
 * same shimmed route, so the route demonstrably exists. A 404 here is a missing
 * pitch, and it is safe to say so.
 */

export type PitchAnalysis = {
  summary: string;
  strengths: string[];
  improvements: string[];
  scores: Record<string, number>;
};

export type PitchDetail = {
  id: string;
  name: string;
  status: string;
  error: string | null;
  recordedAt: string;
  outcome: string;
  transcript: string | null;
  analysis: PitchAnalysis | null;
};

export type AnalysisState =
  | { kind: 'failed'; message: string }
  | { kind: 'lost' }
  | { kind: 'processing' }
  | { kind: 'ready'; analysis: PitchAnalysis };

/** The statuses the route treats as terminal. Anything else is still moving. */
const TERMINAL = new Set(['complete', 'analyzed', 'failed']);

export function analysisState(detail: PitchDetail): AnalysisState {
  if (detail.status === 'failed') {
    return {
      kind: 'failed',
      // Never an empty bubble. A failure with no reason is worse than no card.
      message: detail.error?.trim() || 'This pitch could not be analysed.',
    };
  }
  if (detail.analysis) return { kind: 'ready', analysis: detail.analysis };
  // Terminal, and nothing to show: the write was lost. NOT "still processing".
  if (TERMINAL.has(detail.status)) return { kind: 'lost' };
  return { kind: 'processing' };
}

/**
 * Can the rep re-practise this exact pitch?
 *
 * Only with a transcript, because the roleplay rebuilds the customer and their
 * objections FROM it. Offering the button without one produces a roleplay
 * against an invented customer, which is the opposite of the point.
 */
export function canRolePlay(detail: PitchDetail): boolean {
  return TERMINAL.has(detail.status) && detail.status !== 'failed' && !!detail.transcript?.trim();
}

/** Bar width, clamped. A score outside 0–100 must not paint outside its track. */
export function scoreWidth(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

/**
 * Scores in a stable order.
 *
 * `Object.entries` follows insertion order, so two pitches whose analyses were
 * written with their keys in different orders would list the same dimensions
 * differently — and a rep comparing two pitches would read the rows as though
 * position meant something. Sorted, it never does.
 */
export function orderedScores(analysis: PitchAnalysis): { dimension: string; value: number }[] {
  return Object.entries(analysis.scores)
    .filter(([, v]) => typeof v === 'number' && Number.isFinite(v))
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([dimension, value]) => ({ dimension, value }));
}

/** `objection_handling` → `Objection handling`. */
export function dimensionLabel(dimension: string): string {
  const words = dimension.replace(/[_-]+/g, ' ').trim();
  if (!words) return dimension;
  return words.charAt(0).toUpperCase() + words.slice(1);
}
