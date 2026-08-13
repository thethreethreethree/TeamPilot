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
  response: Response,
  ctx: { model: string; budget: number }
): AsyncGenerator<string, void, void> {
  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  // Reasoning-starvation visibility on the STREAM path (audit 2026-08-13). The non-stream `call` path logs
  // finish_reason:"length" loudly; the stream path used to parse finish_reason into the type but never read it,
  // so a starved streaming engine (suggest/copilot/formulate/briefing) truncated SILENTLY — the same class the
  // 2026-07-30 outage hid in, just on the streaming callers. Track it and log at end-of-stream.
  let finishReason: string | null = null;
  let sawContent = false;
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
            const choice = parsed.choices?.[0];
            if (choice?.finish_reason) finishReason = choice.finish_reason;
            const delta = choice?.delta?.content;
            if (delta) {
              sawContent = true;
              yield delta;
            }
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
    if (finishReason === "length") {
      // eslint-disable-next-line no-console
      console.error(
        `[deepseek] stream finish_reason:"length" — ${
          sawContent ? "TRUNCATED answer (cut mid-stream)" : "EMPTY content"
        } (model=${ctx.model}, budget=${ctx.budget}) — reasoning consumed the token budget. Raise the caller's maxTokens or REASONING_HEADROOM_TOKENS.`
      );
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
 * The original 256 was probed on TRIVIAL tasks (16–34 reasoning tokens). But reasoning SCALES WITH PROMPT
 * SIZE + COMPLEXITY, and the coach review prompts are large (a ~9k-token methodology knowledge base + the
 * full transcript): measured live 2026-08-06, they burn 1300–2620 reasoning tokens (variable per run). So
 * 256 — and even a first-cut 1500 — under-covered them: the tight-budget review engine (debriefCoachV5,
 * base 700) still hit finish_reason:"length" with EMPTY content → "Your read" blank. 3500 covers the
 * observed worst case (~2620) plus the answer with real margin, verified across repeated runs on a
 * ~9k-token prompt. It's a CEILING: costs nothing on calls that finish naturally, only rescues ones that
 * would have truncated; short engines (attribution=16) are unaffected. Anthropic (non-reasoning) needs none.
 */
// Raised 3500 → 7000 (founder incident 2026-08-13): a first-client rep's "Your read" went blank on a real 4–5
// min call — the after-pitch AUTO-HEAL already re-ran the dissect and it STILL came back empty, i.e. PERSISTENT,
// which is the starvation signature on a prompt LARGER than the ~9k-token calibration (a bigger custom
// methodology corpus + product knowledge + the full transcript → reasoning scales past 3500). 7000 covers a
// prompt ~2.6× the calibration. It stays a CEILING (costs nothing on calls that finish naturally).
export const REASONING_HEADROOM_TOKENS = 7000;
// Hard ceiling on the TOTAL max_tokens we ever send, so a large answer budget + the raised headroom can't exceed
// the model's output limit (deepseek-v4 = 8192) and 400 EVERY call. 8000 leaves margin under 8192; the current
// confirmed-working total was 5000, so 8000 is safely within the model's range. The big engines (dissect 1100,
// review 1500) clamp to 8000 (≈6900/6500 reasoning room); the tiny live engines are far below the clamp.
export const MAX_TOTAL_TOKENS = 8000;
// Exported for the regression guard (deepseek.provider.test.ts): the outage happened because a PRIOR value
// (256) looked adequate but was calibrated on trivial tasks. The test pins a floor so a future edit can't
// silently drop it below what complex-task reasoning needs.
export function withReasoningHeadroom(maxTokens: number | undefined): number {
  return Math.min((maxTokens ?? 900) + REASONING_HEADROOM_TOKENS, MAX_TOTAL_TOKENS);
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
      const finishReason = json.choices?.[0]?.finish_reason;
      // Visibility for the reasoning-starvation class — never let it go silent again. If the model hit the token
      // ceiling (reasoning consumed the budget), say so LOUDLY. Callers treat empty/unparseable text as "no
      // signal", so without this the failure is invisible — exactly how the 2026-07-30 dissect outage hid for two
      // weeks. Fires on BOTH shapes: EMPTY content (reasoning ate everything) AND a TRUNCATED answer (reasoning
      // ate most, a partial answer emitted then cut — which then fails JSON parse as a vague "no signal"). The
      // completion_tokens tells us how much headroom the real prompt actually needs (to size a fix precisely).
      if (finishReason === "length") {
        // eslint-disable-next-line no-console
        console.error(
          `[deepseek] finish_reason:"length" — ${
            text.trim() ? `TRUNCATED answer (${text.length} chars, likely fails JSON parse)` : "EMPTY content"
          } (model=${model}, prompt_tokens=${json.usage?.prompt_tokens}, completion_tokens=${json.usage?.completion_tokens}, budget=${withReasoningHeadroom(args.maxTokens)}) — reasoning consumed the token budget. Raise the caller's maxTokens or REASONING_HEADROOM_TOKENS above completion_tokens.`
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

    yield* parseSseDeltas(res, {
      model,
      budget: withReasoningHeadroom(args.maxTokens),
    });
  },
};
