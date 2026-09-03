/**
 * LLM provider abstraction (AMD-003).
 *
 * Every LLM call in this codebase goes through `llm.call()` which routes to one of
 * the providers declared here. The active provider is selected by env config; the
 * default is DeepSeek.
 *
 * Adding a provider:
 *   1. Implement the Provider interface in a new file.
 *   2. Register it in `chooseProvider()` in index.ts.
 *   3. Add the corresponding env vars to .env.example.
 */

export type LlmMessage = { role: "user" | "assistant"; content: string };

export type LlmCallArgs = {
  /** The hard-coded constitutional/feature-specific instructions. */
  systemPrompt: string;
  messages: LlmMessage[];
  maxTokens?: number;
  /** Pass true when the caller wants raw text rather than parsed JSON. */
  expectJson?: boolean;
  /**
   * Per-call model override for the SELECTED provider (else the provider's env/default model). Provider-specific
   * — a provider ignores a model id that isn't its own (Anthropic keeps ANTHROPIC_MODEL). Used to route an
   * EXTRACTION task off the DeepSeek REASONING model (deepseek-v4-flash) onto the non-reasoning deepseek-chat: a
   * long transcript makes the reasoning model spend the entire completion budget on reasoning_content and emit
   * ZERO answer (measured: a 41-min meeting → 8000 reasoning tokens, 0 answer → empty → the dissect's "transient"
   * empty). A non-reasoning model answers directly and handles the full transcript. See DEEPSEEK_NONREASONING_MODEL.
   */
  model?: string;
  /**
   * The acting user's Experience Mode (0110). When 'standard', llmCall/llmStream
   * append modeDirective() to the system prompt centrally, so EVERY AI surface
   * simplifies consistently (§A16). Omitted / 'expert' → no change (today's
   * behavior). This is the single point where the Standard/Expert dial reshapes
   * AI output; callers thread the user's mode in rather than editing prompts.
   */
  experienceMode?: import("../experience/mode").ExperienceMode;
};

/**
 * Token usage reported by the provider. All fields optional — Anthropic
 * and DeepSeek both surface this, but providers we add later may not.
 * Capturing this is the foundation for the §3.5 consequence measurement
 * (what did a guidance cycle actually cost), so we lift it into the
 * shared type rather than hiding it in provider-internal logs.
 */
export type LlmUsage = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};

export type LlmResult = {
  text: string;
  /** Provider-specific model id used, for the audit trail. */
  model: string;
  /** Provider name, e.g. 'deepseek' | 'anthropic'. */
  provider: string;
  /** Token usage when the provider reports it. */
  usage?: LlmUsage;
  /** Wall-clock latency from request send to last byte, in ms. */
  latencyMs?: number;
};

export interface Provider {
  name: string;
  /** Returns true if env config allows this provider to be used. */
  enabled(): boolean;
  /** Default model id for this provider. */
  defaultModel(): string;
  call(args: LlmCallArgs): Promise<LlmResult>;
  /**
   * Optional streaming variant. Returns an async iterable of text deltas.
   * Providers that don't implement it fall back to call() and yield once
   * at the end (the consumer code becomes provider-agnostic).
   */
  stream?(args: LlmCallArgs): AsyncIterable<string>;
}
