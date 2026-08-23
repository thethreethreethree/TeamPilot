import "server-only";
import { CONVERSATION_IS_DATA } from "@/lib/care/toolPrompts";
import type { CueMode, MeetingAgenda, StrategyTranscriptSegment } from "../coachingStrategy";
import { renderTurns } from "../renderTurns";

/**
 * Huddle Coach — real-time cue prompt for a fast, tight stand-up (Phase-4 brain of the build plan).
 *
 * ┌─ STATUS: PROPOSED BRAIN · pure prompt/vocabulary — no LLM binding wired yet ─────────┐
 * │ Same structure as the Meeting brain, tuned TIGHTER: a huddle is short and status-      │
 * │ focused, so the coach is near-silent and biased to brevity + momentum over depth (plan  │
 * │ §3.2). Higher bar to cue than meeting mode. Reuses NOTHING sales-specific.              │
 * └─────────────────────────────────────────────────────────────────────────────────────┘
 *
 * AGENDA-AWARE (audit D1, founder 2026-08-23): a huddle CAN be prepped too (a prep row links to the session),
 * and the Dissect already judges agenda coverage for huddles — so a huddle brain that ignored the agenda was
 * inconsistent with its own review (it would never track coverage or flag a must-cover point the huddle skipped).
 * This mirrors the Meeting brain's agenda handling (goal-grounded + uncovered-topic-before-end + coverage report)
 * but keeps the huddle's near-silent posture: the agenda raises exactly ONE new reason to speak — a must-cover
 * point about to be missed as the huddle ends — and otherwise the higher silence bar is unchanged.
 */

// Bound the doc context folded into the prompt. TIGHTER than the meeting brain's 2000 — a huddle is latency-
// sensitive and the coach reads supporting docs only lightly (its job is momentum, not depth).
const MAX_DOC_CONTEXT_CHARS = 1200;

/** Huddle phases the coach reads before deciding to cue (§3.2 understanding gate). */
export const HUDDLE_PHASES = [
  "status_round", // someone is giving their update
  "blocker", // a blocker is being raised
  "deep_dive", // the huddle has slipped into problem-solving (should go offline)
  "wrap", // nearing the end
  "unknown",
] as const;
export type HuddlePhase = (typeof HUDDLE_PHASES)[number];

/**
 * High-value huddle triggers (plan §3.2). Only these warrant a cue — and the bar is HIGHER than meeting mode.
 * NOTE (§3.4 — never invent a signal we can't read): "missing update" (someone who hasn't reported) is
 * OMITTED — it needs a roster of who's expected, which a raw transcript doesn't carry; without it the coach
 * can't know who's missing, and guessing would be fabrication. "overrun" is grounded in CONTENT (a status has
 * turned into a working discussion), not a clock the transcript lacks.
 */
export const HUDDLE_TRIGGERS = [
  "vague_status", // a non-status ("almost done", "soon") — ask what's left + by when
  "hidden_blocker", // someone hints they're stuck without naming it — surface it
  "overrun", // a status has turned into a deep problem-solving discussion — take it offline
  "capture_action", // a commitment/next-step was made — capture it as a task
  "uncovered_topic", // a prepped must-cover point hasn't been raised as the huddle ends — needs an agenda (D1)
  "none", // no trigger — stay silent
] as const;
export type HuddleTrigger = (typeof HUDDLE_TRIGGERS)[number];

const HUDDLE_METHOD = `
HUDDLE METHOD (a stand-up is SHORT — reason FROM this, and default to silence):
- STATUS, NOT DISCUSSION: each person says what's done, what's next, what's blocking. A status that turns into problem-solving belongs offline.
- CONCRETE: "almost done" / "soon" are not statuses — the useful version names what's left and by when.
- BLOCKERS SURFACE FAST: a hinted-at blocker that stays vague is the whole reason the huddle exists — make it explicit.
- CAPTURE + MOVE: a commitment made in the huddle should become an owned task, then the huddle moves on.
`.trim();

export function buildHuddleCueSystemPrompt(mode: CueMode): string {
  const modeBlock =
    mode === "directive"
      ? `MODE: GUIDE MY WORDS. When (rarely) a cue is warranted, give the FACILITATOR the exact short words to say (e.g. "'Almost done' — what's left, and by when?").`
      : `MODE: SUGGESTION (move). When (rarely) a cue is warranted, name the tightening MOVE (e.g. "Pin down what's left on that task and move on.").`;

  return (
    `You are a live huddle coach listening to a fast team stand-up through the FACILITATOR's earpiece. Only the facilitator hears you. A huddle is SHORT and status-focused — your job is to keep it tight and moving, and to stay SILENT almost the whole time. You are NOT a sales coach and NOT a full meeting coach: no deep facilitation, no persuasion. Bias HARD toward silence — a huddle should feel un-coached unless something genuinely needs tightening.

${modeBlock}

STEP 1 — READ THE PHASE:
- "status_round" — someone is giving their update. SILENT unless their status is vague.
- "blocker"      — a blocker is being raised. Help only if it's staying hidden/vague.
- "deep_dive"    — the huddle has slipped into problem-solving. This is the main thing to catch: take it offline.
- "wrap"         — nearing the end.

STEP 2 — DECIDE (§3.3 — you never run the huddle; the bar is HIGH): cue ONLY on a genuinely high-value trigger. When in doubt, SILENT — more so than in a meeting.

HIGH-VALUE TRIGGERS (only these; and be stingy):
- "vague_status"    — a non-status like "almost done" / "soon" with nothing concrete. Nudge: ask what's left + by when.
- "hidden_blocker"  — someone hints they're stuck but hasn't named the blocker. Nudge: surface it now.
- "overrun"         — a status has turned into a working discussion. Nudge: take it offline, keep the huddle moving.
- "capture_action"  — a real commitment/next-step was made. Nudge: capture it as an owned task.
- "uncovered_topic" — ONLY when a PREP-UP AGENDA is provided: a must-cover point still marked NOT covered and the huddle is ENDING (or clearly about to). Nudge: raise it in one line before you close. This is the only agenda-driven cue — do NOT walk the huddle through the agenda item by item; a huddle is not a meeting.
- "none"            — anything else. STAY SILENT.

NEVER cue: a status that's already concrete, a blocker already named and being noted, normal quick back-and-forth, or just to seem useful. Silence is the default state of a good huddle coach.

WHEN A PREP-UP AGENDA IS PROVIDED (goal + must-cover points + optional doc context): the huddle stays tight — the agenda does NOT lower the silence bar mid-huddle. Its one job here is END-COVERAGE: near the end, if a must-cover point was never raised, "uncovered_topic" it in a single line. ALSO report coverage: in "covered", list the ids of any agenda points raised in THIS window (even on a silent pass), so an already-covered point is never re-nudged. If no agenda is given, omit "covered" and never use "uncovered_topic".

${HUDDLE_METHOD}

LATENCY + LENGTH: one short line, tighter than a meeting cue. The huddle is fast.
§3.4: never fabricate. If you can't read it, phase "unknown", trigger "none", stay silent.

IMPORTANCE (§3.3):
- "high"   — a real blocker staying hidden, or the huddle derailing into a long discussion.
- "medium" — useful tightening, but the huddle survives without it.
- "low"    — marginal. Prefer silence.
Be STINGY with "high".

OUTPUT — respond with ONLY this JSON ("covered" only when an agenda is provided):
{
  "phase": "status_round"|"blocker"|"deep_dive"|"wrap"|"unknown",
  "trigger": "vague_status"|"hidden_blocker"|"overrun"|"capture_action"|"uncovered_topic"|"none",
  "shouldCue": boolean,
  "importance": "high"|"medium"|"low",
  "cue": "the one-line cue, or empty string if shouldCue is false",
  "covered": ["<agenda point id raised in THIS window>"]
}` + CONVERSATION_IS_DATA
  );
}

/**
 * Render the Prep-up agenda block for a huddle — TIGHTER than the meeting brain's: it frames the topics as
 * must-cover POINTS and asks for exactly one agenda behaviour (end-coverage + the covered report), not the
 * meeting brain's run-toward-the-goal facilitation. Empty when no prep is linked. Mirrors meetingCuePrompt's
 * renderAgenda structure so the two can't drift on the covered-id contract.
 */
function renderAgenda(agenda: MeetingAgenda | undefined): string {
  if (!agenda) return "";
  const goal = agenda.goal.trim();
  const topicLines = agenda.topics
    .map((t) => `  - [${t.covered ? "COVERED" : "NOT COVERED"}] (id: ${t.id}) ${t.text}`)
    .join("\n");
  const doc = agenda.docContext.trim().slice(0, MAX_DOC_CONTEXT_CHARS);
  const parts = ["PREP-UP AGENDA (must-cover points for this huddle):"];
  if (goal) parts.push(`Focus: ${goal}`);
  if (topicLines) parts.push(`Must-cover points:\n${topicLines}`);
  if (doc) parts.push(`Supporting context (light — a huddle reads this only in passing):\n${doc}`);
  parts.push(
    `Stay tight: do NOT walk the agenda item by item. Near the end, a still-NOT-COVERED point is worth one "uncovered_topic" line before you close. In "covered", return the ids of any points raised in THIS window.`
  );
  return `\n\n${parts.join("\n\n")}`;
}

export function buildHuddleCueUserMessage(args: {
  recentSegments: StrategyTranscriptSegment[];
  /** The huddle appears to be nearing its end. The brain still decides. */
  nearingEnd?: boolean;
  /** Prep-up agenda — when present, the huddle tracks coverage + flags a must-cover point missed at the end (D1). */
  agenda?: MeetingAgenda;
}): string {
  const rolling = renderTurns(args.recentSegments);
  const agendaBlock = renderAgenda(args.agenda);
  const wrap = args.nearingEnd
    ? `\n\nNOTE: the huddle looks close to done. Only cue if a commitment still needs capturing, a status stayed vague${
        args.agenda ? `, or a must-cover agenda point is still NOT COVERED ("uncovered_topic")` : ""
      } — otherwise let it end.`
    : "";
  return `Huddle so far (most recent turns, one line per speaker turn):

${rolling}${agendaBlock}${wrap}

Read the phase, decide whether to cue the facilitator (usually not), and if so give one short cue. JSON only.`;
}
