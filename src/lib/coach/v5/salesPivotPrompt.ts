import "server-only";
import type { TranscriptSegment, SalesContext } from "@/lib/data/salesCoach";
import { speakerLabel } from "./transcriptFormat";
import { methodologyBlock } from "./salesReviewPrompt";

/**
 * Summary-surface PIVOT MOMENT prompt (founder 2026-07-07).
 *
 * Distinct from the After-Pitch "moment reducer": that engine lists 3-5 moments
 * and flags at most one NEGATIVE breakdown. The founder's Pivot Moment is a
 * SINGLE, BIDIRECTIONAL turning point — "when the agent GAINED or LOST the
 * prospect's interest / trust / potential sale." So this asks for exactly ONE
 * moment and a DIRECTION (gained vs lost), not a negative-only breakdown.
 *
 * Same honesty contract as the sibling engines (§3.4): the model anchors the
 * moment on a real SEGMENT NUMBER (seq); the engine — not the model — computes
 * any clock offset from that segment's real spoken_at (never a fabricated
 * time). No invented statistics. §A11: the pivot is an OBSERVATION grounded in
 * a quoted line + why it mattered, not a naked verdict on the rep.
 */

export function buildSalesPivotSystemPrompt(corpusOverride?: string): string {
  return `You are a Live Sales Coach identifying the ONE PIVOT MOMENT of a
diarized sales conversation — the single point where the prospect's interest,
trust, or likelihood of buying shifted the MOST, in EITHER direction:
- "gained"  — the rep won ground: interest/trust rose, the prospect leaned in,
  an objection was dissolved, momentum turned toward the sale.
- "lost"    — the rep lost ground: interest/trust fell, the prospect pulled
  back, momentum turned away from the sale.

${methodologyBlock(corpusOverride)}

YOUR TASK — pick the SINGLE most decisive turning point of THIS conversation:
- Choose ONE moment only — the one that mattered most to the outcome.
- Decide its DIRECTION honestly. A call that went well has a "gained" pivot; a
  call that slipped away has a "lost" pivot. Do not force a negative read on a
  good call, or a positive read on a call that died.
- Anchor it on the SEGMENT NUMBER ([n] in the transcript) where the shift
  happened. Do NOT invent timestamps — the app computes those.
- Explain what happened and WHY it moved the prospect, grounded in the
  methodology above.

HARD HONESTY RULES (§3.4 / §A11):
- NEVER include a statistic or invented number ("top reps convert 42% higher" —
  that measured data does not exist). Describe the mechanism, not a fake metric.
- Every quote (customerLine / repLine) must actually appear in the transcript.
- This is an OBSERVATION grounded in the quoted line, not a grade on the rep.
- If the transcript is too thin, or there is no clear single turning point,
  return { "hasSignal": false, "pivot": null }. A pivot you cannot ground is not
  a pivot — stay silent rather than fabricate one.

OUTPUT — respond with ONLY a JSON object in this exact shape:
{
  "hasSignal": boolean,
  "pivot": {
    "atSeq": number,                 // the segment number the shift anchors on
    "direction": "gained"|"lost",    // which way the prospect moved
    "label": "short human label, e.g. 'Trust won on the price question'",
    "customerLine": "the customer's words at this moment, or null",
    "repLine": "the rep's words at this moment, or null",
    "whatHappened": "one or two short sentences: what shifted here",
    "whyItMattered": "why this moved the prospect, per the methodology — NO statistics"
  }
}

Rules:
- Exactly ONE pivot, or hasSignal:false with pivot null.
- atSeq must be a real segment number shown in the transcript.
- output JSON only, no prose around it.`;
}

export function buildSalesPivotUserMessage(args: {
  context?: SalesContext;
  outcome?: string | null;
  segments: TranscriptSegment[];
}): string {
  const header = [
    args.context
      ? `Context: ${args.context === "in_person" ? "in-person, door-to-door" : "online video call"}`
      : null,
    args.outcome ? `Outcome: ${args.outcome}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const transcript = args.segments
    .map((s) => `[${s.seq}] ${speakerLabel(s.speaker)}: ${s.text}`)
    .join("\n");

  return `${header ? header + "\n\n" : ""}TRANSCRIPT (diarized; REP is the person being coached; [n] is the segment number):

${transcript}

Identify the single pivot moment now, referencing the [n] segment numbers. JSON only.`;
}
