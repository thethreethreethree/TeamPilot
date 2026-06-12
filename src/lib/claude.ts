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
    systemPrompt: `You are ELOSTATE, surfacing today's open questions for an executive.

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
    systemPrompt: `You are ELOSTATE operating under a guide-don't-overtake discipline.

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
// Removed (Pass-3 audit, 2026-06-04):
//   analyzeConversationDialogue — Conversation Dialogue was deprecated
//   structurally by migration 0013 (dropping the `conversations` table).
//   The §1.7 audit then surfaced the remaining UI + routes as dead
//   surface. Removed end-to-end: page, two routes, sidebar nav,
//   command palette entry, validator schema, the persistence kind, and
//   this function. Conversation analysis (when re-added) should target
//   chat_topics + chat_messages instead, where the chain already lives.
//
// Removed (audit Tier 1 #1, 2026-06-02):
//   analyzeOperations, analyzeFinance, analyzeMarketing — emitted a
//   "healthScore: 0-100" shape which violates §3.2 and §3.4. Their routes
//   now return 410 Gone. Domain diagnosis runs through /dashboard/diagnose.
//
//   generateDecisionOptions, analyzeConversation — removed in earlier
//   passes, replaced by proposeDecisionDialogue and (former)
//   analyzeConversationDialogue.
//
// Compat alias kept for the briefing route name.
// ─────────────────────────────────────────────────────────────

export const generateDailyBriefing = generateDailyQuestions;

// ─────────────────────────────────────────────────────────────
// Conversational Coach v3 — LLM pattern detection (mirror frame)
// ─────────────────────────────────────────────────────────────
//
// The instant regex pass (src/lib/coach/heuristics.ts) catches explicit
// pattern words ("stupid", "always", "we should"). v3 adds an LLM pass
// for the patterns regex cannot read — blame projection in non-canonical
// forms, hot-state signaling, emotional escalation that uses words
// outside the rigid lexicon. The user's example "I'm hungry and you
// guys are making mad" is exactly this class.
//
// CONSTITUTIONAL DEFENSE (asset A11, mirror frame):
//   The LLM IDENTIFIES which pattern shape is present (factual). It
//   does NOT render a verdict on whether the user is right/wrong/good/
//   bad. The chip surfaces the count + question; the user judges. The
//   LLM is constrained to return patterns from a fixed vocabulary so
//   it cannot invent a "this is wrong because X" framing.
//
// What the LLM is allowed to return:
//   - One of the seven canonical pattern IDs:
//       nvc-evaluation, voss-bare-assertion, stone-identity-collision,
//       coach-blame-projection, coach-emotional-escalation,
//       coach-hot-state, coach-aggressive-language
//   - The trigger excerpt (the actual span in the user's text)
//   - Confidence: "high" | "medium" | "low" — used to gate surfacing
//
// What the LLM is NOT allowed to return:
//   - A new pattern id (we constrain via the schema)
//   - A judgment about whether the user is wrong
//   - A "fix" — the citation's own suggestion field handles that

export type CoachLlmHit = {
  pattern_id:
    | "nvc-evaluation"
    | "voss-bare-assertion"
    | "stone-identity-collision"
    | "coach-blame-projection"
    | "coach-emotional-escalation"
    | "coach-hot-state"
    | "coach-aggressive-language";
  trigger_excerpt: string;
  confidence: "high" | "medium" | "low";
  // Brief reason — for the §4 readout, NOT shown to the user.
  reason: string;
};

export async function proposeCoachPatterns(args: {
  draft: string;
  // Recent thread excerpt (last 3-5 messages) so the LLM can read tone
  // context. Stripped of author names by the caller to avoid bias.
  recentThread?: string;
  companyId?: string;
}): Promise<CallResult> {
  return call({
    companyId: args.companyId,
    expectJson: true,
    maxTokens: 600,
    systemPrompt: `You are the ELOSTATE Conversational Coach v3 detection pass.

Your job: identify which of seven specific COMMUNICATION PATTERN SHAPES appear in the user's draft message. You are NOT judging the message. You are NOT saying it is wrong. You are surfacing PATTERN PRESENCE so the user's own UI can ask them a question.

THE SEVEN ALLOWED PATTERNS (return pattern_id exactly as written):

1. nvc-evaluation
   The draft contains evaluation language rather than observation language —
   absolutes (always/never), pejorative shorthand ("this is stupid/broken/
   garbage"), mind-reading ("you don't get it"), or "obviously/clearly"
   asserting one read as the only read.

2. voss-bare-assertion
   The draft OPENS with an assertion or prescription ("We should...",
   "You need to...", "The answer is...") without first labeling the
   other person's position or context.

3. stone-identity-collision
   The draft critiques WHO someone is rather than WHAT they did
   ("you're incompetent", "they're lazy", "he's a moron").

4. coach-blame-projection
   The draft locates the cause of the writer's emotional state in
   another person ("you're making me mad", "you guys are making me
   stressed", "you made me feel X").

5. coach-emotional-escalation
   The draft uses heightened emotional language that may overshoot the
   recipient's ability to act on it ("absolutely unacceptable", "I'm
   livid", "this is a disaster", "I'm done with this").

6. coach-hot-state
   The draft signals the WRITER is in a tired/hungry/stressed/burnt-out
   state while composing ("I'm hungry", "I'm exhausted", "I'm so
   stressed", "I haven't slept", "I'm fried"). This is not about
   whether the message is valid — it's noticing the author may not
   want this exact message to be the durable record tomorrow.

7. coach-aggressive-language
   The draft contains profanity or direct aggression aimed AT a person
   in the conversation ("fuck off", "shut up", "you're an idiot").
   Generic frustration at situations is NOT this pattern (it's nvc-
   evaluation if anything).

RULES:
- Be conservative. Only flag clear matches. When in doubt, DO NOT flag.
- Multiple patterns CAN apply to one draft. Return all of them.
- Use confidence to mark how clearly the pattern appears.
- trigger_excerpt must be the EXACT span from the draft, not paraphrased.
- reason is brief (< 12 words) and describes the pattern shape, NOT a
  judgment of the user.

Return STRICT JSON in this exact shape:

{
  "hits": [
    {
      "pattern_id": "coach-blame-projection",
      "trigger_excerpt": "you guys are making mad",
      "confidence": "high",
      "reason": "locates emotional cause in others"
    }
  ]
}

If no patterns are present, return: { "hits": [] }`,
    userContent: `Draft to analyze:

${args.draft}
${args.recentThread ? `\nRecent thread context (for tone, not blame attribution):\n${args.recentThread}` : ""}`,
  });
}
