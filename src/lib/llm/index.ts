import "server-only";
import "@/lib/env"; // side-effect: validates env at first LLM call (fails fast)
import { deepseekProvider } from "./deepseek";
import { anthropicProvider } from "./anthropic";
import type { LlmCallArgs, LlmResult, Provider } from "./types";

export * from "./types";

/**
 * Provider selection.
 *
 * Order of preference:
 *   1. LLM_PROVIDER env var if set ('deepseek' | 'anthropic')
 *   2. DeepSeek if DEEPSEEK_API_KEY is set
 *   3. Anthropic if ANTHROPIC_API_KEY is set
 *   4. Throw a clear error — no silent fallback to a broken state.
 */
export function chooseProvider(): Provider {
  const preferred = process.env.LLM_PROVIDER?.toLowerCase();
  if (preferred === "deepseek") return deepseekProvider;
  if (preferred === "anthropic") return anthropicProvider;
  if (deepseekProvider.enabled()) return deepseekProvider;
  if (anthropicProvider.enabled()) return anthropicProvider;
  throw new Error(
    "No LLM provider configured. Set DEEPSEEK_API_KEY (preferred) or ANTHROPIC_API_KEY."
  );
}

export function activeProviderName(): string | null {
  try {
    return chooseProvider().name;
  } catch {
    return null;
  }
}

/**
 * Single entry point for every LLM call in the codebase. Companies that have not
 * yet passed the Month-1 control window (§3.4) — or have ai_guidance_enabled=false
 * — will have their calls *short-circuited* at the brain layer, not here. This
 * function is the dumb pipe; the brain decides whether the pipe is allowed to run.
 */
export async function llmCall(args: LlmCallArgs): Promise<LlmResult> {
  const provider = chooseProvider();
  return provider.call(args);
}

/**
 * Streaming variant. Yields text deltas as they arrive. Falls back to the
 * non-streaming `call` and yields once at the end if the provider doesn't
 * support streaming.
 */
export async function* llmStream(args: LlmCallArgs): AsyncIterable<string> {
  const provider = chooseProvider();
  if (provider.stream) {
    yield* provider.stream(args);
    return;
  }
  const r = await provider.call(args);
  yield r.text;
}
