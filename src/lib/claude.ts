import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Daily briefing — reframed under guide-don't-overtake (CLAUDE.md §3.3).
 *
 * The old briefing asserted "today's recommended actions" — the System telling the
 * executive what to do. That's the overtake. The new briefing surfaces the SAME data
 * but as the questions the executive should be holding open today, plus the
 * uncertainties they should be examining. Surface, don't direct.
 */
export async function generateDailyQuestions(companyContext: string): Promise<string> {
  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 700,
    system: `You are ExecOS, surfacing today's open questions for an executive.

You do NOT recommend actions. You do NOT diagnose problems on day one. You surface what
the data is *asking* — the questions the executive should be holding open today and the
uncertainties that deserve their attention. The executive decides what to do; your role
is to ensure they are looking at the right things.

Return strict JSON:
{
  "todaysQuestions": [
    "What's the underlying reason X is happening? — surfaced because Y."
  ],
  "uncertainties": [
    "Z is unclear — we have signal A but not signal B. Looking for B would sharpen the picture."
  ],
  "thingsWorthNoticing": [
    "Concrete observation from the data. Stated, not interpreted."
  ]
}

Rules:
- Every question must end with "— surfaced because <evidence from the data>". No floating
  questions.
- Uncertainties must name what additional signal would resolve them.
- Things worth noticing are factual observations, not judgments.
- Do NOT use words like "recommend", "should", "must" — that's overtaking.
- Do NOT generate a "risks" section or an "actions" section. Those are for the executive,
  not for you.`,
    messages: [
      {
        role: "user",
        content: `Surface today's open questions and uncertainties from this company data:\n\n${companyContext}`,
      },
    ],
  });

  const block = message.content[0];
  return block.type === "text" ? block.text : "{}";
}

/** @deprecated Use generateDailyQuestions. Kept for transition only. */
export async function generateDailyBriefing(companyContext: string): Promise<string> {
  return generateDailyQuestions(companyContext);
}

/**
 * Guide-don't-overtake decision dialogue (CLAUDE.md §3.3, docs/GUIDE_DONT_OVERTAKE.md).
 *
 * Replaces generateDecisionOptions(). The user's own diagnosis and proposal are
 * REQUIRED inputs — the function cannot be called without them. Claude is instructed
 * to engage the user's read first, then add perspective, then offer a suggestion with
 * an explicit WHY, then compare to the user's proposal.
 *
 * Never returns canned Safe/Balanced/Aggressive tiers. That framing presupposes the
 * answer space exists independent of the user, which is the failure mode this rewrite
 * exists to defeat.
 */
export async function proposeDecisionDialogue(args: {
  situation: string;
  userDiagnosis: string;
  userProposal: string;
}): Promise<string> {
  const { situation, userDiagnosis, userProposal } = args;

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 900,
    system: `You are ExecOS operating under a guide-don't-overtake discipline.

The user has already described a situation, stated their own diagnosis, and proposed
what they would do. Your job is NOT to assert a different answer. Your job is to:

1. ENGAGE the user's diagnosis. Cite their words. Name what you agree with. If you
   disagree, say so plainly without overriding.
2. ADD perspective only where you see something the user didn't surface. Frame it as
   additional, not corrective.
3. OFFER a suggestion with explicit WHY. The why is the transferable asset. A proposal
   without a stated why is incomplete.
4. COMPARE your suggestion to the user's proposal. Where you align, where you diverge,
   and what the divergence suggests they should weigh.

You MUST NOT:
- Lead with your own diagnosis before engaging the user's
- Frame your suggestion as "the recommendation" or "the right answer"
- Generate Safe / Balanced / Aggressive tiers — the user's proposal IS the first option
- Overtake the conversation

Return strict JSON:
{
  "engagement": "what you agree with from the user's diagnosis, in their framing",
  "addedPerspective": "anything you see that the user did not surface, or empty string if none",
  "suggestion": {
    "action": "concrete proposal",
    "why": "explicit reasoning — what makes this a better destination than the alternatives"
  },
  "comparison": "where your suggestion aligns with the user's proposal, where it diverges, and what the divergence suggests"
}`,
    messages: [
      {
        role: "user",
        content: `Situation:
${situation}

My diagnosis (what I think is going on):
${userDiagnosis}

My proposal (what I would do, and why):
${userProposal}`,
      },
    ],
  });

  const block = message.content[0];
  return block.type === "text" ? block.text : "{}";
}

export async function generateDecisionOptions(situation: string): Promise<string> {
  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 800,
    system: `You are ExecOS, an AI Executive Decision Engine. Given a business situation, generate structured decision options.
Format your response as JSON with this structure:
{
  "diagnosis": "...",
  "biggestRisk": "...",
  "options": {
    "safe": { "action": "...", "expectedOutcome": "...", "tradeoff": "..." },
    "balanced": { "action": "...", "expectedOutcome": "...", "tradeoff": "..." },
    "aggressive": { "action": "...", "expectedOutcome": "...", "tradeoff": "..." }
  },
  "recommendation": "..."
}`,
    messages: [
      {
        role: "user",
        content: `Analyze this business situation and generate decision options:\n\n${situation}`,
      },
    ],
  });

  const block = message.content[0];
  return block.type === "text" ? block.text : "{}";
}

/**
 * Guide-don't-overtake conversation analyzer (CLAUDE.md §3.3).
 *
 * The user MUST state their own read of the conversation before the System extracts
 * anything. This is the structural interrupt that prevents the System from asserting
 * "the meeting decided X" before the human in the room has said what they think.
 */
export async function analyzeConversationDialogue(args: {
  conversation: string;
  userRead: string; // user's own read of decisions / action items
}): Promise<string> {
  const { conversation, userRead } = args;

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1100,
    system: `You are ExecOS Conversation Intelligence, operating under guide-don't-overtake discipline.

The user has shared a conversation AND their own read of what was decided and what the
action items are. Your job is NOT to assert your own extraction over theirs. Your job is:

1. ENGAGE the user's read. What in their read does the conversation support? Cite their
   words. Where you disagree, name it; do not silently override.
2. ADD perspective only where you see something the user did not surface — unstated
   tensions, items the conversation left ambiguous, owners that were assumed not assigned.
3. OFFER refined items with explicit WHY for each suggested change (action item, owner,
   deadline, decision).
4. COMPARE your extraction to the user's. Where you align, where you diverge, what the
   divergence reveals about the conversation itself (was it ambiguous? was the user
   reading meaning into it that wasn't there? was the System over-extracting?).

You MUST NOT:
- Lead with "the decision was X" as if you alone determined it
- Generate canned action items the user didn't surface, without explaining why you added them
- Frame your read as authoritative — the people in the conversation are the authority

Return strict JSON:
{
  "engagement": "what you agree with from the user's read, citing their framing",
  "addedPerspective": "anything the user did not surface — unstated tensions, ambiguity, unassigned owners. Empty string if nothing.",
  "refinedDecision": { "text": "your suggested decision phrasing", "why": "what makes this clearer than the alternatives" },
  "refinedActions": [
    { "task": "...", "owner": "... or null if unclear", "priority": "High|Medium|Low", "deadline": "... or null if not stated", "why": "why this item, and why with this owner/priority/deadline" }
  ],
  "unresolvedItems": ["explicit unresolved items, in the conversation's own framing"],
  "comparison": "where your refined items align with the user's read, where they diverge, what the divergence reveals"
}`,
    messages: [
      {
        role: "user",
        content: `Conversation:
${conversation}

My read (what I think was decided and what the action items are):
${userRead}`,
      },
    ],
  });

  const block = message.content[0];
  return block.type === "text" ? block.text : "{}";
}

export async function analyzeConversation(conversation: string): Promise<string> {
  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 900,
    system: `You are ExecOS Conversation Intelligence. Analyze team conversations and turn them into structured executive outputs.
Format your response as JSON:
{
  "summary": "...",
  "keyPoints": ["...", "..."],
  "agreements": ["..."],
  "unresolvedItems": ["..."],
  "decision": "...",
  "actionPlan": [
    { "task": "...", "owner": "...", "priority": "High|Medium|Low", "deadline": "..." }
  ],
  "executiveNote": "..."
}`,
    messages: [
      {
        role: "user",
        content: `Analyze this conversation and generate a structured decision + action plan:\n\n${conversation}`,
      },
    ],
  });

  const block = message.content[0];
  return block.type === "text" ? block.text : "{}";
}

export async function analyzeFinance(financeData: string): Promise<string> {
  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 600,
    system: `You are ExecOS Finance Analyzer. Assess financial health, cash runway, burn, and revenue trajectory from finance data.
Format as JSON:
{
  "healthScore": 0-100,
  "diagnosis": "...",
  "topRisks": ["...", "..."],
  "immediateActions": ["...", "..."],
  "riskLevel": "Low|Medium|High|Critical"
}`,
    messages: [
      {
        role: "user",
        content: `Analyze this company's finances and identify risks:\n\n${financeData}`,
      },
    ],
  });

  const block = message.content[0];
  return block.type === "text" ? block.text : "{}";
}

export async function analyzeMarketing(marketingData: string): Promise<string> {
  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 600,
    system: `You are ExecOS Marketing Analyzer. Assess marketing performance — lead generation, CAC, channel ROI, and funnel conversion — from marketing data.
Format as JSON:
{
  "healthScore": 0-100,
  "diagnosis": "...",
  "topRisks": ["...", "..."],
  "immediateActions": ["...", "..."],
  "riskLevel": "Low|Medium|High|Critical"
}`,
    messages: [
      {
        role: "user",
        content: `Analyze this company's marketing performance and identify issues:\n\n${marketingData}`,
      },
    ],
  });

  const block = message.content[0];
  return block.type === "text" ? block.text : "{}";
}

export async function analyzeOperations(operationsData: string): Promise<string> {
  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 600,
    system: `You are ExecOS Operations Analyzer. Identify bottlenecks, risks, and execution failures from operational data.
Format as JSON:
{
  "healthScore": 0-100,
  "diagnosis": "...",
  "topBottlenecks": ["...", "..."],
  "immediateActions": ["...", "..."],
  "riskLevel": "Low|Medium|High|Critical"
}`,
    messages: [
      {
        role: "user",
        content: `Analyze these operations and identify issues:\n\n${operationsData}`,
      },
    ],
  });

  const block = message.content[0];
  return block.type === "text" ? block.text : "{}";
}
