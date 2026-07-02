import "server-only";
import type { TranscriptSegment, SalesContext } from "@/lib/data/salesCoach";
import { methodologyBlock } from "./salesReviewPrompt";

/**
 * After Pitch Summary — RUBRIC SCORER prompt (the private scoreboard).
 *
 * Founder decision 2026-07-02: real rubric scores graded against the corpus,
 * kept PRIVATE to the rep (self-assessment vs their own past), NOT a ranking
 * against other reps.
 *
 * A11-compliance (the System mirrors, it does not judge): a naked "Opener
 * 8/10" is a verdict. This prompt forbids naked numbers — every score MUST
 * carry a one-line rationale AND a specific transcript citation, so the number
 * is an evidenced observation the rep can inspect and contest, not an
 * authority's decree. The rep renders the final verdict on themselves.
 *
 * Talk ratio is NOT graded here — the engine computes it deterministically
 * from the transcript (hard data, no LLM guess). This prompt grades the four
 * qualitative categories only: opener, objection handling, tone, close.
 */

function speakerLabel(speaker: TranscriptSegment["speaker"]): string {
  if (speaker === "agent") return "REP";
  if (speaker === "customer") return "CUSTOMER";
  return "UNKNOWN";
}

export function buildSalesScoreSystemPrompt(corpusOverride?: string): string {
  return `You are a Live Sales Coach producing a PRIVATE self-assessment
scoreboard for one rep, on one conversation. Only the rep sees these scores —
they are a mirror of the rep's own performance against their growth, NEVER a
comparison to other people.

${methodologyBlock(corpusOverride)}

GRADE FOUR CATEGORIES, each 0-10, against the methodology above:
- opener       — how the rep opened and earned the first moments.
- objection    — how the rep handled objections / resistance.
- tone         — warmth, calm, matching the customer (read from word choice).
- close        — the close attempt (asking for the next step at the right time).

NON-NEGOTIABLE (A11 — the System mirrors, it does not judge):
- NEVER return a bare number. Every category MUST include:
    - rationale: one short line explaining the score against the methodology.
    - citation:  a specific moment from the transcript (a short quote) that the
                 score is grounded in.
- If a category genuinely did not occur (e.g. no close was attempted), score
  it honestly with a rationale that says so — do not invent a moment.
- Judge THIS conversation on its own terms; a quick check-in and a full pitch
  call for different things. Do not penalise the rep for not following a rigid
  script (§3.3 understanding gate).

HONESTY (§3.4): if the transcript is too thin to grade fairly, return
{ "hasSignal": false, "categories": [] }.

OUTPUT — respond with ONLY a JSON object in this exact shape:
{
  "hasSignal": boolean,
  "categories": [
    { "key": "opener",    "score": 0-10, "rationale": "one line", "citation": "transcript quote" },
    { "key": "objection", "score": 0-10, "rationale": "one line", "citation": "transcript quote" },
    { "key": "tone",      "score": 0-10, "rationale": "one line", "citation": "transcript quote" },
    { "key": "close",     "score": 0-10, "rationale": "one line", "citation": "transcript quote" }
  ]
}

Output JSON only, no prose around it.`;
}

export function buildSalesScoreUserMessage(args: {
  context?: SalesContext;
  segments: TranscriptSegment[];
}): string {
  const header = args.context
    ? `Context: ${args.context === "in_person" ? "in-person, door-to-door" : "online video call"}\n\n`
    : "";
  const transcript = args.segments
    .map((s) => `${speakerLabel(s.speaker)}: ${s.text}`)
    .join("\n");
  return `${header}TRANSCRIPT (diarized; REP is the person being scored):

${transcript}

Grade the four categories now, each with a rationale and a transcript
citation. JSON only.`;
}
