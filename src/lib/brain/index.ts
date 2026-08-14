import "server-only";

import { createClient } from "@/lib/supabase/server";
import { llmCall, llmStream, type LlmCallArgs, type LlmResult } from "@/lib/llm";
import type { ExperienceMode } from "@/lib/experience/mode";
import type {
  BrainRecord,
  BrainPattern,
  DisabledSuggestion,
  ValidatedMethod,
  ControlGate,
} from "./types";

export * from "./types";

/**
 * Per-company brain runtime (AMD-003).
 *
 * The brain layer wraps every LLM call so it is:
 *   1. Gated by the §3.4 Month-1 control window
 *   2. Composed with the per-company addendum (the System speaks as it has
 *      learned to speak to *this* team, not generically)
 *   3. Routed through the configured provider (DeepSeek primary)
 *
 * Application code calls `runBrainCall(...)` instead of `llmCall(...)` directly.
 * The thin `llmCall` is reserved for system-level utilities that legitimately
 * have no company context (e.g. the learning distillation cycle itself, when
 * configured to operate on aggregate data).
 */

/** Load the brain for a company. Throws if no row exists (should never happen
 *  because migration 0007 auto-creates one on company insert). */
export async function loadBrain(companyId: string): Promise<BrainRecord> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("company_brain")
    .select(
      "version, system_prompt_addendum, known_patterns, style_calibration, vocabulary, disabled_suggestions, validated_methods, last_learning_at, last_learning_summary, updated_at"
    )
    .eq("company_id", companyId)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new Error(
      `No brain row for company ${companyId}. Ensure the companies_create_brain trigger from migration 0007 is installed.`
    );
  }
  return {
    companyId,
    version: data.version,
    systemPromptAddendum: data.system_prompt_addendum ?? "",
    knownPatterns: (data.known_patterns ?? []) as BrainPattern[],
    styleCalibration:
      (data.style_calibration ?? {}) as Record<string, unknown>,
    vocabulary: (data.vocabulary ?? {}) as Record<string, unknown>,
    disabledSuggestions:
      (data.disabled_suggestions ?? []) as DisabledSuggestion[],
    validatedMethods:
      (data.validated_methods ?? []) as ValidatedMethod[],
    lastLearningAt: data.last_learning_at,
    lastLearningSummary: data.last_learning_summary,
    updatedAt: data.updated_at,
  };
}

/**
 * Pure §3.4 boundary decision, extracted so the month-1 → month-2 gate can be
 * unit-tested without a DB. Guidance is enabled when EITHER the company was
 * manually unlocked OR the auto-unlock time has elapsed. Fail-closed: a null or
 * malformed unlock_at yields autoUnlocked=false (NaN <= now is false), so a
 * misconfigured company stays in the honest-baseline control window rather than
 * silently turning guidance on (§3.4 — the builder-under-pressure default must
 * be "suppressed," never "enabled").
 */
export function evaluateControlGate(params: {
  manualEnabled: boolean;
  unlockAt: string | null;
  now: number;
}): { guidanceEnabled: boolean; autoUnlocked: boolean } {
  const autoUnlocked =
    Boolean(params.unlockAt) &&
    new Date(params.unlockAt as string).getTime() <= params.now;
  return {
    guidanceEnabled: params.manualEnabled || autoUnlocked,
    autoUnlocked,
  };
}

/** Load the §3.4 control gate for a company. */
export async function loadControlGate(companyId: string): Promise<ControlGate> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("companies")
    .select(
      "ai_guidance_enabled, ai_guidance_enabled_at, ai_guidance_unlock_at"
    )
    .eq("id", companyId)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new Error(`Company ${companyId} not found.`);
  }
  const { guidanceEnabled: enabled } = evaluateControlGate({
    manualEnabled: Boolean(data.ai_guidance_enabled),
    unlockAt: data.ai_guidance_unlock_at,
    now: Date.now(),
  });

  return {
    guidanceEnabled: enabled,
    guidanceEnabledAt: data.ai_guidance_enabled_at,
    guidanceUnlockAt: data.ai_guidance_unlock_at,
    reason: enabled
      ? undefined
      : data.ai_guidance_unlock_at
      ? `AI guidance is in its first-month baseline and unlocks ${data.ai_guidance_unlock_at}. Manually unlock if you need it sooner.`
      : "AI guidance not yet enabled for this company.",
  };
}

/**
 * Manually flip the control gate. Recorded in brain_evolution_events because
 * unlocking early is itself a learning event — the user is overriding the
 * §3.4 control window with an explicit acknowledgement.
 */
export async function unlockControlGate(args: {
  companyId: string;
  reason: string;
}): Promise<void> {
  const supabase = await createClient();
  const { error: updateErr } = await supabase
    .from("companies")
    .update({
      ai_guidance_enabled: true,
      ai_guidance_enabled_at: new Date().toISOString(),
    })
    .eq("id", args.companyId);
  if (updateErr) throw updateErr;

  // Record in the brain audit trail. This is an §3.4 override; the reason is
  // preserved so §7.5 distrust-of-evolution can review whether early unlocks
  // produced worse outcomes than the control window held.
  const { error: rpcErr } = await supabase.rpc("record_brain_learning", {
    p_kind: "control_unlock",
    p_claim: "AI guidance unlocked manually (§3.4 control window overridden)",
    p_reasoning: args.reason,
    p_confidence: "low",
    p_addendum_delta: "",
  });
  if (rpcErr) throw rpcErr;
}

/**
 * Compose the per-company addendum into a system prompt.
 *
 * Audit Tier 2 #14: every section is now capped so a long-running company can't
 * blow past LLM token budgets. The cap order respects priority:
 *
 *   1. Discipline reminder (always — never truncated)
 *   2. Validated methods (last 20)         — has held outcomes, highest signal
 *   3. Disabled suggestions (last 20)      — has dismissal reasons, high signal
 *   4. Known patterns (last 20)
 *   5. Free-form addendum (last 4000 chars) — lowest signal-per-token
 *
 * When the brain has more than 20 entries in a category, the MOST RECENT entries
 * are kept (those are the ones the learning cycle most recently distilled).
 *
 * Constants chosen by token math: 20 short bullets ≈ 1000 tokens, 4000 chars
 * of addendum ≈ 1000 tokens, plus discipline reminder + base prompt ≈ 8K total
 * worst case. That fits in every modern provider's context window with budget
 * to spare for the actual user message + response.
 */

const MAX_VALIDATED_METHODS = 20;
const MAX_DISABLED_SUGGESTIONS = 20;
const MAX_KNOWN_PATTERNS = 20;
const MAX_ADDENDUM_CHARS = 4000;

export function composeSystemPrompt(
  basePrompt: string,
  brain: BrainRecord
): string {
  const parts: string[] = [basePrompt.trim()];

  // Most recent first across all categories (assumed pre-sorted by learning
  // cycle insert order; slicing from the end gives latest entries).
  const recentValidated = brain.validatedMethods.slice(-MAX_VALIDATED_METHODS);
  const recentDisabled = brain.disabledSuggestions.slice(-MAX_DISABLED_SUGGESTIONS);
  const recentPatterns = brain.knownPatterns.slice(-MAX_KNOWN_PATTERNS);
  const truncatedAddendum = truncateAddendum(
    brain.systemPromptAddendum.trim(),
    MAX_ADDENDUM_CHARS
  );

  if (truncatedAddendum.length > 0) {
    parts.push(
      "--- Per-company context (you have learned about this team) ---",
      truncatedAddendum
    );
  }

  if (recentDisabled.length > 0) {
    parts.push(
      `--- Disabled suggestions (do not propose these for this team; showing ${recentDisabled.length} of ${brain.disabledSuggestions.length}) ---`,
      recentDisabled
        .map((d) => `- ${d.suggestion} — because: ${d.reason}`)
        .join("\n")
    );
  }

  if (recentValidated.length > 0) {
    parts.push(
      `--- Validated methods (have produced held outcomes here; showing ${recentValidated.length} of ${brain.validatedMethods.length}) ---`,
      recentValidated.map((m) => `- ${m.method} — why: ${m.why}`).join("\n")
    );
  }

  if (recentPatterns.length > 0) {
    parts.push(
      `--- Known patterns observed on this team (showing ${recentPatterns.length} of ${brain.knownPatterns.length}) ---`,
      recentPatterns
        .map(
          (p) =>
            `- (${p.confidence}, from ${p.derived_from}) ${p.claim}`
        )
        .join("\n")
    );
  }

  // §1.3 reminder — the brain biases style, not which assumptions to challenge.
  // This line prevents the brain from becoming an echo chamber over time.
  // Never truncated.
  parts.push(
    "--- Discipline reminder ---",
    "The above is style and accumulated context. Outside-view generation, ripple-tracing, and refusal to assert before the user states their read are NOT overridden by this context. The discipline (§3.2 Understanding Gate, §3.3 Guide-Don't-Overtake) applies to every response."
  );

  return parts.join("\n\n");
}

/** Truncate addendum at the last paragraph break before the cap, so we never
 *  cut mid-sentence. If no paragraph break exists below the cap, fall back to
 *  a hard slice with an explicit `[truncated]` marker. */
function truncateAddendum(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const cutAt = text.lastIndexOf("\n\n", maxChars);
  if (cutAt > maxChars * 0.5) {
    return text.slice(0, cutAt) + "\n\n[earlier context truncated]";
  }
  return text.slice(0, maxChars) + " [truncated]";
}

/**
 * The single entry point for company-aware LLM calls. Routes:
 *   1. Loads the brain
 *   2. Loads the control gate
 *   3. If guidance is suppressed (Month 1), returns a refusal Result (no API call)
 *   4. Otherwise composes the system prompt with the brain and calls the provider
 */
export async function runBrainCall(args: {
  companyId: string;
  /** The caller's task-specific system prompt. */
  basePrompt: string;
  messages: LlmCallArgs["messages"];
  maxTokens?: number;
  expectJson?: boolean;
  /**
   * Exempt this call from the §3.4 month-1 control window. The control window
   * governs the Elostate DIAGNOSTIC system that LEARNS a team over a month;
   * methodology-corpus COACHING (not a learned baseline) runs from day 1
   * (founder decision 2026-06-30). Still composes with the brain — it skips
   * only the suppression, not the composer.
   *
   * WHO SETS IT (accurate map — a route living under /api/care/ can legitimately
   * set it, so don't judge by URL prefix):
   *   - SET: day-1 coaching surfaces that pass companyId to compose company
   *     context — the Sales Coach (liveSalesCue/dissect/ask-coach/summary) AND
   *     the C.A.R.E *agent-coaching* dissect surfaces (dissect/ask, ask-coach).
   *   - DO NOT SET: Elostate diagnostic callers (chat/guide, briefing, …) — they
   *     ARE the gated system.
   *   - MOOT: C.A.R.E *customer-facing* replies (widget messages, inbound email)
   *     pass NO companyId, so the gate never runs for them — the flag is
   *     irrelevant there; leave it unset.
   */
  controlExempt?: boolean;
  /** The acting user's Experience Mode (0110). Forwarded to llmCall so the
   *  brain-routed AI simplifies for Standard users (§A16). */
  experienceMode?: ExperienceMode;
}): Promise<LlmResult & { gate: ControlGate; brainVersion: number; suppressed: boolean }> {
  const [brain, gate] = await Promise.all([
    loadBrain(args.companyId),
    loadControlGate(args.companyId),
  ]);

  // The §3.4 suppression DECISION is computed here, once, and returned as an explicit `suppressed` verdict
  // (CLAUDE.md §2.2 / AMD-010). Consumers MUST branch on `r.suppressed` — never re-derive `!guidanceEnabled`
  // (± controlExempt) themselves, which is the drift that blanked every guidance-off account on 2026-08-14
  // (A40): the term lived in two places and one copy dropped it.
  if (!gate.guidanceEnabled && !args.controlExempt) {
    // §3.4 honesty: the System refuses to speak during the control window.
    // The "response" is a placeholder that surfaces honestly upstream.
    return {
      text: "",
      model: "(suppressed)",
      provider: "(suppressed)",
      gate,
      brainVersion: brain.version,
      suppressed: true,
    };
  }

  const composedPrompt = composeSystemPrompt(args.basePrompt, brain);
  const result = await llmCall({
    systemPrompt: composedPrompt,
    messages: args.messages,
    maxTokens: args.maxTokens,
    expectJson: args.expectJson,
    experienceMode: args.experienceMode,
  });

  return { ...result, gate, brainVersion: brain.version, suppressed: false };
}

/**
 * Streaming variant of runBrainCall. Same gate semantics: if guidance is
 * suppressed, yields a single empty string and returns. Otherwise yields the
 * provider's text deltas as they arrive.
 *
 * Returns a sentinel object on completion so callers know the final state of
 * the gate (suppressed/enabled) for honest UI rendering.
 */
export async function* runBrainStream(args: {
  companyId: string;
  basePrompt: string;
  messages: LlmCallArgs["messages"];
  maxTokens?: number;
  expectJson?: boolean;
  /** Exempt from the §3.4 month-1 control gate (mirrors runBrainCall). The Sales Coach extension sets this so
   *  its streaming Suggested Response runs day-1, exactly like the non-stream path and every other sales
   *  surface — the stream path had no way to express the exemption before, so a month-1 customer got an empty
   *  stream → error (review Finding, Area 3). Care/Elostate streaming callers leave it unset (stay gated). */
  controlExempt?: boolean;
  /** The acting user's Experience Mode (0110), forwarded to llmStream (§A16). */
  experienceMode?: ExperienceMode;
}): AsyncGenerator<string, { gate: ControlGate; brainVersion: number; suppressed: boolean }, void> {
  const [brain, gate] = await Promise.all([
    loadBrain(args.companyId),
    loadControlGate(args.companyId),
  ]);

  // Single-source §3.4 verdict, same as runBrainCall (CLAUDE.md §2.2 / AMD-010): the return carries
  // `suppressed`; stream consumers branch on it, never re-derive `!guidanceEnabled`.
  if (!gate.guidanceEnabled && !args.controlExempt) {
    return { gate, brainVersion: brain.version, suppressed: true };
  }

  const composedPrompt = composeSystemPrompt(args.basePrompt, brain);
  for await (const delta of llmStream({
    systemPrompt: composedPrompt,
    messages: args.messages,
    maxTokens: args.maxTokens,
    expectJson: args.expectJson,
    experienceMode: args.experienceMode,
  })) {
    yield delta;
  }
  return { gate, brainVersion: brain.version, suppressed: false };
}
