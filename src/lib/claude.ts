import "server-only";

import { llmCall } from "@/lib/llm";
import { runBrainCall } from "@/lib/brain";

/**
 * All AI functions in this file are server-only entry points used by /api/ai/*
 * routes. They route through the brain (per-company composer + §3.4 control gate)
 * when a companyId is provided; otherwise they call the configured provider
 * directly with the base prompt (used in demo mode and for system-level calls).
 *
 * The file is named claude.ts for historical reasons; the active provider is
 * selected by env config (DeepSeek primary per AMD-003).
 */

type CallArgs = {
  companyId?: string;
  systemPrompt: string;
  userContent: string;
  maxTokens?: number;
  expectJson?: boolean;
};

type CallResult = {
  text: string;
  suppressed: boolean;
  reason?: string;
  provider: string;
  model: string;
};

async function call(args: CallArgs): Promise<CallResult> {
  if (args.companyId) {
    const r = await runBrainCall({
      companyId: args.companyId,
      basePrompt: args.systemPrompt,
      messages: [{ role: "user", content: args.userContent }],
      maxTokens: args.maxTokens,
      expectJson: args.expectJson,
    });
    if (!r.gate.guidanceEnabled) {
      return {
        text: "",
        suppressed: true,
        reason: r.gate.reason,
        provider: r.provider,
        model: r.model,
      };
    }
    return {
      text: r.text,
      suppressed: false,
      provider: r.provider,
      model: r.model,
    };
  }
  const r = await llmCall({
    systemPrompt: args.systemPrompt,
    messages: [{ role: "user", content: args.userContent }],
    maxTokens: args.maxTokens,
    expectJson: args.expectJson,
  });
  return {
    text: r.text,
    suppressed: false,
    provider: r.provider,
    model: r.model,
  };
}

// ─────────────────────────────────────────────────────────────
// Today's Open Questions (§3.3 — surface, don't direct)
// ─────────────────────────────────────────────────────────────

export async function generateDailyQuestions(
  companyContext: string,
  opts?: { companyId?: string }
): Promise<CallResult> {
  return call({
    companyId: opts?.companyId,
    expectJson: true,
    maxTokens: 700,
    systemPrompt: `You are ExecOS, surfacing today's open questions for an executive.

You do NOT recommend actions. You do NOT diagnose problems on day one. You surface what
the data is asking — the questions the executive should be holding open today and the
uncertainties that deserve their attention. The executive decides what to do; your role
is to ensure they are looking at the right things.

Return strict JSON:
{
  "todaysQuestions": ["What's the underlying reason X is happening? — surfaced because Y."],
  "uncertainties": ["Z is unclear — we have signal A but not signal B. Looking for B would sharpen the picture."],
  "thingsWorthNoticing": ["Concrete observation from the data. Stated, not interpreted."]
}

Rules:
- Every question must end with "— surfaced because <evidence from the data>".
- Uncertainties must name what additional signal would resolve them.
- Things worth noticing are factual observations, not judgments.
- Do NOT use words like "recommend", "should", "must" — that's overtaking.
- Do NOT generate a "risks" section or an "actions" section.`,
    userContent: `Surface today's open questions and uncertainties from this company data:\n\n${companyContext}`,
  });
}

// ─────────────────────────────────────────────────────────────
// Guide-don't-overtake decision dialogue (§3.3)
// ─────────────────────────────────────────────────────────────

export async function proposeDecisionDialogue(args: {
  situation: string;
  userDiagnosis: string;
  userProposal: string;
  companyId?: string;
}): Promise<CallResult> {
  return call({
    companyId: args.companyId,
    expectJson: true,
    maxTokens: 900,
    systemPrompt: `You are ExecOS operating under a guide-don't-overtake discipline.

The user has already described a situation, stated their own diagnosis, and proposed
what they would do. Your job is NOT to assert a different answer. Your job is to:

1. ENGAGE the user's diagnosis. Cite their words. Name what you agree with. If you
   disagree, say so plainly without overriding.
2. ADD perspective only where you see something the user didn't surface. Frame it as
   additional, not corrective.
3. OFFER a suggestion with explicit WHY. The why is the transferable asset.
4. COMPARE your suggestion to the user's proposal. Where you align, where you diverge.

You MUST NOT:
- Lead with your own diagnosis before engaging the user's
- Frame your suggestion as "the recommendation" or "the right answer"
- Generate Safe / Balanced / Aggressive tiers — the user's proposal IS the first option

Return strict JSON:
{
  "engagement": "...",
  "addedPerspective": "...",
  "suggestion": { "action": "...", "why": "..." },
  "comparison": "..."
}`,
    userContent: `Situation:
${args.situation}

My diagnosis:
${args.userDiagnosis}

My proposal:
${args.userProposal}`,
  });
}

// ─────────────────────────────────────────────────────────────
// Guide-don't-overtake conversation analyzer (§3.3)
// ─────────────────────────────────────────────────────────────

export async function analyzeConversationDialogue(args: {
  conversation: string;
  userRead: string;
  companyId?: string;
}): Promise<CallResult> {
  return call({
    companyId: args.companyId,
    expectJson: true,
    maxTokens: 1100,
    systemPrompt: `You are ExecOS Conversation Intelligence, operating under guide-don't-overtake.

The user has shared a conversation AND their own read of what was decided and what the
action items are. Your job is NOT to assert your own extraction over theirs. Your job is to:

1. ENGAGE the user's read. Cite their words. Name what you agree with.
2. ADD perspective only where you see something the user did not surface.
3. OFFER refined items with explicit WHY for each suggested change.
4. COMPARE your extraction to the user's. Where you align, where you diverge.

You MUST NOT:
- Lead with "the decision was X" as if you alone determined it
- Generate canned action items the user didn't surface, without explaining why
- Frame your read as authoritative — the people in the conversation are the authority

Return strict JSON:
{
  "engagement": "...",
  "addedPerspective": "...",
  "refinedDecision": { "text": "...", "why": "..." },
  "refinedActions": [{ "task": "...", "owner": "..."|null, "priority": "...", "deadline": "..."|null, "why": "..." }],
  "unresolvedItems": ["..."],
  "comparison": "..."
}`,
    userContent: `Conversation:
${args.conversation}

My read:
${args.userRead}`,
  });
}

// ─────────────────────────────────────────────────────────────
// Removed (audit Tier 1 #1, 2026-06-02):
//   analyzeOperations, analyzeFinance, analyzeMarketing — these emitted a
//   "healthScore: 0-100" shape which violates §3.2 and §3.4. Their routes are
//   now 410 Gone. Domain diagnosis runs through /dashboard/diagnose.
//
//   generateDecisionOptions, analyzeConversation — removed in earlier passes,
//   replaced by proposeDecisionDialogue + analyzeConversationDialogue.
//
// Compat alias kept for the briefing route name.
// ─────────────────────────────────────────────────────────────

export const generateDailyBriefing = generateDailyQuestions;
