/**
 * The rep's own practice trend, as the Training screen says it.
 *
 * The route already returns this and the app was dropping it: a rep could see
 * what to work on, but not whether their practice was working. That is the
 * question a training screen exists to answer.
 *
 * "APPLIED" IS NOT "ATTEMPTED", and the difference is the whole honesty of the
 * figure. A rep can drill a skill and never once reach it in the roleplay —
 * those attempts have no score, so a skill with attempts and no applied score
 * is "practised, not yet landed" rather than a zero. Averaging a null as 0
 * would tell somebody their close is failing when they simply have not got to
 * the close yet.
 *
 * A DIRECTION NEEDS TWO POINTS. The server sends `trend: null` when it has
 * fewer, and this says so rather than drawing a flat line — a flat line is a
 * claim that nothing changed, which is not the same as not knowing.
 */

export type FocusTrend = {
  focus: string;
  attempts: number;
  /** Most recent APPLIED score, 0-100. Null when drilled but never executed. */
  latest: number | null;
  first: number | null;
  trend: 'up' | 'flat' | 'down';
};

export type PracticeSummary = {
  totalAttempts: number;
  appliedAttempts: number;
  byFocus: FocusTrend[];
  latest: number | null;
  trend: 'up' | 'flat' | 'down' | null;
};

export type PracticeLine = {
  focus: string;
  label: string;
  /** What to print for the score. An em dash when it was never applied. */
  score: string;
  /** Plain-English direction, or null when there is not enough to say. */
  direction: string | null;
  spoken: string;
};

/** `objection_handling` -> `Objection handling`. */
export function focusLabel(focus: string): string {
  const words = focus.replace(/[_-]+/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : focus;
}

const DIRECTION: Record<string, string> = {
  up: 'going up',
  flat: 'holding',
  down: 'slipping',
};

/**
 * Is there anything worth showing?
 *
 * A rep who has never practised gets nothing rather than an empty chart, which
 * would read as "you practised and scored nothing".
 */
export function hasPractice(p: PracticeSummary | null | undefined): boolean {
  return !!p && p.totalAttempts > 0;
}

export function practiceLines(p: PracticeSummary): PracticeLine[] {
  return p.byFocus.map((f) => {
    const label = focusLabel(f.focus);
    const applied = typeof f.latest === 'number' && Number.isFinite(f.latest);
    // Two applied points are needed before a direction means anything; with one
    // the server still sends a trend, so this checks the data rather than
    // trusting the label.
    const canDirect = applied && typeof f.first === 'number' && Number.isFinite(f.first);
    return {
      focus: f.focus,
      label,
      score: applied ? String(f.latest) : '—',
      direction: canDirect ? (DIRECTION[f.trend] ?? null) : null,
      spoken: applied
        ? `${label}, ${f.latest} out of 100${canDirect ? `, ${DIRECTION[f.trend] ?? ''}` : ''}, ${f.attempts} ${
            f.attempts === 1 ? 'attempt' : 'attempts'
          }`
        : `${label}, practised ${f.attempts} ${
            f.attempts === 1 ? 'time' : 'times'
          } but not yet reached in a run`,
    };
  });
}

/** The one-line summary above the list. Never claims a direction it lacks. */
export function practiceHeadline(p: PracticeSummary): string {
  const runs = `${p.totalAttempts} practice ${p.totalAttempts === 1 ? 'run' : 'runs'}`;
  if (p.latest === null) {
    return `${runs}. None of them reached a scored moment yet, so there is no score to show.`;
  }
  if (p.trend === null) {
    return `${runs}. Latest ${p.latest} out of 100 — one more scored run and this can show a direction.`;
  }
  return `${runs}. Latest ${p.latest} out of 100, ${DIRECTION[p.trend] ?? 'holding'}.`;
}
