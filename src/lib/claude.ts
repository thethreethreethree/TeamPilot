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
