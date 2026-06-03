import "server-only";
import type { LlmCallArgs, LlmResult, Provider } from "./types";
import { LlmError, classifyStatus } from "./errors";
import { fetchWithTimeout, withRetry } from "./retry";

/**
 * Parse an SSE (Server-Sent Events) stream into a sequence of text deltas.
 * DeepSeek follows the OpenAI shape: `data: {json}\n\n` per event, ending
 * with `data: [DONE]\n\n`.
 */
async function* parseSseDeltas(
  response: Response
): AsyncGenerator<string, void, void> {
  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // SSE events are separated by double-newline.
      let idx;
      while ((idx = buffer.indexOf("\n\n")) !== -1) {
        const rawEvent = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        // Each event may have multiple `data:` lines.
        for (const line of rawEvent.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === "[DONE]") return;
          try {
            const parsed = JSON.parse(payload) as {
              choices?: Array<{
                delta?: { content?: string };
                finish_reason?: string | null;
              }>;
            };
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) yield delta;
          } catch {
            /* skip malformed event */
          }
        }
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* already released */
    }
  }
}

/**
 * DeepSeek provider — OpenAI-compatible chat completions API.
 *
 * Endpoint: https://api.deepseek.com/v1/chat/completions
 * Models:   deepseek-chat (general), deepseek-reasoner (longer thinking)
 *
 * Hardened in audit Tier 2 #9: now wraps the call with timeout + retry on
 * retryable LlmError kinds, and throws structured errors instead of generic ones.
 */

const DEFAULT_MODEL = "deepseek-chat";
const ENDPOINT = "https://api.deepseek.com/v1/chat/completions";
const DEFAULT_TIMEOUT_MS = 45_000;

export const deepseekProvider: Provider = {
  name: "deepseek",
  enabled: () => Boolean(process.env.DEEPSEEK_API_KEY),
  defaultModel: () => process.env.DEEPSEEK_MODEL ?? DEFAULT_MODEL,
  async call(args: LlmCallArgs): Promise<LlmResult> {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      throw new LlmError({
        kind: "auth",
        message: "DEEPSEEK_API_KEY not set.",
        provider: "deepseek",
        retryable: false,
      });
    }

    const model = process.env.DEEPSEEK_MODEL ?? DEFAULT_MODEL;
    const body = {
      model,
      messages: [
        { role: "system", content: args.systemPrompt },
        ...args.messages.map((m) => ({ role: m.role, content: m.content })),
      ],
      max_tokens: args.maxTokens ?? 900,
      ...(args.expectJson ? { response_format: { type: "json_object" } } : {}),
    };

    return withRetry(async () => {
      const startedAt = Date.now();
      const res = await fetchWithTimeout(
        ENDPOINT,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        },
        { timeoutMs: DEFAULT_TIMEOUT_MS, provider: "deepseek" }
      );

      if (!res.ok) {
        const rawBody = await res.text();
        throw new LlmError({
          kind: classifyStatus(res.status),
          status: res.status,
          message: `DeepSeek API error ${res.status}: ${rawBody.slice(0, 200)}`,
          provider: "deepseek",
          rawBody,
        });
      }

      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
        };
      };
      const text = json.choices?.[0]?.message?.content ?? "";
      const u = json.usage;
      return {
        text,
        model,
        provider: "deepseek",
        latencyMs: Date.now() - startedAt,
        usage: u
          ? {
              promptTokens: u.prompt_tokens,
              completionTokens: u.completion_tokens,
              totalTokens: u.total_tokens,
            }
          : undefined,
      };
    });
  },
  async *stream(args: LlmCallArgs): AsyncIterable<string> {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      throw new LlmError({
        kind: "auth",
        message: "DEEPSEEK_API_KEY not set.",
        provider: "deepseek",
        retryable: false,
      });
    }
    const model = process.env.DEEPSEEK_MODEL ?? DEFAULT_MODEL;
    const body = {
      model,
      messages: [
        { role: "system", content: args.systemPrompt },
        ...args.messages.map((m) => ({ role: m.role, content: m.content })),
      ],
      max_tokens: args.maxTokens ?? 900,
      stream: true,
      ...(args.expectJson ? { response_format: { type: "json_object" } } : {}),
    };

    const res = await fetchWithTimeout(
      ENDPOINT,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify(body),
      },
      { timeoutMs: DEFAULT_TIMEOUT_MS, provider: "deepseek" }
    );

    if (!res.ok) {
      const rawBody = await res.text();
      throw new LlmError({
        kind: classifyStatus(res.status),
        status: res.status,
        message: `DeepSeek stream error ${res.status}: ${rawBody.slice(0, 200)}`,
        provider: "deepseek",
        rawBody,
      });
    }

    yield* parseSseDeltas(res);
  },
};
