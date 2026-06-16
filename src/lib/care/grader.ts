import "server-only";
import { gradeCoachV5 } from "@/lib/claude";

/**
 * Coach grading for Care agent replies.
 *
 * Same shape as the internal Coach v5 grader — productive /
 * neutral / needs_guidance / withheld — applied to the
 * customer-facing voice. The grade is internal: agent + leader
 * only, never customer.
 *
 * Voice rubric (the customer-safe version of the Coach
 * principles, citation-free):
 *   productive       — resolution-centered, warm, observation-
 *                       based, gave the customer a concrete next
 *                       step, no corporate filler, no false
 *                       certainty
 *   neutral          — fine but not notable; could be a template
 *                       reply or a one-liner
 *   needs_guidance   — read as dismissive, condescending,
 *                       evaluation-disguised-as-fact, or made up
 *                       an answer it shouldn't have. Signal —
 *                       not a verdict.
 *   withheld         — grader call failed or response was unparseable
 */

const SYSTEM = `You are grading a support agent's reply to a customer. You grade on FOUR categories:

  - productive       — resolution-centered, warm, honest, gives the customer a clear next step or honest hand-off
  - neutral          — fine, not notable. Often a one-liner or a template
  - needs_guidance   — reads as dismissive / condescending / evaluation-disguised-as-fact, OR invents a feature/price/policy that wasn't grounded in the conversation
  - withheld         — only if you genuinely cannot grade

Return STRICT JSON, no markdown, no commentary:
{ "grade": "productive" | "neutral" | "needs_guidance" | "withheld", "reasonInternal": "1-2 sentence reason — internal-only, the agent will see this" }

DO NOT include any other keys. DO NOT include the customer's words in the reason. The reason is for the agent's growth — keep it specific and short.`;

export async function gradeCareAgentReply(args: {
  customerLastMessage: string;
  agentReply: string;
  conversationContext?: string;
}): Promise<{
  grade: "productive" | "neutral" | "needs_guidance" | "withheld";
  reasonInternal: string;
}> {
  const userMessage = [
    args.conversationContext ? `Conversation so far:\n${args.conversationContext}` : null,
    `Customer's most recent message:\n${args.customerLastMessage}`,
    `Agent's reply (the one to grade):\n${args.agentReply}`,
    `Grade the agent's reply.`,
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const r = await gradeCoachV5({
      systemPrompt: SYSTEM,
      userMessage,
    });
    if (r.suppressed) {
      return { grade: "withheld", reasonInternal: "" };
    }
    const parsed = JSON.parse(r.text) as {
      grade?: string;
      reasonInternal?: string;
    };
    const grade = parsed.grade;
    if (
      grade === "productive" ||
      grade === "neutral" ||
      grade === "needs_guidance"
    ) {
      return {
        grade,
        reasonInternal: (parsed.reasonInternal ?? "").slice(0, 600),
      };
    }
    return { grade: "withheld", reasonInternal: "" };
  } catch {
    return { grade: "withheld", reasonInternal: "" };
  }
}
