/**
 * How the rep did across the four phases of a sale.
 *
 * Intro, discovery, consultation, close — each a 0-10 average over the sessions
 * that graded it, plus the one thing to change, taken from the WEAKEST graded
 * session because that is where coaching buys the most.
 *
 * ALREADY ARRIVING, ALREADY DISCARDED. `GET /api/coach/sales-session/skills`
 * returns `{ skills, processBreakdown, sampleSessions }` and the Coach Assessment
 * screen reads two of the three. This is the same shape as the roleplay
 * scorecard: the server does the work, sends it, and the app throws it away.
 *
 * THE TRAP THE CONTRACT DOES NOT MENTION, and it is the reason this file exists
 * rather than a `.map()` in the screen. The web's `aggregateProcessBreakdown`
 * ends each phase with `if (entries.length === 0) continue;` — a phase that no
 * session has ever graded is OMITTED FROM THE ARRAY ENTIRELY, not returned with
 * `avg: null`. So the response can hold four entries, or one, or none.
 *
 * Rendering the array as it arrives would make a phase VANISH from a rep's
 * process. "Close" disappearing reads as "close is not part of this" rather than
 * "nothing has graded your close yet", and the rep who most needs to know their
 * close is unmeasured is exactly the rep it would be hidden from. So all four are
 * always shown, in canonical order, and an absent phase is reported the same way
 * a null one is: not measured yet.
 *
 * PURE, so the difference between "scored 6.4" and "nobody has looked" is a
 * tested rule rather than a chain of `?.` in a row.
 */

/** The four phases, in the order a sale actually happens. Mirrors PROCESS_PHASES. */
export const PROCESS_PHASES = ['intro', 'discovery', 'consultation', 'close'] as const;

export type ProcessPhaseKey = (typeof PROCESS_PHASES)[number];

/** What the endpoint sends per phase, when it sends one at all. */
export type PhaseAggregate = {
  key: string;
  label: string;
  /** 0-10 average over graded sessions. Null when none graded it. */
  avg: number | null;
  /** How many sessions fed the average. */
  samples: number;
  tip: string;
};

/** What a row on the screen needs. */
export type PhaseRow = {
  key: ProcessPhaseKey;
  label: string;
  /** The score as a number, or null when there is nothing to show. */
  avg: number | null;
  samples: number;
  /** The improvement tip, or null when the phase is unmeasured. */
  tip: string | null;
  /** 0-1 for the bar, or null so nothing is drawn. Never 0 for "unknown". */
  fraction: number | null;
  /** The row spoken as a sentence, for a screen reader. */
  spoken: string;
};

/** Title case for a phase we have no server label for. */
const FALLBACK_LABEL: Record<ProcessPhaseKey, string> = {
  intro: 'Intro',
  discovery: 'Discovery',
  consultation: 'Consultation',
  close: 'Close',
};

function readAggregate(value: unknown): PhaseAggregate | null {
  if (!value || typeof value !== 'object') return null;
  const o = value as Record<string, unknown>;
  const key = typeof o.key === 'string' ? o.key.trim() : '';
  if (!key) return null;
  const avg = typeof o.avg === 'number' && Number.isFinite(o.avg) ? o.avg : null;
  const samples = typeof o.samples === 'number' && Number.isFinite(o.samples) ? o.samples : 0;
  return {
    key,
    label: typeof o.label === 'string' ? o.label.trim() : '',
    avg,
    samples,
    tip: typeof o.tip === 'string' ? o.tip.trim() : '',
  };
}

/**
 * All four phases, always, in canonical order.
 *
 * A PHASE MISSING FROM THE PAYLOAD AND A PHASE WITH A NULL AVERAGE ARE THE SAME
 * ANSWER — "nothing has graded this yet" — and are rendered identically. They
 * arrive differently only because of how the server aggregates, which is not a
 * distinction a rep can act on.
 */
export function processRows(payload: unknown): PhaseRow[] {
  const raw = Array.isArray(payload) ? payload : [];
  const byKey = new Map<string, PhaseAggregate>();
  for (const item of raw) {
    const parsed = readAggregate(item);
    if (parsed) byKey.set(parsed.key, parsed);
  }

  return PROCESS_PHASES.map((key) => {
    const found = byKey.get(key);
    const label = found?.label || FALLBACK_LABEL[key];
    const avg = found?.avg ?? null;
    const samples = found?.samples ?? 0;
    const scored = avg !== null;
    return {
      key,
      label,
      avg,
      samples,
      tip: scored && found?.tip ? found.tip : null,
      // Clamped, because a server that ever sent 11 would otherwise draw a bar
      // past the end of its track.
      fraction: scored ? Math.max(0, Math.min(1, (avg as number) / 10)) : null,
      spoken: scored
        ? `${label}, ${avg} out of 10, from ${samples} ${samples === 1 ? 'session' : 'sessions'}`
        : `${label}, not enough sessions yet`,
    };
  });
}

/**
 * True when NOTHING has been graded across every phase.
 *
 * The screen shows one honest line in that case rather than four identical "not
 * enough yet" rows, which is the repeated-label noise this app has already
 * learned to avoid on the sessions list.
 */
export function nothingGradedYet(rows: PhaseRow[]): boolean {
  return rows.every((r) => r.avg === null);
}

/** The section heading. */
export const PROCESS_HEADING = 'Process breakdown';

/** What a single unmeasured phase says. */
export const PHASE_UNMEASURED = 'Not enough sessions yet';

/**
 * What the whole section says when no phase has been graded.
 *
 * Names the cause (no graded calls yet) rather than the symptom (no numbers), so
 * a rep reads it as "this fills in as you record" and not as a broken panel.
 */
export const NOTHING_GRADED_BODY =
  'Your calls have not been graded by phase yet. This fills in as the coach reads more of them.';
