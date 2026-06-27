import "server-only";
import type { TranscriptSegment, CueMode, SalesContext } from "@/lib/data/salesCoach";

/**
 * Live Sales Coach — real-time cue prompts.
 *
 * Two modes (founder spec):
 *   - 'suggestion'    → a tactic/strategy CALL: what move to make next.
 *   - 'guide_response'→ coach EXACTLY what to say (a line the agent can
 *                       speak almost verbatim).
 *
 * Constitutional shape:
 *   - §3.3 understanding gate: READ the situation before advising. The
 *     coach must decide whether a cue is even warranted right now — it
 *     does NOT dump a cue on every turn. If there's no clear high-value
 *     move, it stays silent (shouldCue:false). Over-cueing is the
 *     opposite of the founder's "training wheels come off" intent.
 *   - latency-above-all: cues are ONE short line. Never a paragraph —
 *     the agent is mid-conversation.
 *   - §3.4: never fabricate. If the transcript is too thin to read the
 *     situation, stay silent.
 */

const METHODOLOGY = `
SALES METHODOLOGY (reason FROM it; adapt to THIS moment):
- DISCOVERY: understand the real need before pitching; open questions.
- RAPPORT: trust precedes persuasion; acknowledge concerns as legitimate.
- OBJECTION HANDLING: objections are information — acknowledge, understand
  the real concern, then address it; never steamroll.
- PACING: match the customer's readiness; don't close before value lands.
- CLOSING: make the next step easy and clear when value is established.
`.trim();

export function buildLiveCueSystemPrompt(mode: CueMode): string {
  const modeBlock =
    mode === "guide_response"
      ? `MODE: GUIDE MY RESPONSE. When a cue is warranted, give the agent
the EXACT words to say next — a single natural line they can speak
almost verbatim. First person, conversational, fits the moment.`
      : `MODE: SUGGESTION (tactic/strategy). When a cue is warranted, name
the MOVE to make next — a short directive (e.g. "Ask about their
timeline before pitching"). Not a script; a tactical nudge.`;

  return `You are a live sales coach listening to an in-progress conversation
through the agent's earpiece. Only the AGENT hears you — the customer
never does.

${modeBlock}

THE UNDERSTANDING GATE (§3.3) — decide FIRST whether to speak at all:
- Read what is actually happening in the last few turns.
- Cue ONLY when there is a clear, high-value move the agent is missing
  or about to fumble. If the agent is doing fine, STAY SILENT.
- A late or noisy cue is worse than no cue. When in doubt, stay silent.
- You are training wheels meant to come off: do not cue for the sake of
  cueing.

${METHODOLOGY}

LATENCY + LENGTH: one short line. No preamble, no explanation in the cue
itself. The agent is mid-sentence.

OUTPUT — respond with ONLY this JSON:
{
  "shouldCue": boolean,   // false = stay silent this moment
  "cue": "the one-line cue, or empty string if shouldCue is false"
}`;
}

function speakerLabel(speaker: TranscriptSegment["speaker"]): string {
  if (speaker === "agent") return "AGENT";
  if (speaker === "customer") return "CUSTOMER";
  return "UNKNOWN";
}

export function buildLiveCueUserMessage(args: {
  context?: SalesContext;
  recentSegments: TranscriptSegment[];
}): string {
  const ctx = args.context
    ? `Context: ${args.context === "in_person" ? "in-person, door-to-door" : "online video call"}\n\n`
    : "";
  const rolling = args.recentSegments
    .map((s) => `${speakerLabel(s.speaker)}: ${s.text}`)
    .join("\n");
  return `${ctx}Conversation so far (most recent turns):

${rolling}

Decide whether to cue right now, and if so give one short cue. JSON only.`;
}
