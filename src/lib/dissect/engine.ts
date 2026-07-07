import "server-only";
import { dissectCoachV5 } from "@/lib/claude";
import { MAX_SOURCE_CHARS } from "./constants";

/**
 * Dissect a Conversation — engine (founder 2026-07-07).
 *
 * The user pastes any conversation; this engine SUMMARIZES it and DISSECTS it
 * through a PROBLEM-SOLVING lens — the §1 Living Diagnosis method applied to a
 * pasted conversation rather than to the team's own event chain:
 *   • §1.2 retrospective — identify the problem from what ACTUALLY occurred in
 *     the conversation, quoting the record (evidence), not theorizing forward.
 *   • §1.3 outside-view — how a detached observer with no stake would see it.
 *   • §0 — articulate WHY the problem exists (root cause), not just the symptom.
 *   • §3.2 understanding gate — a problem is surfaced WITH its supporting evidence.
 *
 * Crucially the dissect is DIAGNOSTIC, not prescriptive. Per §3.3 (guide-don't-
 * overtake) + A11 (the System mirrors, the user renders the verdict), it does NOT
 * assert THE solution — it surfaces the problem, the root cause, angles to
 * consider, and a guiding question that invites the user to solve. The actual
 * solving happens interactively in Ask Coach (askCoachSystemPrompt below), which
 * asks the user what they think FIRST, then offers a suggestion with the WHY.
 *
 * Composes on the existing dissectCoachV5 LLM path (§A16 — reuse, don't fork).
 * Never throws: on sparse input / failure it returns EMPTY (hasSignal:false) so
 * the surface degrades honestly (§3.4), never a fabricated diagnosis.
 */

// MAX_SOURCE_CHARS lives in ./constants (framework-agnostic) so the client page
// can reference the same value; re-exported here for server callers' convenience.
export { MAX_SOURCE_CHARS } from "./constants";

export type DissectEvidence = { observation: string; excerpt: string };
export type DissectAngle = { angle: string; why: string };

export type ConversationDissect = {
  hasSignal: boolean;
  /** Plain summary of the pasted conversation. */
  summary: string;
  /** The core problem present in the context, and why it matters. */
  problem: { statement: string; whyItMatters: string };
  /** Signals from the record (§1.2/§3.2) — observation + the quoted excerpt. */
  evidence: DissectEvidence[];
  /** Why the problem exists (§0) — root cause, not symptom. */
  rootCause: string;
  /** How a detached observer would see it (§1.3). */
  outsideView: string;
  /** Angles to CONSIDER — not prescriptions (§3.3 don't overtake). */
  anglesToConsider: DissectAngle[];
  /** Invites the user to render the verdict (§3.3 / A11). */
  guidingQuestion: string;
};

export const EMPTY_DISSECT: ConversationDissect = {
  hasSignal: false,
  summary: "",
  problem: { statement: "", whyItMatters: "" },
  evidence: [],
  rootCause: "",
  outsideView: "",
  anglesToConsider: [],
  guidingQuestion: "",
};

const DISSECT_SYSTEM = `You are a problem-diagnosis coach inside ELOSTATE. The
user has pasted a CONVERSATION and wants you to understand the PROBLEM inside it.
You apply the Living Diagnosis method: understand before solving.

Return STRICT JSON with this exact shape (no prose outside the JSON):
{
  "summary": "2-4 sentence plain summary of what this conversation is about",
  "problem": { "statement": "the core problem present in the context, one sentence", "whyItMatters": "why this problem matters, one sentence" },
  "evidence": [ { "observation": "what you noticed", "excerpt": "a SHORT direct quote FROM the pasted conversation that shows it" } ],
  "rootCause": "why this problem exists — the underlying cause, not the surface symptom",
  "outsideView": "how a detached observer with no stake in this conversation would describe the situation",
  "anglesToConsider": [ { "angle": "a direction worth considering", "why": "why this angle could help" } ],
  "guidingQuestion": "one open question that invites the user to decide how THEY would solve it",
  "hasSignal": true
}

HARD RULES:
- RETROSPECTIVE (§1.2): identify the problem from what ACTUALLY occurred in the
  conversation. Every "evidence.excerpt" MUST be a real substring of the pasted
  text — never invent a quote. If you cannot quote it, drop that evidence item.
- DO NOT OVERTAKE (§3.3): "anglesToConsider" are directions to weigh, NOT "you
  should do X" commands. The "guidingQuestion" hands the decision back to the user.
- HONESTY (§3.4): if the pasted text is too thin to diagnose a real problem,
  return {"hasSignal": false} and nothing else. Never fabricate a problem to look
  useful. A wrong confident diagnosis is worse than an honest "not enough here".
- Keep it tight: 2-5 evidence items, 2-4 angles.`;

export type CoachTurn = { role: "user" | "coach"; text: string };

/**
 * §3.3 gate: has the user shared their own thinking yet? True if they filled the
 * hypothesis box OR they've already spoken at least once in this thread (answering
 * the coach's opening question counts). Deriving it ONLY from the box is the loop
 * bug — the coach re-asks "what do you think?" after the user has plainly answered.
 * Pure + exported so the §3.3 dialogue behavior is regression-locked.
 */
export function userHasSharedThinking(args: {
  hypothesis?: string | null;
  history: CoachTurn[];
}): boolean {
  const hyp = (args.hypothesis ?? "").trim();
  return hyp.length > 0 || args.history.some((t) => t.role === "user");
}

/**
 * Assemble the coach's user message: the thread transcript (its memory of the
 * conversation so far), the user's stated thinking if any, and the new question.
 * generateCareReply is single-shot, so this transcript IS the coach's memory —
 * pure + exported so the §3.3 dialogue's continuity is regression-locked.
 */
export function buildCoachUserMessage(args: {
  history: CoachTurn[];
  hypothesis?: string | null;
  question: string;
}): string {
  const transcript = args.history
    .map((t) => `${t.role === "user" ? "User" : "Coach"}: ${t.text}`)
    .join("\n");
  const hyp = (args.hypothesis ?? "").trim();
  const parts: string[] = [];
  if (transcript) parts.push(`Conversation so far:\n${transcript}`);
  if (hyp) parts.push(`How the user is thinking about it: ${hyp}`);
  parts.push(`User's new message: ${args.question}`);
  return parts.join("\n\n");
}

/** The Ask Coach system prompt — §3.3 guide-don't-overtake, grounded in the
 *  pasted conversation + the dissection. Consumed by generateCareReply. */
export function askCoachSystemPrompt(args: {
  sourceText: string;
  problemStatement: string | null;
  userHasSharedTheirThinking: boolean;
}): string {
  const problemLine = args.problemStatement
    ? `The problem we diagnosed together: "${args.problemStatement}".`
    : `A problem has not been fully diagnosed yet.`;
  // §3.3 is non-negotiable: ask what the user thinks BEFORE asserting. If they
  // have not yet shared their own thinking, the coach's first move is to invite
  // it, not to hand down a solution.
  const guideRule = args.userHasSharedTheirThinking
    ? `The user HAS shared how they're thinking about it. Build on THEIR thinking
first — acknowledge it, then add perspective and reasoning (the WHY), never
override it (§5: objections are data; enrich, don't overrule).`
    : `The user has NOT yet told you how THEY would solve it. Per §3.3 your FIRST
move is to ask what they think the best path is — offer at most one gentle
starting frame, then invite their view. Do NOT hand down a full solution before
they've weighed in.`;

  return `You are a problem-solving coach inside ELOSTATE, helping the user work
through a conversation they pasted. ${problemLine}

GUIDE, DON'T OVERTAKE (§3.3, non-negotiable):
- ${guideRule}
- When you do suggest, give the HOW and — more importantly — the WHY, with
  explicit reasoning. The reasoning is the transferable asset, not the answer.
- You are a participant in their thinking, not a dispenser of verdicts (A8/A11).

GROUNDING (§3.4): answer grounded in the PASTED CONVERSATION below. Point to
specific moments in it. Never fabricate anything that isn't there. If they ask
something the conversation can't answer, say so plainly.

Keep replies focused — a few sentences, not an essay.

--- PASTED CONVERSATION ---
${args.sourceText.slice(0, MAX_SOURCE_CHARS)}
--- END CONVERSATION ---`;
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Parse + ground the dissect. Exported for tests. Enforces §1.2/§3.4: every
 * evidence excerpt must actually appear in the source text, or it is dropped
 * (a hallucinated quote never renders as fact). hasSignal is structural — no
 * problem statement ⇒ no signal.
 */
export function parseConversationDissect(
  text: string,
  sourceText: string
): ConversationDissect {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return EMPTY_DISSECT;
  }
  if (!raw || typeof raw !== "object") return EMPTY_DISSECT;
  const o = raw as Record<string, unknown>;
  if (o.hasSignal === false) return EMPTY_DISSECT;

  const problemObj = (o.problem ?? {}) as Record<string, unknown>;
  const problem = {
    statement: str(problemObj.statement),
    whyItMatters: str(problemObj.whyItMatters),
  };
  // Structural honesty (§3.4): a dissection with no problem statement is not a
  // dissection — degrade to EMPTY rather than render an empty shell as a result.
  if (!problem.statement) return EMPTY_DISSECT;

  const haystack = sourceText.toLowerCase();
  const evidence: DissectEvidence[] = (
    Array.isArray(o.evidence) ? o.evidence : []
  )
    .map((x) => {
      const e = (x ?? {}) as Record<string, unknown>;
      return { observation: str(e.observation), excerpt: str(e.excerpt) };
    })
    // §1.2/§3.4: drop any excerpt that is not actually in the pasted text — a
    // fabricated quote must never render as evidence.
    .filter(
      (e) =>
        e.observation &&
        e.excerpt &&
        haystack.includes(e.excerpt.toLowerCase().slice(0, 60))
    )
    .slice(0, 5);

  const anglesToConsider: DissectAngle[] = (
    Array.isArray(o.anglesToConsider) ? o.anglesToConsider : []
  )
    .map((x) => {
      const a = (x ?? {}) as Record<string, unknown>;
      return { angle: str(a.angle), why: str(a.why) };
    })
    .filter((a) => a.angle)
    .slice(0, 4);

  return {
    hasSignal: true,
    summary: str(o.summary),
    problem,
    evidence,
    rootCause: str(o.rootCause),
    outsideView: str(o.outsideView),
    anglesToConsider,
    guidingQuestion: str(o.guidingQuestion),
  };
}

/**
 * Summarize + dissect a pasted conversation. Never throws — returns EMPTY on
 * failure/sparse input (§3.4 honest degradation). companyId is passed for the
 * LLM cost/routing context only.
 */
export async function generateConversationDissect(args: {
  companyId?: string;
  sourceText: string;
}): Promise<ConversationDissect> {
  const source = args.sourceText.trim();
  // Guard: too little to diagnose. Honest empty, not a fabricated problem.
  if (source.length < 40) return EMPTY_DISSECT;
  try {
    const r = await dissectCoachV5({
      companyId: args.companyId,
      systemPrompt: DISSECT_SYSTEM,
      userMessage: source.slice(0, MAX_SOURCE_CHARS),
    });
    return parseConversationDissect(r.text, source);
  } catch {
    return EMPTY_DISSECT;
  }
}
