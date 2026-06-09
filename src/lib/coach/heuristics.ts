/**
 * Conversational Coach v1 — heuristic detectors.
 *
 * Three detectors, one per source framework, regex-first. The scope
 * decision to start with regex (not LLM) is recorded as a §4-readout
 * uncertainty per Asset A4: "whether regex is sharp enough is part of
 * the readout, not a pre-decision." If the dismiss-rate of any
 * heuristic exceeds ~60% across 60 days, we revisit.
 *
 * Each detector returns ZERO OR MORE matches. The Coach UI shows at
 * most one citation per draft (priority order: identity > evaluation
 * > assertion — identity collisions are highest-stakes), but every
 * triggered detector still emits a chain event so the readout can see
 * what would have fired even when we didn't surface it.
 *
 * Detection style: lexical patterns over the draft string. We do NOT
 * call an LLM here in v1 — partly to keep latency near zero (the
 * Coach has to feel instant to be useful), partly because the §4
 * readout has to know if the cheaper signal is sufficient.
 */

export type CoachCitation = {
  /** Stable id used in chain events. Refer to it in the readout. */
  id: "nvc-evaluation" | "voss-bare-assertion" | "stone-identity-collision";
  /** Short label shown on the chip. Human-readable. */
  label: string;
  /** The framework this comes from. */
  source: string;
  /** One-line principle the user is being invited to apply. */
  principle: string;
  /** Optional refinement suggestion shown when the user expands the chip. */
  suggestion: string;
  /** Excerpt that triggered the detector (used in the chain payload). */
  triggerExcerpt: string;
};

/**
 * Per-heuristic threshold for the mirror frame (v2).
 *
 * Coach v2 (mirror) — the chip surfaces only when the running count
 * of past + current-draft hits >= threshold. The chip content reports
 * the count and asks the user a question; it never asserts a verdict.
 *
 * Identity-collision has a lower threshold because identity attacks
 * carry higher stakes — a single occurrence is worth surfacing. The
 * mirror still doesn't judge it ("first occurrence — intentional, or
 * pattern starting?"), but the surfacing fires earlier.
 *
 * Per asset A4 (defer uncertainties to evidence), these starting
 * values are recorded as §4 readout questions, not pre-decisions.
 * The readout shows per-heuristic accept rate by threshold so we can
 * tune later from real data.
 */
export const COACH_THRESHOLDS: Record<CoachCitation["id"], number> = {
  "nvc-evaluation": 3,
  "voss-bare-assertion": 3,
  "stone-identity-collision": 1,
};

/**
 * Build the count + question chip text for the mirror frame.
 * Replaces the v1 verdict assertion ("Reads as evaluation").
 *
 * The shape is always:
 *   <pattern summary including count> + <question, never a judgment>
 *
 * The user is the one rendering the verdict. The System reports a
 * fact (a count) and asks. See A11 (revised).
 */
export function mirrorChipText(
  citationId: CoachCitation["id"],
  totalCount: number,
  contextLabel: string = "this thread"
): { label: string; question: string } {
  const n = totalCount;
  const occ = n === 1 ? "once" : `${n} times`;
  switch (citationId) {
    case "nvc-evaluation":
      return {
        label: `Absolute / judgmental phrasing — ${occ} in ${contextLabel}`,
        question: n === 1
          ? "First occurrence — pattern starting, or fair callback to a real situation?"
          : "Pattern, or fair callbacks to a real situation?",
      };
    case "voss-bare-assertion":
      return {
        label: `Assertion before label — ${occ} in ${contextLabel}`,
        question: n === 1
          ? "First occurrence — has the other side already been heard, or worth opening with a label?"
          : "Pattern, or has the other side already been heard each time?",
      };
    case "stone-identity-collision":
      return {
        label: `Critique of person, not behavior — ${occ} in ${contextLabel}`,
        question: n === 1
          ? "First occurrence — intentional escalation, or worth trading 'who they are' for 'what happened'?"
          : "Pattern — worth pausing on, or all intentional?",
      };
  }
}

const NVC_EVALUATION_PATTERNS: ReadonlyArray<RegExp> = [
  // Absolutes about people/situations.
  /\b(always|never|constantly|forever|whenever)\b/i,
  // Diagnostic shorthand presented as fact.
  /\b(this is|that is) (broken|wrong|stupid|terrible|useless|garbage)\b/i,
  // "Obviously" / "clearly" assert the speaker's read as the only read.
  /\b(obviously|clearly|of course),?\s/i,
  // Mind-reading.
  /\b(you|they|he|she) (don't|doesn't|never) (get it|understand|listen|care)\b/i,
];

const VOSS_ASSERTION_PATTERNS: ReadonlyArray<RegExp> = [
  // Direct prescription at start of message (no label of the other side first).
  /^\s*(we should|you should|let's just|the answer is|the fix is)\b/i,
  // "I think we need to" without prior question or acknowledgment.
  /^\s*i (think|believe|feel) (we|you) (should|need to|have to|must)\b/i,
];

const STONE_IDENTITY_PATTERNS: ReadonlyArray<RegExp> = [
  // Person-as-trait, not behavior.
  /\b(you('?re| are)|they('?re| are)|he is|she is|that person is) (incompetent|lazy|stupid|amateur|clueless|hopeless|useless|toxic|a joke|out of their depth|in over their head)\b/i,
  /\b(can't be trusted|doesn't belong here|shouldn't be here|won't ever (get|learn|change))\b/i,
];

function firstMatch(
  patterns: ReadonlyArray<RegExp>,
  text: string
): string | null {
  for (const p of patterns) {
    const m = text.match(p);
    if (m && m[0]) return m[0];
  }
  return null;
}

export function detectNvcEvaluation(text: string): CoachCitation | null {
  const hit = firstMatch(NVC_EVALUATION_PATTERNS, text);
  if (!hit) return null;
  return {
    id: "nvc-evaluation",
    label: "Reads as evaluation, not observation",
    source: "Nonviolent Communication — Rosenberg",
    principle:
      "Strip the evaluation from the observation. Describe behavior the other person could acknowledge before they react.",
    suggestion: `Try restating the observable behavior. "${hit.trim()}" is a judgment — what specifically did you notice happen?`,
    triggerExcerpt: hit.trim(),
  };
}

export function detectBareAssertion(text: string): CoachCitation | null {
  const hit = firstMatch(VOSS_ASSERTION_PATTERNS, text);
  if (!hit) return null;
  return {
    id: "voss-bare-assertion",
    label: "Assertion before label",
    source: "Never Split the Difference — Voss",
    principle:
      "Label the other person's position before asserting yours. Tactical empathy first — it earns the right to be heard.",
    suggestion: `Open with a label of where they are: "It sounds like…" or "What I'm noticing is…" before you say "${hit.trim()}"`,
    triggerExcerpt: hit.trim(),
  };
}

export function detectIdentityCollision(text: string): CoachCitation | null {
  const hit = firstMatch(STONE_IDENTITY_PATTERNS, text);
  if (!hit) return null;
  return {
    id: "stone-identity-collision",
    label: "Identity, not behavior",
    source: "Difficult Conversations — Stone, Patton, Heen",
    principle:
      "Critique the behavior and its impact, not the person. Identity-level critique triggers defensiveness before content lands.",
    suggestion: `"${hit.trim()}" is identity. What specifically did they do, and what was its impact? Trade who they are for what happened.`,
    triggerExcerpt: hit.trim(),
  };
}

/**
 * Run all detectors. Returns the citation list in priority order
 * (identity > evaluation > assertion). The UI consumes index 0 for
 * the visible chip; the full list is recorded in the chain event so
 * we know what was suppressed.
 */
export function detectAll(text: string): CoachCitation[] {
  if (!text || text.trim().length < 6) return [];
  const all: CoachCitation[] = [];
  const identity = detectIdentityCollision(text);
  if (identity) all.push(identity);
  const evaluation = detectNvcEvaluation(text);
  if (evaluation) all.push(evaluation);
  const assertion = detectBareAssertion(text);
  if (assertion) all.push(assertion);
  return all;
}
