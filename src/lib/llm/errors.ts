import "server-only";

/**
 * Structured LLM error types. The provider layer (deepseek.ts, anthropic.ts)
 * throws one of these so callers can distinguish:
 *   - timeout vs auth vs rate-limit vs server-error vs network
 *
 * Previously every failure was a generic `Error` and the route layer returned a
 * generic 500 — the operator couldn't tell why a call failed. Audit Tier 2 #9.
 */

export type LlmErrorKind =
  | "timeout"
  | "rate_limit"
  | "auth"
  | "invalid_request"
  // The SELECTED provider rejected the configured MODEL (renamed, deprecated,
  // not-found) — distinct from a bad prompt. Same-provider retry is hopeless,
  // but the OTHER provider uses its own model, so this failover-cascades where
  // a generic invalid_request does not. Added 2026-07-25 after DeepSeek renamed
  // deepseek-chat → deepseek-v4-* and every AI tool went down at once with no
  // fallback (the 400 classified as invalid_request, which doesn't cascade).
  | "model_unavailable"
  | "server"
  | "network"
  | "quota" // 402 Payment Required / insufficient balance — non-retryable
  | "unknown";

export class LlmError extends Error {
  readonly kind: LlmErrorKind;
  readonly status?: number;
  readonly provider: string;
  readonly retryable: boolean;
  readonly rawBody?: string;

  constructor(args: {
    kind: LlmErrorKind;
    message: string;
    provider: string;
    status?: number;
    rawBody?: string;
    retryable?: boolean;
  }) {
    super(args.message);
    this.name = "LlmError";
    this.kind = args.kind;
    this.status = args.status;
    this.provider = args.provider;
    this.rawBody = args.rawBody;
    this.retryable =
      args.retryable ??
      (args.kind === "timeout" ||
        args.kind === "rate_limit" ||
        args.kind === "network" ||
        args.kind === "server");
  }
}

/** Classify an HTTP response status into an LlmErrorKind. */
export function classifyStatus(status: number): LlmErrorKind {
  if (status === 401 || status === 403) return "auth";
  // 402 from OpenAI-compatible APIs (DeepSeek) means insufficient balance
  // or account-level payment block. Distinct from auth — the key is fine,
  // the account just can't pay. Retrying won't help; tell the user clearly.
  if (status === 402) return "quota";
  if (status === 429) return "rate_limit";
  if (status === 400 || status === 422) return "invalid_request";
  if (status === 408 || status === 504) return "timeout";
  if (status >= 500) return "server";
  return "unknown";
}

/**
 * True when an error BODY indicates the provider rejected the MODEL itself
 * (renamed / deprecated / not-found) rather than the prompt. Kept deliberately
 * TIGHT so a normal bad-prompt 400 (which must NOT cascade — the other provider
 * would fail identically) is never misread as a model error.
 *
 * Real examples this must catch:
 *   DeepSeek: "supported API model names are deepseek-v4-pro or deepseek-v4-flash"
 *   OpenAI-compat: "The model `x` does not exist" / "model not found"
 *   Anthropic: "model: <name> not found" (404)
 */
export function isModelUnavailableBody(body: string | undefined | null): boolean {
  if (!body) return false;
  const b = body.toLowerCase();
  return (
    /supported\s+(api\s+)?model\s+names?/.test(b) ||
    /\bmodel\b[^.]{0,40}\b(not\s+found|does\s+not\s+exist|is\s+not\s+available|no\s+longer\s+available|unavailable|deprecated|is\s+invalid|not\s+supported|unsupported)\b/.test(
      b
    ) ||
    /\b(unknown|unsupported|invalid|deprecated)\s+model\b/.test(b)
  );
}

/**
 * Status + body classification. Only diverges from classifyStatus for the
 * model-rejection case: a 400/404/422 whose body names a MODEL problem becomes
 * "model_unavailable" (which failover-cascades) instead of "invalid_request"
 * (which doesn't). Everything else is unchanged.
 */
export function classifyStatusWithBody(
  status: number,
  body: string | undefined | null
): LlmErrorKind {
  const base = classifyStatus(status);
  if (
    (base === "invalid_request" || status === 404) &&
    isModelUnavailableBody(body)
  ) {
    return "model_unavailable";
  }
  // A bare 404 with no model signal is a routing/endpoint error, not auth/quota.
  if (status === 404 && base === "unknown") return "invalid_request";
  return base;
}
