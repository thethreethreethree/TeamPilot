import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Experience Mode — the single source of truth for the per-user complexity dial
 * (migration 0110). A13 (vocabulary-once): the mode literal, the default, the
 * prompt directive, and the server-side reader all live HERE so "standard" /
 * "expert" is defined exactly once and every surface imports it. No "use client"
 * — this module is server-safe (the client provider imports the TYPE from here).
 *
 * - 'standard': the simplified experience. AI outputs lead with the answer/action
 *   in plain language; advanced UI collapses. Default for new users.
 * - 'expert':   today's full system, unchanged.
 */
export type ExperienceMode = "standard" | "expert";

export const EXPERIENCE_MODES = ["standard", "expert"] as const;

/** The safe default when a user's preference is unknown/unreadable: never
 *  over-serve complexity to someone we can't identify. */
export const DEFAULT_EXPERIENCE_MODE: ExperienceMode = "standard";

export function isExperienceMode(v: unknown): v is ExperienceMode {
  return v === "standard" || v === "expert";
}

/**
 * The prompt directive appended to an LLM system prompt to shape its output for
 * the reader's mode. Expert returns "" (no change — today's behavior is the
 * baseline every prompt already encodes). Standard instructs the model to lead
 * with the answer/action and keep the "why" minimal — the founder's confirmed
 * "mostly just the answer/action" choice (2026-07-09).
 *
 * Guardrails baked in (§3.4 honesty-is-the-moat; A17): Standard changes
 * PRESENTATION and LENGTH, never correctness or safety. It does not fabricate
 * confidence or omit a material caveat — it just says less. The teaching the
 * founder chose to de-emphasize is not deleted: the UI keeps a one-click "show
 * full reasoning" (the A17 safety valve), which is a separate UI concern.
 *
 * A16 (compose-not-contradict): EVERY AI surface pulls its Standard shaping from
 * THIS one string, so the whole system simplifies consistently rather than one
 * surface being terse while another stays verbose.
 */
export function modeDirective(mode: ExperienceMode): string {
  if (mode === "expert") return "";
  return [
    "",
    "OUTPUT MODE: STANDARD.",
    "The reader has chosen a simplified experience because the full system overwhelms them.",
    "Rewrite your output to minimize cognitive load:",
    "- Lead with the single most important takeaway or the concrete next action, stated plainly.",
    "- Be brief: at most 2–3 short sentences. No preamble, no multi-section breakdown, no headers.",
    "- Plain language only. No jargon, no methodology labels, no citations unless the reader asks.",
    "- Give the answer/action first; keep any 'why' to at most one short clause.",
    "- CRITICAL: simplify PRESENTATION only. Never omit a material caveat, soften a real risk into",
    "  a falsehood, or state more confidence than the evidence supports. Simpler, not less honest.",
  ].join("\n");
}

/**
 * Apply a user's mode to a system prompt. The pure transform behind the central
 * llmCall/llmStream injection (0110 Phase 2) — kept here (not in the llm module)
 * so it's co-located with modeDirective and unit-testable without mocking any
 * provider. Expert / undefined → returned unchanged (directive is "").
 *
 * JSON-safety (§A14): the Standard directive tells the model to drop structure
 * and answer in 2–3 plain sentences — SAFE for prose, but it would corrupt an
 * expectJson call (the model returns prose, JSON.parse throws downstream). So a
 * JSON call is returned UNCHANGED; JSON surfaces (coach analysis, dissect,
 * review) simplify via per-FIELD prompt changes instead, handled per-surface.
 */
export function shapeSystemPrompt(
  systemPrompt: string,
  mode: ExperienceMode | undefined,
  opts?: { expectJson?: boolean }
): string {
  if (opts?.expectJson) return systemPrompt;
  return systemPrompt + modeDirective(mode ?? "expert");
}

/**
 * Server-side read of a user's Experience Mode from their profile. Prompt
 * builders call this with the acting user's id + a supabase client. Fails safe
 * to the default (standard) on any error/missing row — the same posture as the
 * GET route. Note: the profiles column is 'expert' for pre-0110 users (backfill)
 * and 'standard' for new users.
 */
export async function getExperienceMode(
  sb: SupabaseClient,
  userId: string
): Promise<ExperienceMode> {
  try {
    const { data, error } = await sb
      .from("profiles")
      .select("experience_mode")
      .eq("id", userId)
      .maybeSingle();
    if (error) return DEFAULT_EXPERIENCE_MODE;
    return data?.experience_mode === "expert" ? "expert" : "standard";
  } catch {
    return DEFAULT_EXPERIENCE_MODE;
  }
}
