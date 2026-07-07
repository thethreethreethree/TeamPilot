/**
 * Shared, framework-agnostic constants for Dissect a Conversation.
 *
 * Lives outside the `server-only` engine so BOTH the server (engine + routes) and
 * the client page reference the SAME value (§A13 — a finite limit authored once,
 * consumed by reference, never duplicated per-site).
 */

/**
 * How much pasted conversation the feature accepts, analyzes, grounds the coach
 * on, and stores — a single window so accept = analyze = ground, with no silent
 * truncation drift. ~16k chars ≈ ~4k tokens of model input.
 */
export const MAX_SOURCE_CHARS = 16000;
