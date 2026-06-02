import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { LlmCallArgs, LlmResult, Provider } from "./types";

/**
 * Anthropic provider — kept as an alternate per AMD-003 outside-view check.
 * Single-provider risk is real; a configurable alternate is the structural
 * protection.
 */

const DEFAULT_MODEL = "claude-sonnet-4-6";

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

export const anthropicProvider: Provider = {
  name: "anthropic",
  enabled: () => Boolean(process.env.ANTHROPIC_API_KEY),
  defaultModel: () => process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL,
  async call(args: LlmCallArgs): Promise<LlmResult> {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error(
        "ANTHROPIC_API_KEY not set. Provider 'anthropic' is selected but not configured."
      );
    }
    const model = process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL;
    const message = await getClient().messages.create({
      model,
      max_tokens: args.maxTokens ?? 900,
      system: args.systemPrompt,
      messages: args.messages.map((m) => ({ role: m.role, content: m.content })),
    });
    const block = message.content[0];
    const text = block?.type === "text" ? block.text : "";
    return { text, model, provider: "anthropic" };
  },
};
