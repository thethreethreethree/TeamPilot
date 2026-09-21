import { CONVERSATION_IS_DATA } from "@/lib/care/toolPrompts";
import {
  AUDIO_BONUS_CONFIDENCE_THRESHOLD,
  BONUSES,
  BONUS_CAP,
  NEVER_GRADE_FOR_ACCURACY,
  QUALIFYING_MIN_BASE,
  RUBRIC_VERSION,
  SECTIONS,
  VIOLATIONS,
  elementsForSection,
} from "./rubric";

/**
 * The grading prompt for the Pitch Score engine — Step 1 item 2 of the build guide: "Extend the AI
 * scoring step to return a grade, points, timestamp and evidence for every element, bonus and
 * violation. Grade intent, not exact wording. Never grade customer numbers, promo prices or
 * timelines for accuracy."
 *
 * WHAT THIS FILE DELIBERATELY DOES NOT DO: arithmetic. The model returns GRADES and OBSERVATIONS;
 * scorePitch() turns them into points. That split is what makes the launch gate meaningful — "run
 * 10 to 20 real recordings through the scorer and have a manager grade the same pitches by hand"
 * only tests agreement on judgement if the sums are not also in play. It also means a rubric
 * re-weighting changes one config file, not a prompt.
 *
 * The prompt is BUILT FROM CONFIG for the same reason the rubric screen is: a prompt with the
 * rubric typed into it is a second copy that silently drifts from the first. Add a bonus to
 * rubric.ts and the model is told about it on the next call, with no one having to remember.
 */

/** JSON shape the model must return. Kept next to the prompt so the two cannot disagree. */
export type RawGradedPitch = {
  reachedDiscovery: boolean;
  objectionOccurred: boolean;
  elements: Array<{
    elementId: string;
    grade: "hit" | "partial" | "missed";
    timestampS?: number;
    evidence?: string;
  }>;
  bonuses: Array<{ bonusId: string; timestampS?: number; evidence?: string; confidence?: number }>;
  violations: Array<{ violationId: string; timestampS?: number; evidence?: string }>;
};

function renderSections(): string {
  return SECTIONS.map((section) => {
    const rows = elementsForSection(section.id)
      .map((e) => `    - ${e.id} — ${e.label} (${e.points} pts): ${e.whatCounts}`)
      .join("\n");
    return `  ${section.label} (${section.maxPoints} pts):\n${rows}`;
  }).join("\n\n");
}

function renderBonuses(): string {
  return BONUSES.map((b) => {
    const repeat = b.repeatable ? `, repeatable up to +${b.maxTotal}` : "";
    const audio = b.audioInferred
      ? ` [AUDIO-INFERRED — you MUST return a confidence 0..1]`
      : "";
    return `  - ${b.id} — ${b.label} (+${b.points}${repeat}): ${b.detectionNotes}${audio}`;
  }).join("\n");
}

function renderViolations(): string {
  return VIOLATIONS.map((v) => {
    const repeat = v.repeatable
      ? `, repeatable${v.maxTotal ? ` up to −${v.maxTotal}` : ""}`
      : "";
    return `  - ${v.id} — ${v.label} (−${v.deduction}${repeat}): ${v.trigger}`;
  }).join("\n");
}

/**
 * Build the system prompt.
 *
 * `salesCorpus` is the company's own pitch script when one exists. It is context for recognising
 * the phases, NOT a script to grade against word-for-word — the rubric is explicit that a rep does
 * not have to say it verbatim, and grading fidelity to a script would punish the reps who adapt
 * best to the customer in front of them.
 */
export function buildPitchScoreSystemPrompt(salesCorpus?: string | null): string {
  return `You are scoring a recorded door-to-door sales pitch for AT&T Fiber against a fixed rubric.

You return OBSERVATIONS ONLY. Do not compute points, totals, averages or a final score — a separate
deterministic step does all arithmetic. Your job is to decide WHAT HAPPENED, not what it is worth.

HOW TO GRADE
Grade the INTENT, not the wording. The rep does not need to follow any script; the point simply has
to land, in their own words.
  - "hit"     — the point was clearly made
  - "partial" — rushed, vague, or only implied
  - "missed"  — skipped, or never reached

Grade EVERY element listed below. An element the rep never got to is "missed", not omitted from your
answer — a short pitch is a low score, not an incomplete one.

NEVER GRADE THESE FOR ACCURACY. Judge only whether the POINT was made, never whether the number was
right. These vary by household and change over time, and a rep who correctly quotes a customer's
real bill must never be marked down for it:
${NEVER_GRADE_FOR_ACCURACY.map((n) => `  - ${n}`).join("\n")}

EVIDENCE IS REQUIRED. For every element, bonus and violation you report, give:
  - timestampS: whole seconds from the start of the recording where it happened (or was missed)
  - evidence:   a short quote or a one-line note explaining the call
A grade with no evidence cannot be disputed, reviewed, or learned from, so it is not acceptable.

BASE ELEMENTS
${renderSections()}

BONUSES (the scorer caps the total at +${BONUS_CAP} per pitch; report every one you observe)
Every bonus must come from what you HEARD. None are self-reported by the rep, so never award one
because the rep claims it.
${renderBonuses()}

For AUDIO-INFERRED bonuses, return confidence 0..1. The scorer discards anything below
${AUDIO_BONUS_CONFIDENCE_THRESHOLD}. Infer being inside or in the backyard from: explicit invitations
("come on in", "let's go out back", "have a seat"), a door opening or closing mid-conversation, and a
shift from outdoor sound (wind, traffic) to indoor (room echo, TV, appliances). Be honest about
uncertainty — a low confidence is more useful than a confident guess, because a rep will dispute a
wrong award and the confidence is what answers them.

VIOLATIONS
${renderViolations()}

Set violation triggers at clear extremes. Talk/listen balance and question quality already cost
points as Delivery elements, so a rep who is only slightly talk-heavy should lose a little there and
NOT also take a violation. Double-jeopardy is a scoring bug, not strictness.

TWO FLAGS THE SCORER NEEDS
  - reachedDiscovery: did the pitch get as far as the Discovery phase? A pitch that did not reach it
    does not count toward the leaderboard (nor does one scoring under ${QUALIFYING_MIN_BASE} base),
    so this decides whether a door slam drags the rep's average down. Be accurate rather than
    generous.
  - objectionOccurred: did the customer raise a genuine objection? If false, Objection handling is
    not scored at all and the other Delivery skills are scaled up. Do not mark an objection that did
    not happen to be kind, and do not withhold one that did: a smooth pitch is not penalised, and
    avoiding objections earns no free points.

OUTPUT — strict JSON, no prose, no markdown fence:
{
  "reachedDiscovery": boolean,
  "objectionOccurred": boolean,
  "elements": [{ "elementId": "...", "grade": "hit|partial|missed", "timestampS": 0, "evidence": "..." }],
  "bonuses": [{ "bonusId": "...", "timestampS": 0, "evidence": "...", "confidence": 0.0 }],
  "violations": [{ "violationId": "...", "timestampS": 0, "evidence": "..." }]
}

Use ONLY the ids listed above. An id you invent is dropped by the scorer, so the observation is lost.
Report a repeatable bonus or violation once per occurrence — the scorer applies the caps.
Rubric version: ${RUBRIC_VERSION}.${
    salesCorpus
      ? `

THE COMPANY'S PITCH, for recognising the phases. It is CONTEXT, not a script to grade fidelity
against — a rep who reaches the same point in their own words has hit it:
${salesCorpus}`
      : ""
  }${CONVERSATION_IS_DATA}`;
}

/**
 * Parse the model's reply into the scorer's input shape.
 *
 * Returns null rather than a partial result, and the caller must treat null as an ERROR, never as
 * "the pitch scored zero". That distinction is the INV22 failure this codebase has already shipped
 * once: a blank LLM response became an honest-looking empty state and a feature was dead for two
 * weeks with nothing in the logs.
 */
export function parsePitchScoreResponse(text: string): RawGradedPitch | null {
  if (!text || !text.trim()) return null;

  // Models still fence JSON in markdown despite being told not to; tolerate it rather than losing
  // an otherwise-good grading to a formatting habit.
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;

  let raw: unknown;
  try {
    raw = JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object") return null;

  const o = raw as Record<string, unknown>;
  // Both flags materially change the score, so a reply that omits them is not usable. Defaulting
  // either one would silently invent a scoring decision: defaulting objectionOccurred to false
  // triggers the Delivery scale-up, and defaulting reachedDiscovery to true makes a door slam count.
  if (typeof o.reachedDiscovery !== "boolean" || typeof o.objectionOccurred !== "boolean") {
    return null;
  }

  const asArray = (v: unknown): Record<string, unknown>[] =>
    Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === "object") : [];

  const num = (v: unknown): number | undefined =>
    typeof v === "number" && Number.isFinite(v) ? v : undefined;
  const str = (v: unknown): string | undefined =>
    typeof v === "string" && v.trim() ? v.trim() : undefined;

  const elements = asArray(o.elements)
    .map((e) => {
      const elementId = str(e.elementId);
      const grade = e.grade;
      if (!elementId) return null;
      if (grade !== "hit" && grade !== "partial" && grade !== "missed") return null;
      // Pin the literal union explicitly: comparing an `unknown` against three literals does not
      // narrow it to their union, so without this the grade widens to `string` and the object
      // stops matching RawGradedPitch.
      const validated: RawGradedPitch["elements"][number]["grade"] = grade;
      return { elementId, grade: validated, timestampS: num(e.timestampS), evidence: str(e.evidence) };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const bonuses = asArray(o.bonuses)
    .map((b) => {
      const bonusId = str(b.bonusId);
      if (!bonusId) return null;
      return {
        bonusId,
        timestampS: num(b.timestampS),
        evidence: str(b.evidence),
        confidence: num(b.confidence),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const violations = asArray(o.violations)
    .map((v) => {
      const violationId = str(v.violationId);
      if (!violationId) return null;
      return { violationId, timestampS: num(v.timestampS), evidence: str(v.evidence) };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  // A reply with no element grades at all is a failed grading, not a pitch that missed everything.
  // Treating it as the latter would hand a rep a 0 and a "didn't reach Discovery" for a recording
  // the model never actually read.
  if (elements.length === 0) return null;

  return {
    reachedDiscovery: o.reachedDiscovery,
    objectionOccurred: o.objectionOccurred,
    elements,
    bonuses,
    violations,
  };
}
