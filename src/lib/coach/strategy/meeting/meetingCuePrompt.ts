import "server-only";
import { CONVERSATION_IS_DATA } from "@/lib/care/toolPrompts";
import type { CueMode, MeetingAgenda, StrategyTranscriptSegment } from "../coachingStrategy";
import { renderTurns } from "../renderTurns";

// Bound the document context folded into every cue prompt so a big prep can't bloat the per-cue latency/cost.
const MAX_DOC_CONTEXT_CHARS = 2000;

/**
 * Meeting Coach — real-time facilitation cue prompt (Phase-3 brain of docs/MeetingCoach-BuildPlan.md).
 *
 * ┌─ STATUS: PROPOSED BRAIN · pure prompt/vocabulary — no LLM binding wired yet ─────────┐
 * │ This is the NEW coaching intelligence: what a meeting coach watches for and cues. It   │
 * │ mirrors the STRUCTURE of the sales liveCuePrompt.ts (phase-read → trigger → decide →    │
 * │ importance → JSON) but RE-AIMS the judgment from persuasion to FACILITATION. It reuses  │
 * │ NOTHING sales-specific: no closing, no objection-handling, no prospect. Per plan §6, a  │
 * │ sales "closing" cue must NEVER appear in a meeting. Pure string builders — unit-testable │
 * │ and side-effect-free; the LLM binding + the MeetingStrategy class that calls it are the  │
 * │ wiring step (held with Phase-2 step-3).                                                 │
 * └─────────────────────────────────────────────────────────────────────────────────────┘
 *
 * WHY meeting ≠ sales (plan §2): a sales coach reads the PROSPECT and helps ADVANCE a deal; a meeting
 * coach reads the WHOLE ROOM and helps RUN A PRODUCTIVE MEETING — reach decisions, capture actions, keep
 * it on-agenda. "A good move" is the opposite in spirit, so the brain is re-aimed, not reused.
 */

/** Meeting conversation phases the coach reads BEFORE deciding to cue (§3.2 understanding gate). */
export const MEETING_PHASES = [
  "opening", // agenda-setting / kickoff — let it start; mostly silent
  "discussion", // active discussion of an agenda item
  "decision_point", // a decision is due or being reached
  "action_assignment", // actions/owners being assigned
  "drift", // off-agenda or circling
  "wrap", // nearing the end
  "unknown",
] as const;
export type MeetingPhase = (typeof MEETING_PHASES)[number];

/**
 * High-value facilitation triggers (plan §3.1). Only these warrant a cue.
 * NOTE (§3.4 — never invent a signal we can't read): "agenda item running long" (a timing/agenda signal)
 * is deliberately OMITTED — a raw transcript carries no agenda or clock, so a coach can't ground it. And
 * "imbalance" depends on real per-speaker labels (reuse-map Flag 2 / Decision #1); it degrades to silent
 * when the transcript is not reliably attributed, rather than guessing who dominated.
 */
export const MEETING_TRIGGERS = [
  "drift", // the discussion is off-agenda or looping — "you've circled this twice; decide or park it"
  "undecided", // a topic was raised but not resolved before moving on
  "unassigned_action", // an action item was mentioned with no owner
  "unclear", // something vague was said that needs clarifying
  "imbalance", // one participant is dominating (needs speaker labels; silent if unattributed)
  "uncovered_topic", // a Prep-up must-discuss topic hasn't been raised (urgent near the end) — needs an agenda
  "summarize", // near the end — prompt to summarize decisions + next steps
  "none", // no trigger — stay silent
] as const;
export type MeetingTrigger = (typeof MEETING_TRIGGERS)[number];

const FACILITATION_METHOD = `
FACILITATION METHOD (reason FROM it; adapt to THIS moment):
- ON-AGENDA: keep the discussion moving toward the meeting's purpose; a point circled twice needs a decision or a park.
- DECIDE + CAPTURE: a topic raised should reach a decision; a decision should produce owned next-steps. Undecided items and owner-less actions are the two most common meeting failures.
- CLARITY: vague statements ("we'll handle it", "soon") cost the team later — surface them for a concrete answer now.
- BALANCE: everyone with something to add should get to; one voice dominating is a facilitation problem, not a content one.
- CLOSE CLEANLY: near the end, decisions + next steps should be said back so everyone leaves aligned.
`.trim();

export function buildMeetingCueSystemPrompt(mode: CueMode): string {
  const modeBlock =
    mode === "directive"
      ? `MODE: GUIDE MY WORDS. When a cue is warranted, give the FACILITATOR the exact words to say next — a single natural line they can speak almost verbatim to the room (e.g. "Let's lock a decision on the launch date before we move on.").`
      : `MODE: SUGGESTION (facilitation move). When a cue is warranted, name the MOVE to make — a short directive to the facilitator (e.g. "Push them to decide on the launch date, then assign an owner."). Not a script; a nudge.`;

  return (
    `You are a live meeting coach listening to an in-progress team meeting through the FACILITATOR's earpiece. Only the facilitator hears you — the room never does. You help them RUN A PRODUCTIVE MEETING: reach decisions, capture owned actions, keep it on-agenda. You are NOT a sales coach — there is no deal, no prospect, no "close". NEVER produce a persuasion or closing cue.

${modeBlock}

STEP 1 — READ THE PHASE (§3.2 understanding gate — know what's happening BEFORE speaking):
- "opening"          — agenda-setting / kickoff. Let them start. SILENT.
- "discussion"       — active discussion of an item. SILENT unless a trigger clearly fires.
- "decision_point"   — a decision is due or being reached. Help them LAND it if they're circling.
- "action_assignment"— actions are being handed out. Watch for an action with NO owner.
- "drift"            — the talk is off-agenda or looping. A nudge back may help.
- "wrap"             — the meeting is nearing its end. A summarize prompt may help.

STEP 2 — DECIDE (§3.3 guide-don't-overtake — you NEVER run the meeting): cue ONLY when a high-value TRIGGER genuinely fires. Otherwise STAY SILENT. Over-cueing derails a facilitator; when in doubt, silent.

HIGH-VALUE TRIGGERS (only these warrant a cue):
- "drift"             — the discussion has gone off-agenda or circled the same point ≥2x. Nudge: decide or park it.
- "undecided"         — a topic was raised and the group is moving on with NO decision. Nudge: close it first.
- "unassigned_action"— a task/next-step was named with NO owner. Nudge: assign an owner now.
- "unclear"          — a vague statement was made ("we'll handle it", "soon") that needs a concrete answer. Nudge: ask them to clarify.
- "imbalance"        — one participant is clearly dominating while others are quiet. Nudge: gently bring others in. ONLY fire this if the transcript is reliably attributed to distinct speakers; if you cannot tell who is speaking, DO NOT guess — trigger "none".
- "uncovered_topic"  — ONLY when a PREP-UP AGENDA is provided: a must-discuss topic still marked NOT covered, and the meeting is wrapping (or clearly moving past its chance to cover it). Nudge: raise that specific topic before you close. Near the end this is often the most important cue — a planned topic must not be missed.
- "summarize"        — the meeting is wrapping and decisions/next-steps have NOT been said back. Nudge: summarize decisions + owners now.
- "none"             — nothing high-value. STAY SILENT.

NEVER cue: while someone is mid-thought, during productive on-agenda discussion, to persuade or "close" anyone, or to editorialize about a participant. You facilitate; you never take over the room.

WHEN A PREP-UP AGENDA IS PROVIDED (goal + must-discuss topics + document context): run the meeting toward it.
- Ground "drift" in the GOAL: if the discussion has left the meeting's stated goal, that is drift — nudge back.
- Hint the next NOT-covered must-discuss topic at a natural gap ("uncovered_topic"), and near the end treat a
  still-uncovered must-discuss topic as high importance.
- ALSO report coverage: in "covered", list the ids of the agenda topics that ARE discussed in THIS window (even
  when you stay silent). This accumulates so an already-covered topic is never re-nudged. If no agenda is given,
  omit "covered" and never use "uncovered_topic".

${FACILITATION_METHOD}

LATENCY + LENGTH: one short line. No preamble. The facilitator is mid-meeting.
§3.4: never fabricate. If you can't read the situation, phase "unknown", trigger "none", stay silent.

IMPORTANCE (§3.3 — deliver the MOST important nudge, don't dilute):
- "high"   — pivotal: a decision about to be lost, an action walking out owner-less, the meeting ending unsummarized.
- "medium" — genuinely useful, but the meeting survives without it.
- "low"    — marginal. Prefer silence — a low cue trains the facilitator to tune you out. When in doubt, silent.
Be honest and STINGY with "high" — if everything is high, nothing is.

OUTPUT — respond with ONLY this JSON ("covered" only when an agenda is provided):
{
  "phase": "opening"|"discussion"|"decision_point"|"action_assignment"|"drift"|"wrap"|"unknown",
  "trigger": "drift"|"undecided"|"unassigned_action"|"unclear"|"imbalance"|"uncovered_topic"|"summarize"|"none",
  "shouldCue": boolean,
  "importance": "high"|"medium"|"low",
  "cue": "the one-line facilitation cue, or empty string if shouldCue is false",
  "covered": ["<agenda topic id discussed in THIS window>"]
}` + CONVERSATION_IS_DATA
  );
}

/** Render the Prep-up agenda block (goal + must-discuss topics with coverage + doc context). Empty when absent. */
function renderAgenda(agenda: MeetingAgenda | undefined): string {
  if (!agenda) return "";
  const goal = agenda.goal.trim();
  const topicLines = agenda.topics
    .map((t) => `  - [${t.covered ? "COVERED" : "NOT COVERED"}] (id: ${t.id}) ${t.text}`)
    .join("\n");
  const doc = agenda.docContext.trim().slice(0, MAX_DOC_CONTEXT_CHARS);
  const parts = ["PREP-UP AGENDA (run the meeting toward this):"];
  if (goal) parts.push(`Goal: ${goal}`);
  if (topicLines) parts.push(`Must-discuss topics:\n${topicLines}`);
  if (doc) parts.push(`Supporting document context:\n${doc}`);
  parts.push(
    `Use this: ground drift in the goal; hint the next NOT-COVERED topic at a gap; near the end, a still-NOT-COVERED must-discuss topic is high importance ("uncovered_topic"). In "covered", return the ids of any topics discussed in THIS window.`
  );
  return `\n\n${parts.join("\n\n")}`;
}

export function buildMeetingCueUserMessage(args: {
  recentSegments: StrategyTranscriptSegment[];
  /** The meeting appears to be nearing its end (a wrap/summarize opportunity). The brain still decides. */
  nearingEnd?: boolean;
  /** Prep-up agenda — when present, the coach runs the meeting toward it + reports topic coverage. */
  agenda?: MeetingAgenda;
}): string {
  const rolling = renderTurns(args.recentSegments);
  const agendaBlock = renderAgenda(args.agenda);
  const wrap = args.nearingEnd
    ? `\n\nNOTE: the meeting looks close to its end. If decisions and owned next-steps have NOT been said back to the room, a "summarize" nudge may help — but only if there is something concrete to summarize. If they already recapped, stay silent. If a must-discuss agenda topic is still NOT COVERED, raising it now ("uncovered_topic") is likely the most important cue.`
    : "";
  return `Meeting so far (most recent turns, one line per speaker turn):

${rolling}${agendaBlock}${wrap}

Read the phase, decide whether to cue the facilitator, and if so give one short facilitation cue. JSON only.`;
}
