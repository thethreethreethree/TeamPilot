import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { LlmCallArgs, LlmResult, Provider } from "./types";
import { LlmError, classifyStatus } from "./errors";
import { withRetry } from "./retry";

/**
 * Anthropic provider — kept as an alternate per AMD-003. Hardened with retry
 * + structured errors in audit Tier 2 #9. The Anthropic SDK has its own
 * timeout; we wrap the call in retry only.
 */

const DEFAULT_MODEL = "claude-sonnet-4-6";
const TIMEOUT_MS = 45_000;

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: TIMEOUT_MS,
    });
  }
  return client;
}

export const anthropicProvider: Provider = {
  name: "anthropic",
  enabled: () => Boolean(process.env.ANTHROPIC_API_KEY),
  defaultModel: () => process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL,
  async call(args: LlmCallArgs): Promise<LlmResult> {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new LlmError({
        kind: "auth",
        message: "ANTHROPIC_API_KEY not set.",
        provider: "anthropic",
        retryable: false,
      });
    }
    const model = process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL;

    return withRetry(async () => {
      try {
        const message = await getClient().messages.create({
          model,
          max_tokens: args.maxTokens ?? 900,
          system: args.systemPrompt,
          messages: args.messages.map((m) => ({ role: m.role, content: m.content })),
        });
        const block = message.content[0];
        const text = block?.type === "text" ? block.text : "";
        return { text, model, provider: "anthropic" };
      } catch (err) {
        // Translate Anthropic SDK errors into our structured shape.
        const e = err as { status?: number; message?: string };
        if (typeof e.status === "number") {
          throw new LlmError({
            kind: classifyStatus(e.status),
            status: e.status,
            message: e.message ?? `Anthropic API error ${e.status}`,
            provider: "anthropic",
          });
        }
        throw new LlmError({
          kind: "network",
          message: e.message ?? "Anthropic network error",
          provider: "anthropic",
        });
      }
    });
  },
  async *stream(args: LlmCallArgs): AsyncIterable<string> {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new LlmError({
        kind: "auth",
        message: "ANTHROPIC_API_KEY not set.",
        provider: "anthropic",
        retryable: false,
      });
    }
    const model = process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL;
    try {
      const stream = getClient().messages.stream({
        model,
        max_tokens: args.maxTokens ?? 900,
        system: args.systemPrompt,
        messages: args.messages.map((m) => ({ role: m.role, content: m.content })),
      });
      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          yield event.delta.text;
        }
      }
    } catch (err) {
      const e = err as { status?: number; message?: string };
      if (typeof e.status === "number") {
        throw new LlmError({
          kind: classifyStatus(e.status),
          status: e.status,
          message: e.message ?? `Anthropic stream error ${e.status}`,
          provider: "anthropic",
        });
      }
      throw new LlmError({
        kind: "network",
        message: e.message ?? "Anthropic stream network error",
        provider: "anthropic",
      });
    }
  },
};
