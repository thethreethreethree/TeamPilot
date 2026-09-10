/**
 * The decision attached to a chat topic, as the phone shows it.
 *
 * WHY READ-ONLY, SAID OUT LOUD — AND THE REASON HAS BEEN CORRECTED.
 *
 * This comment used to say driving a dialogue "is admin-gated at the API layer,
 * so pretending otherwise on a phone would offer a rep a control that cannot
 * work." That was checked against the web repository on 4 September and it is
 * **wrong about the phase that matters**. The three routes have three different
 * gates:
 *
 *   OPEN     `POST /api/chat/topic-decisions` — company admin only
 *            (`isAdminRole`, route.ts:98). Admin-gated, as claimed.
 *   RESPOND  `POST /api/chat/topic-decisions/[id]/respond` — any PARTICIPANT of
 *            the parent topic. Not admin-gated at all. A rep in the room may
 *            respond, and the route returns 403 only to non-participants.
 *   DECIDE   `POST /api/chat/topic-decisions/[id]/decide` — no route-layer role
 *            check; it leans on RLS.
 *
 * So a rep is NOT forbidden from taking part. The real blocker is duller and
 * more fixable: all three routes authenticate with `createClient()` — cookies —
 * and none accepts the Bearer token this app signs its requests with. The phone
 * cannot call them at all, whoever is holding it.
 *
 * WHY THE CORRECTION IS WORTH THE WORDS. The old sentence made this look like a
 * permissions question, which would mean redesigning who may drive a decision.
 * It is an auth-shim question: the same `callerScopedDb(req) ?? createClient()`
 * pattern the coach routes already use, applied to three handlers. That is a
 * much smaller thing, and anyone costing this feature from the old comment
 * would have costed it wrongly.
 *
 * The screen stays read-only until that shim exists, because a control that
 * cannot reach its server is worse than one that is honestly absent. The card
 * says where the work is done instead of failing when tapped.
 *
 * READING IT NEEDS NOTHING DEPLOYED. `chat_topic_decisions` has a company-wide
 * SELECT policy ("they are thread artifacts and the topic itself is already
 * visible at the company level"), so the phone asks for the row under the same
 * RLS the website uses.
 *
 * 'DEFER' IS A DECISION. The column allows 'user' | 'system' | 'hybrid' |
 * 'defer', and it is tempting to render a deferred dialogue as unresolved —
 * a blank, or an "in progress" state. It is neither. Somebody worked the
 * question and concluded that not acting yet was the answer, which is exactly
 * the outcome most likely to be re-litigated if the screen hides it.
 */

/** The phases the column's CHECK constraint allows. */
export const PHASES = ['situation', 'elicit', 'respond', 'decide', 'decided'] as const;
export type DecisionPhase = (typeof PHASES)[number];

export type ChosenPath = 'user' | 'system' | 'hybrid' | 'defer';

export type TopicDecisionRow = {
  /** What is actually being decided. See `situation` on the type below. */
  situation?: unknown;
  phase?: unknown;
  chosen_path?: unknown;
  chosen_note?: unknown;
  decided_at?: unknown;
  opened_at?: unknown;
};

export type TopicDecision =
  | { kind: 'none' }
  /** Opened and still being worked. Not something the phone can advance. */
  | {
      kind: 'open';
      phase: DecisionPhase;
      openedAt: string | null;
      /**
       * THE QUESTION ITSELF, which the card was not showing.
       *
       * Without it an open decision read as "Decision open · step 2 of 5 ·
       * Working out what is really going on" — a progress bar with no subject.
       * A rep could not tell whether it concerned their estate, their pricing,
       * or something they had never heard of, and had no way to judge whether
       * to go and take part. The column has been there since migration 0022;
       * the app simply never asked for it.
       */
      situation: string | null;
    }
  | {
      kind: 'decided';
      path: ChosenPath | null;
      note: string | null;
      decidedAt: string | null;
      /** What was being decided. A verdict without its question is unreadable. */
      situation: string | null;
    };

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function phaseOf(v: unknown): DecisionPhase | null {
  return PHASES.includes(v as DecisionPhase) ? (v as DecisionPhase) : null;
}

function pathOf(v: unknown): ChosenPath | null {
  return v === 'user' || v === 'system' || v === 'hybrid' || v === 'defer' ? v : null;
}

/**
 * What the topic screen should show.
 *
 * A row that exists but whose phase is unreadable is treated as OPEN rather than
 * discarded: something is genuinely happening in this topic, and showing nothing
 * would be the one answer that is definitely wrong.
 */
export function readTopicDecision(row: TopicDecisionRow | null | undefined): TopicDecision {
  if (!row) return { kind: 'none' };
  const phase = phaseOf(row.phase);
  if (phase === 'decided') {
    return {
      kind: 'decided',
      path: pathOf(row.chosen_path),
      note: str(row.chosen_note),
      decidedAt: str(row.decided_at),
      situation: str(row.situation),
    };
  }
  return {
    kind: 'open',
    phase: phase ?? 'situation',
    openedAt: str(row.opened_at),
    situation: str(row.situation),
  };
}

/** How far through the five phases, for a progress line. */
export function phaseStep(phase: DecisionPhase): { step: number; total: number } {
  const i = PHASES.indexOf(phase);
  return { step: i < 0 ? 1 : i + 1, total: PHASES.length };
}

export function phaseLabel(phase: DecisionPhase): string {
  switch (phase) {
    case 'situation':
      return 'Describing the situation';
    case 'elicit':
      return 'Working out what is really going on';
    case 'respond':
      return 'Weighing the options';
    case 'decide':
      return 'Choosing';
    case 'decided':
      return 'Decided';
  }
}

/**
 * What was chosen, in plain words.
 *
 * `defer` reads as a real outcome, never as an absence — see the note at the
 * top of this file.
 */
export function pathLabel(path: ChosenPath | null): string {
  switch (path) {
    case 'user':
      return 'Went with the team’s own call';
    case 'system':
      return 'Went with what the coach suggested';
    case 'hybrid':
      return 'A mix of both';
    case 'defer':
      return 'Chose to wait rather than act yet';
    default:
      // Recorded as decided with no path stored. Saying which way it went would
      // be an invention; saying it is undecided would contradict the record.
      return 'Recorded, without which way it went';
  }
}
