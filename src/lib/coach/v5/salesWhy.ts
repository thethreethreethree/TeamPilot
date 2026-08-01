import "server-only";
// Prompt-injection fence — the transcript carries untrusted CUSTOMER speech.
import { CONVERSATION_IS_DATA } from "@/lib/care/toolPrompts";
import { dissectCoachV5 } from "@/lib/claude";
import type { TranscriptSegment, SalesContext } from "@/lib/data/salesCoach";
import { outcomeLabel } from "@/lib/coach/v5/outcomeLabels";

/**
 * Live Sales Coach — the WHY engine (Sessions Phase 3). Retrospective
 * root-cause (§1.2): for a FINISHED session with a recorded OUTCOME, read
 * WHY it went that way.
 *
 * Constitutional shape:
 *   - §3.3 guide-don't-overtake: the REP speaks first. This engine is only
 *     ever called AFTER the rep submits their own hypothesis, which is fed
 *     in here — the System builds on it, never overrides it.
 *   - §4 / §3.5: the result is a HYPOTHESIS tied to THIS session's evidence
 *     and its recorded outcome (the consequence) — never a proven cause.
 *     It holds an alternative read loosely.
 *   - §3.2: needs a real transcript to read a cause; thin -> honest empty
 *     (hasSignal false), never fabricated (§3.4).
 *   - §A21: reuses the control-exempt Sales-Coach LLM path (dissectCoachV5).
 *
 * Never throws — a failure returns the honest empty state.
 */

export type SessionWhy = {
  hasSignal: boolean;
  primaryDriver: string; // the single most likely driver of this outcome
  evidence: string[]; // transcript-grounded moments supporting it
  repInputReflection: string; // §3.3 — how this read relates to the rep's
  alternativeRead: string | null; // §4 — another plausible driver, held loosely
  // F3 (§3.4) — true when generation actually FAILED (LLM/parse error), so the
  // UI can say "couldn't generate, try again" instead of "not enough signal".
  failed: boolean;
};

const EMPTY_WHY: SessionWhy = {
  hasSignal: false,
  primaryDriver: "",
  evidence: [],
  repInputReflection: "",
  alternativeRead: null,
  failed: false,
};

// F6 (§3.2) — gate on AGENT turns, matching the dissect (MIN_AGENT_SEGMENTS),
// so a thin or one-sided transcript can't pass a raw total-segment count.
const MIN_AGENT_SEGMENTS = 3;

function buildWhySystemPrompt(): string {
  return `You are a sales coach doing a retrospective root-cause read of ONE
finished call. You are given the OUTCOME, the transcript, and — crucially —
the REP'S OWN hypothesis for why it went that way.

§3.3 — THE REP SPOKE FIRST. Do NOT override them. Take their read seriously:
where they are right, build on it; where the transcript suggests something
they missed, ADD it as a perspective — never dismiss theirs.

§4 — this is a HYPOTHESIS, not a proven cause. You cannot know the true cause
from one transcript. Give your best read, grounded in SPECIFIC transcript
evidence, and hold it loosely — name an alternative if one is plausible.

§3.4 — never fabricate. If the transcript is too thin to read a cause
honestly, say so (hasSignal false) rather than invent one.

Identify:
- primaryDriver: the single most likely driver of THIS outcome, one line.
- evidence: 2-3 specific moments from the transcript that support it
  (short quote or close paraphrase).
- repInputReflection: ONE line on how your read relates to the rep's —
  agree / build on / gently add. Address the rep as "you".
- alternativeRead: another plausible driver if one exists, else null.

OUTPUT — respond with ONLY this JSON:
{
  "hasSignal": boolean,
  "primaryDriver": "one line",
  "evidence": ["…", "…"],
  "repInputReflection": "one line addressing the rep",
  "alternativeRead": "one line, or null"
}`;
}

function speakerLabel(s: TranscriptSegment["speaker"]): string {
  if (s === "agent") return "REP";
  if (s === "customer") return "CUSTOMER";
  return "UNKNOWN";
}

function buildWhyUserMessage(args: {
  outcome: string;
  repHypothesis: string;
  sessionTitle?: string;
  context?: SalesContext;
  segments: TranscriptSegment[];
}): string {
  const ctx = args.context
    ? `Context: ${args.context === "in_person" ? "in-person, door-to-door" : "online video call"}\n`
    : "";
  const title = args.sessionTitle ? `Session: ${args.sessionTitle}\n` : "";
  const outcomeText = outcomeLabel(args.outcome);
  const transcript = args.segments
    .map((s) => `${speakerLabel(s.speaker)}: ${s.text}`)
    .join("\n");
  return `${title}${ctx}OUTCOME: ${outcomeText}

THE REP'S OWN HYPOTHESIS (they spoke first — build on this):
"${args.repHypothesis}"

TRANSCRIPT:
${transcript}

Give your retrospective why-hypothesis. JSON only.`;
}

function parseWhy(text: string): SessionWhy | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const primaryDriver =
    typeof o.primaryDriver === "string" ? o.primaryDriver.trim() : "";
  const repInputReflection =
    typeof o.repInputReflection === "string" ? o.repInputReflection.trim() : "";
  const evidence = Array.isArray(o.evidence)
    ? o.evidence
        .filter((x): x is string => typeof x === "string")
        .map((x) => x.trim())
        .filter(Boolean)
    : [];
  const alt =
    typeof o.alternativeRead === "string" && o.alternativeRead.trim()
      ? o.alternativeRead.trim()
      : null;
  // Honour the §3.2 gate: an honest read has an actual driver + evidence.
  const hasSignal = o.hasSignal === true && Boolean(primaryDriver) && evidence.length > 0;
  return {
    hasSignal,
    primaryDriver: hasSignal ? primaryDriver : "",
    evidence: hasSignal ? evidence : [],
    repInputReflection: hasSignal ? repInputReflection : "",
    alternativeRead: hasSignal ? alt : null,
    failed: false,
  };
}

export async function generateSessionWhy(args: {
  companyId: string;
  outcome: string;
  repHypothesis: string;
  sessionTitle?: string;
  context?: SalesContext;
  segments: TranscriptSegment[];
}): Promise<SessionWhy> {
  try {
    // §3.2 gate (F6) — need enough of the REP's own turns to read a cause.
    const agentSegments = args.segments.filter(
      (s) => s.speaker === "agent"
    ).length;
    if (agentSegments < MIN_AGENT_SEGMENTS) return EMPTY_WHY;
    const systemPrompt = buildWhySystemPrompt() + CONVERSATION_IS_DATA;
    const userMessage = buildWhyUserMessage(args);
    const r = await dissectCoachV5({
      companyId: args.companyId,
      systemPrompt,
      userMessage,
    });
    if (r.suppressed) return EMPTY_WHY;
    // F3 (§3.4) — an unparseable response is a FAILURE, not "no signal".
    return parseWhy(r.text) ?? { ...EMPTY_WHY, failed: true };
  } catch {
    // F3 (§3.4) — a real error, distinct from the honest empty state.
    return { ...EMPTY_WHY, failed: true };
  }
}
