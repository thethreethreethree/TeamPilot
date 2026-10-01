import "server-only";
import type { LlmError, LlmErrorKind } from "./errors";

/**
 * What a signed-in user may read when an AI call fails. The ONLY text an AI route sends in `error:` for an
 * LlmError (founder, picker 2026-09-30: "Our own sentence, detail in logs").
 *
 * WHY. `LlmError.message` is built in the provider layer as `DeepSeek API error ${status}: ${rawBody}` (or
 * "DEEPSEEK_API_KEY not set."), and ~26 routes returned it as-is. That was a deliberate 07-25 choice for
 * authenticated users. During the September out-of-credit outage it meant every AI feature showed
 * `DeepSeek API error 402: {"error":{"message":"Insufficient Balance",...}}`. The founder reversed it.
 *
 * `kind` still goes to the client, so it can back off, retry, or explain (the Settings connection panel
 * hints from `kind`). The raw reply is logged here, and Sentry keeps the exception, so nothing is lost to the
 * people who debug it. It just stops reaching the screen.
 */
const SENTENCE: Record<LlmErrorKind, string> = {
  timeout: "The AI took too long to respond. Please try again.",
  rate_limit: "The AI is busy right now. Please wait a moment and try again.",
  quota: "The AI service is unavailable on our side right now. Please try again later.",
  auth: "The AI service is unavailable on our side right now. Please try again later.",
  model_unavailable: "The AI service is unavailable on our side right now. Please try again later.",
  server: "The AI service couldn't be reached. Please try again in a moment.",
  network: "The AI service couldn't be reached. Please try again in a moment.",
  invalid_request: "The AI couldn't process this request. Please try again, and tell us if it keeps happening.",
  unknown: "Something went wrong with the AI on our side. Please try again.",
};

export function llmPublicMessage(err: LlmError): string {
  // eslint-disable-next-line no-console
  console.error(`[llm] ${err.provider} ${err.kind}${err.status ? ` ${err.status}` : ""}: ${err.message}`);
  return SENTENCE[err.kind] ?? SENTENCE.unknown;
}

/** Exported for tests: every kind has a sentence and none names a provider. */
export const LLM_PUBLIC_SENTENCES: Readonly<Record<LlmErrorKind, string>> = SENTENCE;
