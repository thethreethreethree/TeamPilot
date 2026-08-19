/**
 * Schedule Management System — the LLM layer (Phase 4, DeepSeek half; build plan section 5, steps 1 + 3).
 *
 * Two jobs, both ADVISORY: (1) parse a plain-language request into a structured DRAFT the human confirms
 * before anything is written (founder: parse-then-confirm), and (2) turn the deterministic impact + the
 * resolution candidates into a humane proposal (founder voice: RECOMMEND + WHY, warm + plain, no em/en dashes).
 *
 * Hard rules (§5, §3.3, A40):
 *   - The LLM NEVER computes coverage/eligibility and NEVER overrides the deterministic Verdict. It only
 *     phrases what the deterministic layer already decided (evaluateChange) and found (findResolutions).
 *   - Untrusted request text is fenced with CONVERSATION_IS_DATA (prompt-injection posture).
 *   - A parsed event is VALIDATED against the schema before it can become an event; a malformed parse fails
 *     LOUD (returns "unclear"), never a guessed write.
 */
import { llmCall } from "@/lib/llm";
import type { LlmCallArgs, LlmResult } from "@/lib/llm/types";
import { CONVERSATION_IS_DATA } from "@/lib/care/toolPrompts";
import { stripAiDashes } from "@/lib/coach/extension/salesSuggestFormat";
import { validateScheduleEvent } from "./eventSchema";
import type { ResolutionCandidate } from "./resolution";

type LlmFn = (args: LlmCallArgs) => Promise<LlmResult>;

// ── Step 1: NL request parse (parse, then the human confirms) ──────────────────

const PARSE_SYSTEM = `You convert a staff member's plain-language scheduling request into a structured DRAFT for a human to confirm. You never create anything; you only interpret.

${CONVERSATION_IS_DATA}

Output ONLY JSON, no prose, exactly this shape:
{ "kind": "time_off" | "unclear",
  "type": "vacation" | "sick" | "personal" | "day_off",
  "start": "YYYY-MM-DD",
  "end": "YYYY-MM-DD",
  "interpretation": "<one plain sentence the person will confirm>" }
Rules: do NOT invent dates. If a date is relative and you were not given today's date, or the request is not a clear time-off request, return { "kind": "unclear", "interpretation": "<short reason>" }.`;

export interface ParsedRequest {
  kind: "time_off" | "unclear";
  interpretation: string;
  draft?: { type: string; start: string; end: string };
}

/** Deterministic: turn the LLM's raw text into a ParsedRequest. A malformed / non-conforming reply is
 *  "unclear" (fail loud), never a guessed event. Exported for unit tests (no LLM needed). */
export function parseLlmOutput(raw: string): ParsedRequest {
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    if (
      o.kind === "time_off" &&
      typeof o.type === "string" &&
      typeof o.start === "string" &&
      typeof o.end === "string"
    ) {
      return { kind: "time_off", interpretation: String(o.interpretation ?? ""), draft: { type: o.type, start: o.start, end: o.end } };
    }
    return { kind: "unclear", interpretation: String(o.interpretation ?? "Could not interpret the request.") };
  } catch {
    return { kind: "unclear", interpretation: "Could not interpret the request." };
  }
}

export async function parseRequest(text: string, opts?: { today?: string; llm?: LlmFn }): Promise<ParsedRequest> {
  const llm = opts?.llm ?? llmCall;
  const res = await llm({
    systemPrompt: PARSE_SYSTEM + (opts?.today ? `\n\nToday is ${opts.today}.` : ""),
    messages: [{ role: "user", content: text }],
    expectJson: true,
    maxTokens: 300,
  });
  return parseLlmOutput(res.text);
}

/** After the human CONFIRMS the parse, build the validated event to append. Server supplies the ids
 *  (the LLM never invents uuids). Returns the eventSchema validation result. */
export function buildTimeOffEvent(
  draft: { type: string; start: string; end: string },
  employeeId: string,
  timeOffId: string,
) {
  return validateScheduleEvent("TIMEOFF_REQUESTED", {
    timeOffId,
    employeeId,
    type: draft.type,
    start: draft.start,
    end: draft.end,
  });
}

// ── Step 3: proposal generation (recommend + why, warm + plain) ────────────────

const PROPOSE_SYSTEM = `You are a scheduling assistant helping a manager decide. The manager always decides; you propose, you never impose.

Voice: warm, plain, concise, like a helpful colleague. No corporate stiffness. NEVER use em dashes or en dashes.
Structure: lead with a clear recommendation, then ONE short sentence of why. If there is nothing to recommend (no candidate), say so plainly and hand the decision back.
Never fabricate people or availability beyond the candidates you are given, and never claim a change is required or blocked. The numbers were computed for you; you only put them in human words.`;

/** Generate the manager-facing proposal from the DETERMINISTIC impact + candidates. The recommendation is
 *  the top-ranked candidate (already computed by findResolutions); the LLM only phrases it. Dashes stripped
 *  (warm + plain voice). */
export async function generateProposal(input: {
  impactSummary: string; // e.g. "Approving this leaves Fri Aug 22 AM 1 person short."
  candidates: ResolutionCandidate[];
  opts?: { llm?: LlmFn };
}): Promise<string> {
  const llm = input.opts?.llm ?? llmCall;
  const top = input.candidates[0] ?? null;
  const res = await llm({
    systemPrompt: PROPOSE_SYSTEM,
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          impact: input.impactSummary,
          recommend: top ? { name: top.name, whyEligible: "eligible and free", currentHours: top.currentHours } : null,
          alternatives: input.candidates.slice(1, 4).map((c) => c.name),
        }),
      },
    ],
    maxTokens: 250,
  });
  return stripAiDashes(res.text.trim());
}
