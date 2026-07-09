import "server-only";
import "@/lib/env"; // side-effect: validates env at first LLM call (fails fast)
import { deepseekProvider } from "./deepseek";
import { anthropicProvider } from "./anthropic";
import { LlmError } from "./errors";
import type { LlmCallArgs, LlmResult, Provider } from "./types";
import { shapeSystemPrompt } from "@/lib/experience/mode";

export * from "./types";

/**
 * Experience Mode injection (0110, Phase 2). The SINGLE point where the
 * Standard/Expert dial reshapes AI output: shapeSystemPrompt() appends the
 * Standard directive for every call that carries the user's mode. Expert / unset
 * → unchanged (today's behavior). Because both llmCall and llmStream funnel
 * through here, a Standard user gets consistent simplification across EVERY
 * surface that threads its mode (§A16). A surface that doesn't thread it stays
 * Expert-verbose — the honest bound of this approach, tracked per-surface in
 * Phase 2's threading pass.
 */
function withModeDirective(args: LlmCallArgs): LlmCallArgs {
  // shapeSystemPrompt applies the JSON-safety guard (§A14): a JSON call is
  // returned unchanged so the Standard directive can't corrupt the parse.
  const shaped = shapeSystemPrompt(args.systemPrompt, args.experienceMode, {
    expectJson: args.expectJson,
  });
  if (shaped === args.systemPrompt) return args;
  return { ...args, systemPrompt: shaped };
}

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
 * Per TT.md A21 audit (2026-06-18) MED finding — until this fix, an
 * invalid (typo'd, revoked, expired) LLM key for the SELECTED provider
 * threw immediately with kind:"auth" and the call died. The intent of
 * having two providers was operator resilience — one going down
 * should fall over to the other. Now: if the chosen provider throws an
 * auth-class error AND the other provider is enabled, cascade once.
 *
 * Failure kinds that DO cascade:
 *   - "auth"       (key rejected by provider — try the other)
 *   - "quota"      (account-level payment block — try the other)
 *
 * Failure kinds that do NOT cascade (retrying the other provider would
 * make the same call and produce the same kind of failure):
 *   - "invalid_request" (the prompt itself is bad)
 *   - "rate_limit"      (handled at the call-site with backoff)
 *   - "timeout" / "network" / "server" (retry semantics owned by caller)
 */
function otherProvider(selected: Provider): Provider | null {
  if (selected.name === deepseekProvider.name) {
    return anthropicProvider.enabled() ? anthropicProvider : null;
  }
  if (selected.name === anthropicProvider.name) {
    return deepseekProvider.enabled() ? deepseekProvider : null;
  }
  return null;
}

// Exported for unit testing — the cascade DECISION is the load-bearing part:
// failover must happen on operator-fixable failures (auth/quota) and must NOT
// happen on request-level ones (invalid_request/rate_limit/…), which would just
// re-run the same doomed call against the other provider.
export function shouldCascade(err: unknown): boolean {
  return (
    err instanceof LlmError && (err.kind === "auth" || err.kind === "quota")
  );
}

/**
 * Single entry point for every LLM call in the codebase. Companies that have not
 * yet passed the Month-1 control window (§3.4) — or have ai_guidance_enabled=false
 * — will have their calls *short-circuited* at the brain layer, not here. This
 * function is the dumb pipe; the brain decides whether the pipe is allowed to run.
 */
export async function llmCall(args: LlmCallArgs): Promise<LlmResult> {
  const provider = chooseProvider();
  const shaped = withModeDirective(args);
  try {
    return await provider.call(shaped);
  } catch (err) {
    if (shouldCascade(err)) {
      const fallback = otherProvider(provider);
      if (fallback) {
        // eslint-disable-next-line no-console
        console.warn(
          `[llm] primary provider ${provider.name} failed (${(err as LlmError).kind}); cascading to ${fallback.name}.`
        );
        return await fallback.call(shaped);
      }
    }
    throw err;
  }
}

/**
 * Streaming variant. Yields text deltas as they arrive. Falls back to the
 * non-streaming `call` and yields once at the end if the provider doesn't
 * support streaming. Cascade semantics match llmCall — if the primary
 * provider auth-fails before any tokens stream, cascade to the other.
 */
export async function* llmStream(args: LlmCallArgs): AsyncIterable<string> {
  const provider = chooseProvider();
  const shaped = withModeDirective(args);
  try {
    if (provider.stream) {
      yield* provider.stream(shaped);
      return;
    }
    const r = await provider.call(shaped);
    yield r.text;
  } catch (err) {
    if (shouldCascade(err)) {
      const fallback = otherProvider(provider);
      if (fallback) {
        // eslint-disable-next-line no-console
        console.warn(
          `[llm] primary stream ${provider.name} failed (${(err as LlmError).kind}); cascading to ${fallback.name}.`
        );
        if (fallback.stream) {
          yield* fallback.stream(shaped);
          return;
        }
        const r = await fallback.call(shaped);
        yield r.text;
        return;
      }
    }
    throw err;
  }
}
