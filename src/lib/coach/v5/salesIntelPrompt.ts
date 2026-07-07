import "server-only";
import type { TranscriptSegment, SalesContext } from "@/lib/data/salesCoach";

/**
 * Conversation-intelligence prompt (founder 2026-07-07): extract the COMPETITORS
 * named in the call and the TOPICS discussed — one pass, one LLM call.
 *
 * Competitor detection is LLM-generic (founder's choice): identify any rival /
 * alternative provider actually NAMED in the transcript (e.g. "Verizon", "AT&T",
 * "my current provider"), not from a configured list. §3.4 honesty: only what
 * was actually said — an empty list is the right answer when no competitor came
 * up. §A11: this is an extraction (what was named / discussed), not a verdict.
 */

function speakerLabel(speaker: TranscriptSegment["speaker"]): string {
  if (speaker === "agent") return "REP";
  if (speaker === "customer") return "CUSTOMER";
  return "UNKNOWN";
}

export function buildSalesIntelSystemPrompt(): string {
  return `You extract two things from a sales conversation transcript, for a
post-call intelligence panel. You do NOT grade the rep — you report facts.

1. COMPETITORS — the names of any competing or alternative providers/products
   the customer or rep actually MENTIONED (e.g. a current provider they'd switch
   from, a rival brand, "the other company"). Use the real name when one was
   said. Do NOT infer competitors that were never named. If none were mentioned,
   return an empty list — that is the correct, honest answer.

2. TOPICS — 3 to 5 concrete subjects the conversation actually covered (e.g.
   "pricing", "internet speed", "contract length", "installation", "outages").
   Short noun phrases, drawn from what was discussed — not the sales phases.

HONESTY (§3.4): report only what is really in the transcript. No invented
competitors, no topics that weren't discussed. Thin transcript → empty lists.

OUTPUT — respond with ONLY this JSON object:
{
  "competitors": ["name", ...],   // [] if none were named
  "topics": ["short topic", ...]  // 3-5, or fewer if the call was short
}

JSON only, no prose around it.`;
}

export function buildSalesIntelUserMessage(args: {
  context?: SalesContext;
  segments: TranscriptSegment[];
}): string {
  const header = args.context
    ? `Context: ${args.context === "in_person" ? "in-person, door-to-door" : "online video call"}\n\n`
    : "";
  const transcript = args.segments
    .map((s) => `${speakerLabel(s.speaker)}: ${s.text}`)
    .join("\n");
  return `${header}TRANSCRIPT (diarized):

${transcript}

Extract the competitors mentioned and the topics discussed. JSON only.`;
}
