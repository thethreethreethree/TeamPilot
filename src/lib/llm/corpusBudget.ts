/**
 * Shared knowledge-corpus budget — the SAME cap for the Sales Coach methodology corpus AND the C.A.R.E
 * per-tenant product context (founder 2026-08-13: "the same exact feature in both systems").
 *
 * Pure string function (no IO, no secrets) — deliberately NOT `server-only`, so the shared prompt builders
 * (methodologyBlock/reviewProductBlock and the prep builders) that may be transitively imported anywhere can
 * apply it without breaking a build.
 *
 * WHY a cap: both systems inject a per-tenant knowledge blob into an LLM SYSTEM PROMPT every call (Sales →
 * review/dissect; C.A.R.E → copilot/formulate/ask-coach). The active reasoning model (deepseek-v4-flash) spends
 * output tokens THINKING before it answers, and a larger prompt drives more reasoning. With the output clamp at
 * 8000 tokens (reasoning + answer), a big enough corpus starves the answer → a blank read / empty copilot (the
 * INV22 "error dressed as no-data" class this session chased to its root). The shipped 7000-token headroom fixed
 * the BUILT-IN corpora (~3.2–4.6k tokens, safe); this bounds a CUSTOM corpus so a company can't upload one large
 * enough to re-starve the model.
 *
 * The budget: ~24k chars ≈ ~6k tokens (English ~4 chars/token). Deliberately LARGER than both built-in KBs
 * (Sales ~4.6k tokens, C.A.R.E ELOSTATE ~3.2k tokens), so a custom corpus can be richer than the default, yet
 * safely under the level that starves the 8000-token output budget (worst-observed reasoning ~2.6k + answer
 * ~1.5k leaves generous margin at this size). Tunable — one constant, both systems.
 */
export const KNOWLEDGE_CORPUS_MAX_CHARS = 24_000;

export type CorpusCapResult = {
  /** The corpus to store / feed the LLM — truncated to the budget if it was over. */
  content: string;
  /** True when the input exceeded the budget and was truncated. */
  truncated: boolean;
  /** Original character count (before truncation) — for an honest "truncated from N" warning (§3.4). */
  originalChars: number;
};

/**
 * Cap a knowledge corpus to the shared budget. When over budget, truncate at a CLEAN boundary (paragraph, then
 * sentence, then line) near the cap so we never cut mid-word, and report that it was truncated so the caller can
 * warn the admin honestly. Idempotent and pure (no IO). WIRED at (2026-08-23): the Sales Coach corpus SAVE
 * routes (`/api/coach/sales-session/corpus` + `/product` — store capped, report truncation) AND, defensively
 * for corpora saved before this cap, the LOAD-side prompt chokepoints (`methodologyBlock`, `reviewProductBlock`,
 * `buildPrepSystemPrompt`, `buildQASystemPrompt`). The C.A.R.E product context is separately bounded at save by
 * a tighter `z.string().max(8000)` (≈2k tokens, already safe), so it does not route through this larger cap.
 */
export function capCorpus(content: string): CorpusCapResult {
  const originalChars = content.length;
  if (originalChars <= KNOWLEDGE_CORPUS_MAX_CHARS) {
    return { content, truncated: false, originalChars };
  }
  const slice = content.slice(0, KNOWLEDGE_CORPUS_MAX_CHARS);
  // Prefer the last paragraph break, then sentence, then line — but only if it's not so early that we'd drop a
  // large chunk of the allowed budget. Otherwise take the hard cap (never mid-word beyond this is acceptable —
  // the goal is a bounded, coherent-enough prompt, not perfect prose).
  const minKeep = Math.floor(KNOWLEDGE_CORPUS_MAX_CHARS * 0.85);
  const boundary = Math.max(
    slice.lastIndexOf("\n\n"),
    slice.lastIndexOf(". "),
    slice.lastIndexOf("\n")
  );
  const cut = boundary >= minKeep ? boundary : KNOWLEDGE_CORPUS_MAX_CHARS;
  return { content: content.slice(0, cut).trim(), truncated: true, originalChars };
}
