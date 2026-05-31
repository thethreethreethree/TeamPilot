import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function generateDailyBriefing(companyContext: string): Promise<string> {
  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 600,
    system: `You are ExecOS, an AI Executive Operating System. You generate concise, executive-level daily briefings.
Your tone is authoritative, clear, and direct — like a sharp COO reporting to a CEO.
No fluff. Every sentence must carry weight. Format in 3 sections:
1) Operational Status (2-3 sentences)
2) Key Risks (2-3 bullet points)
3) Recommended Actions (2-3 bullet points)`,
    messages: [
      {
        role: "user",
        content: `Generate today's executive briefing based on this company data:\n\n${companyContext}`,
      },
    ],
  });

  const block = message.content[0];
  return block.type === "text" ? block.text : "";
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
