import "server-only";
import type { LlmCallArgs, LlmResult, Provider } from "./types";

/**
 * DeepSeek provider — OpenAI-compatible chat completions API.
 *
 * Endpoint: https://api.deepseek.com/v1/chat/completions
 * Models:   deepseek-chat (general), deepseek-reasoner (longer thinking)
 *
 * DeepSeek's API mirrors OpenAI's so a small fetch wrapper suffices — we don't
 * pull the OpenAI SDK in just for this.
 */

const DEFAULT_MODEL = "deepseek-chat";
const ENDPOINT = "https://api.deepseek.com/v1/chat/completions";

export const deepseekProvider: Provider = {
  name: "deepseek",
  enabled: () => Boolean(process.env.DEEPSEEK_API_KEY),
  defaultModel: () => process.env.DEEPSEEK_MODEL ?? DEFAULT_MODEL,
  async call(args: LlmCallArgs): Promise<LlmResult> {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      throw new Error(
        "DEEPSEEK_API_KEY not set. Provider 'deepseek' is selected but not configured."
      );
    }

    const model = process.env.DEEPSEEK_MODEL ?? DEFAULT_MODEL;
    const body = {
      model,
      messages: [
        { role: "system", content: args.systemPrompt },
        ...args.messages.map((m) => ({ role: m.role, content: m.content })),
      ],
      max_tokens: args.maxTokens ?? 900,
      // DeepSeek supports JSON mode on the chat-completions API — request it when
      // the caller plans to parse JSON. Failing here would silently produce
      // unparseable text downstream.
      ...(args.expectJson ? { response_format: { type: "json_object" } } : {}),
    };

    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`DeepSeek API error ${res.status}: ${errText.slice(0, 400)}`);
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = json.choices?.[0]?.message?.content ?? "";
    return { text, model, provider: "deepseek" };
  },
};
