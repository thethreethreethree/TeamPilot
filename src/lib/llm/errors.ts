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
