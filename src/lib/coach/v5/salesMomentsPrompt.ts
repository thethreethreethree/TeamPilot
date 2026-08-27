import "server-only";
import type { TranscriptSegment, SalesContext } from "@/lib/data/salesCoach";
import { methodologyBlock } from "./salesReviewPrompt";
import { reviewProductBlock } from "./prepShared";

/**
 * After Pitch Summary — the MOMENT REDUCER prompt.
 *
 * Collapses a diarized transcript into the PDF's timeline hero: 3-5 KEY
 * moments (opener → objection → the pivotal breakdown, if any → close). The
 * model references each moment by the SEGMENT NUMBER (seq) it anchors on; the
 * engine maps that back to a real clock offset from the segment's spoken_at
 * (§3.4 — the model never invents a timestamp; if we don't have spoken_at we
 * show no clock time rather than a fabricated one).
 *
 * The breakdown moment ALSO carries the correction (the "what you should have
 * said" box): the exact better line + why it works, grounded in the
 * methodology corpus. Hard honesty rule (§3.4, matching the founder's
 * "cut the fabricated stat" decision 2026-07-02): NO statistics, NO
 * "top reps convert X% higher" — that measured data does not exist.
 */

function speakerLabel(speaker: TranscriptSegment["speaker"]): string {
  if (speaker === "agent") return "REP";
  if (speaker === "customer") return "CUSTOMER";
  return "UNKNOWN";
}

export function buildSalesMomentsSystemPrompt(
  corpusOverride?: string,
  product?: string | null
): string {
  return `You are a Live Sales Coach reducing a diarized sales conversation to
its KEY MOMENTS for a post-call timeline the rep sees before their next door.

${methodologyBlock(corpusOverride)}${reviewProductBlock(product)}

YOUR TASK — pick the 3-5 moments that define this conversation, in order:
- The OPENER (how the rep started).
- A first OBJECTION or turning point (if one occurred).
- The BREAKDOWN — the single pivotal moment the conversation turned against
  the rep, IF one exists. Not every call has one; a call that went well has
  NO breakdown. Flag AT MOST ONE.
- The CLOSE (the rep's close attempt / how it ended).

Reference each moment by the SEGMENT NUMBER it anchors on (the [n] in the
transcript). Do NOT invent timestamps — the app computes those.

For EACH moment, also read the CUSTOMER's sentiment direction AT that moment —
"warming" (interest/trust rising, leaning in), "cooling" (pulling back, guard
up), or "neutral" (no clear shift). This is the continuous emotional arc across
the call, read honestly from what the customer actually said.

For the BREAKDOWN moment ONLY, also produce the CORRECTION: the exact better
line the rep should have used, and why it works — grounded in the methodology
above.

ALSO — separately from the 3-5 moments — TALLY the objections across the WHOLE
call (this is a COUNT, not the hero moments):
- "raised" = the number of DISTINCT objections or real pushbacks the CUSTOMER
  voiced (e.g. price, timing, "not interested", "I need to think", trust, "I
  already have someone"). Count each distinct concern once; do NOT count simple
  questions or neutral clarifications. A call with no pushback is 0.
- "resolved" = how many of those the rep ADDRESSED well enough that the customer
  moved PAST it (dropped it, warmed, or advanced) — NOT the ones left hanging or
  that ended the call. resolved can never exceed raised. Count honestly from the
  transcript; if unsure whether one was resolved, do not count it as resolved.

HARD HONESTY RULES (§3.4):
- NEVER include a statistic or number like "top reps convert 42% higher" —
  that measured data does not exist. State what the methodology prescribes,
  with no fabricated numbers.
- Every quote (customerLine/repLine) must be actually in the transcript.
- ALWAYS identify moments for EVERY session regardless of length — at least 1, up to 3-5. A short call still
  has real moments (the opener, a question, the customer's reaction). Ground each in the transcript; never
  fabricate a quote, and never refuse.

OUTPUT — respond with ONLY a JSON object in this exact shape:
{
  "hasSignal": true,
  "objections": { "raised": number, "resolved": number },  // whole-call tally; resolved <= raised; 0 if none
  "moments": [
    {
      "atSeq": number,                         // the segment number this moment anchors on
      "kind": "opener"|"discovery"|"objection"|"breakdown"|"close"|"other",
      "label": "short human label, e.g. 'First objection'",
      "customerLine": "the customer's words at this moment, or null",
      "repLine": "the rep's words at this moment, or null",
      "note": "one short line: what happened here",
      "sentiment": "warming"|"cooling"|"neutral",  // the customer's direction here
      "isBreakdown": boolean,                  // true for AT MOST ONE moment
      "correction": {                          // ONLY on the breakdown moment; null otherwise
        "correctLine": "the exact better line the rep should have used",
        "whyItWorks": "why it works, per the methodology — NO statistics"
      }
    }
  ]
}

Rules:
- 3-5 moments, ordered by atSeq ascending.
- atSeq must be a real segment number shown in the transcript.
- at most one moment has isBreakdown:true; correction is non-null ONLY there.
- objections is a whole-call COUNT (raised/resolved), independent of the 3-5 moments; resolved never exceeds raised.
- output JSON only, no prose around it.`;
}

export function buildSalesMomentsUserMessage(args: {
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

  // Number each segment by its seq so the model can reference moments by [n].
  const transcript = args.segments
    .map((s) => `[${s.seq}] ${speakerLabel(s.speaker)}: ${s.text}`)
    .join("\n");

  return `${header ? header + "\n\n" : ""}TRANSCRIPT (diarized; REP is the person being coached; [n] is the segment number):

${transcript}

Identify the key moments now, referencing the [n] segment numbers. JSON only.`;
}
