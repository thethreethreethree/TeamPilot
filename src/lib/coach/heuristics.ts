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
  /** Stable id used in chain events. Refer to it in the readout.
   *
   *  v3 (2026-06-12) added LLM-detected citation kinds:
   *    - coach-blame-projection: "you're making me [emotion]" framings
   *      that locate the cause of one's emotional state in someone else
   *    - coach-emotional-escalation: heightened emotional language that
   *      tends to land harder than the author intends
   *    - coach-hot-state: communicating from a tired/hungry/stressed
   *      state where the System notices the message may not represent
   *      how the author will read it tomorrow
   *    - coach-aggressive-language: profanity / aggression directed
   *      at people in the conversation (not generic frustration) */
  id:
    | "nvc-evaluation"
    | "voss-bare-assertion"
    | "stone-identity-collision"
    | "coach-blame-projection"
    | "coach-emotional-escalation"
    | "coach-hot-state"
    | "coach-aggressive-language";
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
  /** Kind, compassionate, concise explanation of WHY this pattern
   *  matters in human communication. Always shown when the chip is
   *  expanded — built into the Coach's behavior per the user's
   *  directive, not gated behind an option.
   *
   *  Tone constraints (A11-aligned): general context about the
   *  pattern, never personally corrective. "When this pattern shows
   *  up in conversations…" not "you should change because…". The
   *  explanation educates; the user still renders any verdict. */
  kindExplanation: string;
};

/**
 * Per-heuristic threshold for the mirror frame (v2 → v2.1).
 *
 * Coach v2 (mirror) — the chip surfaces only when the running count
 * of past + current-draft hits >= threshold. The chip content reports
 * the count and asks the user a question; it never asserts a verdict.
 *
 * Why all thresholds are 1 in v2.1:
 *   User feedback on v2 shipped clearly: the Coach was effectively
 *   invisible because elevated thresholds (3 for nvc / voss) gated
 *   surfacing until the conversation had already drifted past the
 *   moment where guidance would have helped. The mirror frame (A11)
 *   was supposed to ENABLE surfacing earlier — not gate it later.
 *   Threshold 1 makes the Coach responsive from the first message.
 *
 * Why threshold 1 doesn't violate A11:
 *   A11 says the System reports a fact and asks a question; the user
 *   judges. A count of 1 is still a fact ("you used an absolute once
 *   in this thread"). The chip text for N=1 already asks an open
 *   question ("first occurrence — pattern starting, or fair callback?").
 *   Threshold 1 only changes WHEN the question gets asked — the
 *   System still doesn't render a verdict.
 *
 * Per asset A4, the choice of 1 is itself a §4 readout question:
 * if the early-fire dismiss rate exceeds 60% per heuristic, we revisit.
 */
export const COACH_THRESHOLDS: Record<CoachCitation["id"], number> = {
  "nvc-evaluation": 1,
  "voss-bare-assertion": 1,
  "stone-identity-collision": 1,
  "coach-blame-projection": 1,
  "coach-emotional-escalation": 1,
  "coach-hot-state": 1,
  "coach-aggressive-language": 1,
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
    case "coach-blame-projection":
      return {
        label: `Locating cause in someone else — ${occ} in ${contextLabel}`,
        question: n === 1
          ? "First occurrence — does framing it as 'they're making me feel X' land where you want, or worth leading with what's happening for you first?"
          : "Pattern — does this framing usually land, or is something else underneath?",
      };
    case "coach-emotional-escalation":
      return {
        label: `Heightened emotional language — ${occ} in ${contextLabel}`,
        question: n === 1
          ? "First occurrence — is the intensity what you want to land with, or does it overshoot what you actually want them to do?"
          : "Pattern — is the intensity working, or is it making the message harder to act on?",
      };
    case "coach-hot-state":
      return {
        label: `Signaling a hot state while sending — ${occ} in ${contextLabel}`,
        question: n === 1
          ? "First occurrence — would you read this message the same way tomorrow, or might 30 minutes change what you'd send?"
          : "Pattern — worth a hot-state pause discipline before send?",
      };
    case "coach-aggressive-language":
      return {
        label: `Direct aggression / profanity — ${occ} in ${contextLabel}`,
        question: n === 1
          ? "First occurrence — intentional, or worth saying it the other way once and seeing if it lands?"
          : "Pattern — is this the room you want to build?",
      };
  }
}

const NVC_EVALUATION_PATTERNS: ReadonlyArray<RegExp> = [
  // Absolutes about people/situations.
  /\b(always|never|constantly|forever|whenever)\b/i,
  // Diagnostic shorthand presented as fact — expanded v3 to include
  // common conversational pejoratives that the original pattern missed.
  /\b(this is|that is|this'?s|that'?s) (broken|wrong|stupid|dumb|terrible|useless|garbage|trash|awful|bs|bullshit|ridiculous|insane|absurd|crap|shit)\b/i,
  // "Obviously" / "clearly" assert the speaker's read as the only read.
  /\b(obviously|clearly|of course),?\s/i,
  // Mind-reading.
  /\b(you|they|he|she) (don't|doesn't|never) (get it|understand|listen|care)\b/i,
];

// Blame projection — locating the cause of one's emotional state in
// someone else. The pattern the user flagged ("you guys are making me
// mad") sits exactly here. We're not naming the user's feeling as
// wrong; we're surfacing the LOCATION of the cause and asking if
// that's where they want to land it.
const BLAME_PROJECTION_PATTERNS: ReadonlyArray<RegExp> = [
  // "you are/y'all are/they are making me [emotion]" (the trailing
  // pronoun "me" is optional — captures the user's "making mad" too).
  /\b(you|you guys|y'?all|they|he|she) (are|is|'re|'s) making( me)? (mad|angry|furious|upset|stressed|anxious|crazy|nuts|insane|frustrated|annoyed|miserable)\b/i,
  // "you made me [emotion]" past-tense variant
  /\b(you|you guys|y'?all|they|he|she) made me (mad|angry|furious|upset|frustrated|annoyed)\b/i,
  // "you're the reason / it's your fault" — direct blame
  /\b(you'?re the reason|it'?s your fault|because of you)\b/i,
];

// Hot-state communication — signaling tired/hungry/stressed/etc while
// composing a message. Not about whether the message is valid; about
// whether the AUTHOR would want this exact message to be the durable
// record their future-self reads tomorrow.
//
// v3.2.1 (2026-06-12) — expanded after the user reported "I'm getting
// annoyed" missed the detector. Two gaps:
//   - "annoyed" / "irritated" / "upset" / "bothered" weren't in the
//     vocabulary (we had the high-intensity tail: exhausted/burnt out)
//   - the verb phrase was rigid "I'm X" — "I'm getting X" / "I'm
//     feeling X" / "I'm starting to feel X" all slipped through
// Both classes of mistake were affecting daily-use sensitivity in
// the exact case the Coach is most needed for (low-intensity
// emotional drift that escalates if unsurfaced).
const HOT_STATE_PATTERNS: ReadonlyArray<RegExp> = [
  // First-person hot-state declarations with optional onset-verb +
  // optional intensifier. Onset verbs cover "I'm getting X" /
  // "I'm feeling X" / "I'm starting to feel X" / "I'm becoming X".
  /\b(i'?m|i am)( getting| feeling| becoming| starting to feel)?( so | really | really really | very |\s)?(hungry|starving|exhausted|tired|drained|wasted|burnt out|burned out|stressed|anxious|fried|done|over it|over this|fed up|sick of (it|this)|losing it|annoyed|irritated|upset|bothered|agitated|cranky|grumpy|on edge|frazzled|wiped|spent|cooked|toast)\b/i,
  // "Up all night / hadn't slept" sleep deprivation tells.
  /\b(up all night|haven'?t slept|no sleep|running on (fumes|empty))\b/i,
];

// Direct aggression — profanity or attacks aimed AT people in the
// conversation. Generic frustration ("this sucks") is covered by the
// NVC evaluation patterns; this is about words directed at people.
const AGGRESSIVE_LANGUAGE_PATTERNS: ReadonlyArray<RegExp> = [
  // Profanity directed at "you/they/them" — second/third-person target.
  /\b(fuck|fucking|shit|damn|hell|piss off|asshole|jackass|moron|idiot)\b.*\b(you|him|her|them|they)\b/i,
  /\b(you|him|her|them|they)\b.*\b(fuck|fucking|shit|damn|asshole|jackass|moron|idiot)\b/i,
  // Imperative aggression
  /\b(shut up|shut it|fuck off|piss off|get lost|go to hell)\b/i,
  // Direct insults targeting "you"
  /\byou'?re (a |an )?(fucking |damn |stupid |dumb )?(idiot|moron|asshole|jackass|loser|joke|fool)\b/i,
];

// Emotional escalation — heightened language that tends to overshoot
// what the author actually wants the recipient to do. Distinct from
// blame projection (which locates cause externally) and aggressive
// language (which targets a person).
const EMOTIONAL_ESCALATION_PATTERNS: ReadonlyArray<RegExp> = [
  // High-intensity self-states broadcast in a message
  /\b(i'?m|i am) (absolutely |completely |totally |utterly |so |really )?(furious|livid|enraged|outraged|disgusted|appalled|seething)\b/i,
  // "This is" + extreme judgment
  /\bthis is (absolutely |completely |totally |utterly )?(unacceptable|outrageous|inexcusable|disgraceful|appalling|disgusting|infuriating)\b/i,
  // Catastrophizing language
  /\b(disaster|catastrophe|nightmare|train wreck|dumpster fire)\b/i,
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
    kindExplanation:
      "Built-in evaluation — words like “broken,” “always,” “obviously” — often put the other person in a defensive position before they engage with what you noticed. Observation language (“the deploy retried three times in five minutes”) tends to keep conversations open, where evaluation language can stall them. Neither is universally right; it just helps to notice which one you reach for.",
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
    kindExplanation:
      "People are usually more open to a new idea when they feel heard first. A short label of the other position — “It sounds like…” or “What I'm noticing is…” — before your own move shows them you've actually understood theirs. The trade-off most people don't expect: conversations that start with a label often end up shorter, not longer.",
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
    kindExplanation:
      "When critique lands on who someone is, not what they did, the rest of the message usually doesn't make it through — they're protecting their sense of self before they can hear the content. Naming the specific behavior and its impact (“the deploy missed the migrate step, which cost us four hours”) keeps the conversation on the work, where it can actually move. The frustration is often real and fair; the framing is the part that changes whether anyone can act on it.",
  };
}

// ─── v3 detectors (regex-instant; LLM enhances via /api/coach/analyze) ─

export function detectBlameProjection(text: string): CoachCitation | null {
  const hit = firstMatch(BLAME_PROJECTION_PATTERNS, text);
  if (!hit) return null;
  return {
    id: "coach-blame-projection",
    label: "Locating cause in someone else",
    source: "ELOSTATE Coach — NVC + observation discipline",
    principle:
      "Feelings are real; the location of the cause is something the speaker chooses. Leading with 'I feel X when Y happens' tends to land better than 'you are making me X.'",
    suggestion: `"${hit.trim()}" locates the cause in another person. Worth trying: "I feel ___ when ___" to lead with what's happening for you first.`,
    triggerExcerpt: hit.trim(),
    kindExplanation:
      "When a message frames someone else as the cause of how the writer feels (\"you're making me mad\"), the recipient often hears it as an accusation before they engage with the feeling underneath. Leading with the feeling first (\"I'm getting frustrated\") followed by the specific behavior (\"…when standups go long\") tends to keep the other person open to the conversation. The frustration is real either way; the framing changes whether they can help with it.",
  };
}

export function detectEmotionalEscalation(text: string): CoachCitation | null {
  const hit = firstMatch(EMOTIONAL_ESCALATION_PATTERNS, text);
  if (!hit) return null;
  return {
    id: "coach-emotional-escalation",
    label: "Heightened emotional language",
    source: "ELOSTATE Coach — recipient-impact discipline",
    principle:
      "Intensity of language scales the intensity of the response. If you don't want a defensive response, calibrate the language to the response you actually want.",
    suggestion: `"${hit.trim()}" reads as high-intensity. If the recipient needs to act, the action gets clearer when the language is calmer.`,
    triggerExcerpt: hit.trim(),
    kindExplanation:
      "High-intensity language (\"absolutely unacceptable,\" \"disaster\") tends to elicit equally high-intensity responses — either matching escalation or defensive shutdown. If the goal is for the recipient to fix something, a calibrated message (\"this is the third time this week — can we figure out why?\") is often easier to act on. The emotion is valid; the question is whether the intensity is doing what you want.",
  };
}

export function detectHotState(text: string): CoachCitation | null {
  const hit = firstMatch(HOT_STATE_PATTERNS, text);
  if (!hit) return null;
  return {
    id: "coach-hot-state",
    label: "Composing from a hot state",
    source: "ELOSTATE Coach — self-protection discipline",
    principle:
      "Future-you is the second reader of every message. If you wouldn't send this on a full night's sleep, the pause is itself information.",
    suggestion: `"${hit.trim()}" signals you may not be in the best state to send this message. Worth a 30-minute pause to check if it'll still feel right then.`,
    triggerExcerpt: hit.trim(),
    kindExplanation:
      "Hunger, exhaustion, and stress measurably shift how we communicate — we read other people's intent more negatively and we phrase our own messages more sharply. The message itself may still be valid, but the version of you that wrote it may not be the version you want as the durable record. A short pause (food, walk, sleep) often produces a message that does the same work without the cost.",
  };
}

export function detectAggressiveLanguage(text: string): CoachCitation | null {
  const hit = firstMatch(AGGRESSIVE_LANGUAGE_PATTERNS, text);
  if (!hit) return null;
  return {
    id: "coach-aggressive-language",
    label: "Direct aggression toward a person",
    source: "ELOSTATE Coach — room-norms discipline",
    principle:
      "What gets normalized in a thread becomes the room. Profanity and direct attacks set the floor for what the team thinks they can write to each other.",
    suggestion: `"${hit.trim()}" targets a person directly. Say the same thing without the attack once, and see whether the substance gets through faster.`,
    triggerExcerpt: hit.trim(),
    kindExplanation:
      "Aggression directed at a person (versus generic frustration at a situation) tends to shape what other people in the thread think they can also write — both upward and laterally. The frustration is often real and fair; the framing is the part that changes whether anyone wants to engage with the work underneath it.",
  };
}

/**
 * Run all detectors. Returns the citation list in priority order:
 *   identity > aggression > blame > evaluation > escalation
 *   > hot-state > bare-assertion
 *
 * The UI consumes index 0 for the visible chip; the full list is
 * recorded in the chain event so we know what was suppressed.
 *
 * Priority rationale (v3, 2026-06-12):
 *   - identity + aggression land highest because they have the biggest
 *     impact on relational durability
 *   - blame projection beats generic evaluation because it's more
 *     actionable (concrete reframe available)
 *   - hot-state is mid-priority — it's about the AUTHOR's state, not
 *     the recipient's experience
 *   - bare-assertion is lowest because it's a style note, not a
 *     relational risk
 */
export function detectAll(text: string): CoachCitation[] {
  if (!text || text.trim().length < 6) return [];
  const all: CoachCitation[] = [];
  const identity = detectIdentityCollision(text);
  if (identity) all.push(identity);
  const aggression = detectAggressiveLanguage(text);
  if (aggression) all.push(aggression);
  const blame = detectBlameProjection(text);
  if (blame) all.push(blame);
  const evaluation = detectNvcEvaluation(text);
  if (evaluation) all.push(evaluation);
  const escalation = detectEmotionalEscalation(text);
  if (escalation) all.push(escalation);
  const hotState = detectHotState(text);
  if (hotState) all.push(hotState);
  const assertion = detectBareAssertion(text);
  if (assertion) all.push(assertion);
  return all;
}
