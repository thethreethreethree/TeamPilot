import "server-only";
import type { LlmCallArgs, LlmResult, Provider } from "./types";
import { LlmError, classifyStatusWithBody } from "./errors";
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
 * Models:   deepseek-v4-flash (fast/cheap general), deepseek-v4-pro (higher capability).
 *           Both are reasoning models (reasoning_content precedes content).
 *
 * Hardened in audit Tier 2 #9: now wraps the call with timeout + retry on
 * retryable LlmError kinds, and throws structured errors instead of generic ones.
 */

// 2026-07-25: DeepSeek RENAMED their models — the API now rejects "deepseek-chat" with
// HTTP 400 ("supported API model names are deepseek-v4-pro or deepseek-v4-flash"), which
// was silently taking down ALL AI (co-pilot, summarize, coach, dissect, customer replies).
// Diagnosed by calling the live API directly. v4-flash = the fast/cheap general model (the
// deepseek-chat successor); v4-pro is the higher-capability tier. Override via DEEPSEEK_MODEL.
// NOTE: v4 models are REASONING models — output arrives in `content` after `reasoning_content`;
// verified `content` populates correctly at the normal token budgets (finish_reason: stop).
const DEFAULT_MODEL = "deepseek-v4-flash";
const ENDPOINT = "https://api.deepseek.com/v1/chat/completions";
const DEFAULT_TIMEOUT_MS = 45_000;

/**
 * v4 models are REASONING models: `reasoning_content` is emitted BEFORE `content`
 * and COUNTS against `max_tokens` (verified 2026-07-25 via live probe — a call
 * with max_tokens:16 spent all 16 on reasoning and returned EMPTY content,
 * finish_reason:"length"). Callers budget `maxTokens` for the ANSWER; they never
 * accounted for reasoning. So the DeepSeek provider adds this headroom on top,
 * per-call, so reasoning can't starve the answer. It's a CEILING — it costs
 * nothing on calls that finish naturally, and only rescues ones that would have
 * truncated. Without it, tight-cap callers (classifyTurnSpeaker=16 → empty JSON,
 * liveSalesCue=160, care voice=80) return empty/truncated on the reasoning model.
 * The original 256 was probed on TRIVIAL tasks (16–34 reasoning tokens) — but COMPLEX prompts reason far
 * more: measured live 2026-08-06, the deep dissect burns 750–1250 reasoning tokens. So 256 was ~5x too
 * small and STARVED every deep review engine (dissect/moments) — from ~2026-07-30 they hit
 * finish_reason:"length" with EMPTY content and "Your read" went blank, for two weeks, silently. 1500
 * covers the observed complex-task reasoning with margin. It's a CEILING: costs nothing on calls that
 * finish naturally, only rescues ones that would have truncated. Anthropic (non-reasoning) needs no floor.
 */
export const REASONING_HEADROOM_TOKENS = 1500;
// Exported for the regression guard (deepseek.provider.test.ts): the outage happened because a PRIOR value
// (256) looked adequate but was calibrated on trivial tasks. The test pins a floor so a future edit can't
// silently drop it below what complex-task reasoning (750–1250 tokens, measured) needs.
export function withReasoningHeadroom(maxTokens: number | undefined): number {
  return (maxTokens ?? 900) + REASONING_HEADROOM_TOKENS;
}

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
      max_tokens: withReasoningHeadroom(args.maxTokens),
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
          kind: classifyStatusWithBody(res.status, rawBody),
          status: res.status,
          message: `DeepSeek API error ${res.status}: ${rawBody.slice(0, 200)}`,
          provider: "deepseek",
          rawBody,
        });
      }

      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string }; finish_reason?: string | null }>;
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
        };
      };
      const text = json.choices?.[0]?.message?.content ?? "";
      // Visibility for the reasoning-starvation class — never let it go silent again. If the model returned
      // NO content because it hit the token ceiling (reasoning consumed the whole budget), say so LOUDLY.
      // Callers treat empty text as "no signal", so without this the failure is invisible — exactly how the
      // 2026-07-30 dissect outage hid for two weeks.
      if (!text.trim() && json.choices?.[0]?.finish_reason === "length") {
        // eslint-disable-next-line no-console
        console.error(
          `[deepseek] EMPTY content with finish_reason:"length" (model=${model}, completion_tokens=${json.usage?.completion_tokens}) — the token budget was consumed by reasoning before any answer was emitted. Raise the caller's maxTokens or REASONING_HEADROOM_TOKENS.`
        );
      }
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
      max_tokens: withReasoningHeadroom(args.maxTokens),
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
        kind: classifyStatusWithBody(res.status, rawBody),
        status: res.status,
        message: `DeepSeek stream error ${res.status}: ${rawBody.slice(0, 200)}`,
        provider: "deepseek",
        rawBody,
      });
    }

    yield* parseSseDeltas(res);
  },
};
