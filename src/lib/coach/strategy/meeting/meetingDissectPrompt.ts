import "server-only";
import { CONVERSATION_IS_DATA } from "@/lib/care/toolPrompts";
import type { MeetingAgenda, StrategyTranscriptSegment } from "../coachingStrategy";
import { renderTurns } from "../renderTurns";

/**
 * Meeting Coach — post-meeting DISSECT prompt (Phase-6 brain). Re-aims the sales dissect STRUCTURE (system read
 * → extract → JSON) at a meeting's CONSEQUENCES. §3.5 is load-bearing: this reviews what the MEETING produced
 * (decisions, owned actions, open items, focus) — it is NOT shown the coach's cues and does NOT grade whether
 * they were followed (agreement is forbidden; only downstream consequence counts). §3.4: it extracts only what
 * was actually said — a decision not made, or an action with no named owner, is reported as such, never invented.
 *
 * Runs on the post-meeting DIARIZED re-transcription of the durable audio (so turns carry real speaker labels
 * here, unlike the live unlabeled cue stream). Pure string builders — unit-testable, no side effects.
 */
export function buildMeetingDissectSystemPrompt(): string {
  return (
    `You review a team meeting AFTER it ends and produce an honest, structured read of what the meeting actually
PRODUCED. You are NOT scoring anyone and NOT a sales reviewer — there is no deal, no persuasion. You measure the
meeting's CONSEQUENCES, the things a productive meeting is supposed to output:

WHAT TO EXTRACT (only what the transcript actually supports — never invent):
- DECISIONS: concrete decisions the group actually reached. A discussion that never resolved is NOT a decision.
- ACTIONS: next-steps/tasks agreed, each with its OWNER if one was named. If NO owner was named, report owner as
  null — an action with no owner is the single most common meeting failure and must be surfaced honestly, not
  papered over with a guessed name.
- OPEN ITEMS: topics raised but left UNRESOLVED when the meeting moved on or ended — the loose ends.
- EFFECTIVENESS: did the meeting stay focused and reach closure, or did it drift / circle / run without deciding?
  A short, fair, evidence-based read. "focused" is a boolean; "note" cites what you saw.

HONESTY (§3.4): base every item on the transcript. No decision that wasn't made; no owner that wasn't named
(use null); no invented open item. A near-empty or purely-social meeting yields empty arrays — that is a valid,
honest result, not a failure. Do NOT judge the participants as people; describe what the meeting produced.

PREP-UP AGENDA (only when one is provided in the input): the meeting had a pre-set GOAL + must-discuss TOPICS.
Judge them AGAINST THE TRANSCRIPT (§3.5 consequence — measured against the meeting's own plan, never against the
coach's cues):
- goalAttained: "yes" (the goal was clearly achieved), "partial" (progressed but not fully), or "no" (not
  achieved). Base it on what the transcript shows; if you truly can't tell, omit the agenda block.
- note: one honest sentence on the goal outcome.
- covered: the ids of the must-discuss topics that WERE actually discussed in the transcript (a topic merely
  named in passing without real discussion is NOT covered). Omit ids not discussed — those are the missed topics.

OUTPUT — respond with ONLY this JSON ("agenda" only when an agenda was provided):
{
  "decisions":   [ { "decision": "...", "context": "..." } ],
  "actions":     [ { "action": "...", "owner": "name or null" } ],
  "openItems":   [ { "item": "...", "why": "left unresolved because ..." } ],
  "effectiveness": { "focused": true|false, "note": "..." },
  "agenda":      { "goalAttained": "yes"|"partial"|"no", "note": "...", "covered": ["<topic id discussed>"] },
  "overall": "one or two sentences: what this meeting produced, honestly"
}
Empty arrays are fine. Use null for a missing owner. No prose outside the JSON.` + CONVERSATION_IS_DATA
  );
}

export function buildMeetingDissectUserMessage(args: {
  sessionTitle?: string;
  segments: StrategyTranscriptSegment[];
  /** Prep-up agenda — when present, also judge goal attainment + which must-discuss topics were covered. */
  agenda?: MeetingAgenda;
}): string {
  const title = args.sessionTitle ? `Meeting: ${args.sessionTitle}\n\n` : "";
  const transcript = renderTurns(args.segments);
  let agendaBlock = "";
  if (args.agenda) {
    const goal = args.agenda.goal.trim();
    const topicLines = args.agenda.topics.map((t) => `  - (id: ${t.id}) ${t.text}`).join("\n");
    const parts: string[] = ["PREP-UP AGENDA to judge against the transcript:"];
    if (goal) parts.push(`Goal: ${goal}`);
    if (topicLines) parts.push(`Must-discuss topics:\n${topicLines}`);
    parts.push(`Return "agenda" with goalAttained + note + the ids actually discussed in "covered".`);
    agendaBlock = `\n\n${parts.join("\n\n")}`;
  }
  return `${title}Transcript (diarized, one line per speaker turn):

${transcript}${agendaBlock}

Extract the decisions, owned actions, open items, and an effectiveness read${args.agenda ? ", plus the agenda judgment" : ""}. JSON only.`;
}
