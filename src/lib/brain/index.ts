import "server-only";

import { createClient } from "@/lib/supabase/server";
import { llmCall, type LlmCallArgs, type LlmResult } from "@/lib/llm";
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
  const now = Date.now();
  const autoUnlocked =
    Boolean(data.ai_guidance_unlock_at) &&
    new Date(data.ai_guidance_unlock_at).getTime() <= now;

  const enabled = data.ai_guidance_enabled || autoUnlocked;

  return {
    guidanceEnabled: enabled,
    guidanceEnabledAt: data.ai_guidance_enabled_at,
    guidanceUnlockAt: data.ai_guidance_unlock_at,
    reason: enabled
      ? undefined
      : data.ai_guidance_unlock_at
      ? `§3.4 control window — AI guidance unlocks ${data.ai_guidance_unlock_at}. Manually unlock if you need it sooner.`
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
 * Structure:
 *   <base system prompt the caller provided>
 *
 *   --- Per-company context (you have learned about this team) ---
 *   <addendum>
 *
 *   --- Disabled suggestions (do not propose these) ---
 *   <list>
 *
 *   --- Validated methods (have produced held outcomes here) ---
 *   <list>
 */
export function composeSystemPrompt(
  basePrompt: string,
  brain: BrainRecord
): string {
  const parts: string[] = [basePrompt.trim()];

  if (brain.systemPromptAddendum.trim().length > 0) {
    parts.push(
      "--- Per-company context (you have learned about this team) ---",
      brain.systemPromptAddendum.trim()
    );
  }

  if (brain.disabledSuggestions.length > 0) {
    parts.push(
      "--- Disabled suggestions (do not propose these for this team) ---",
      brain.disabledSuggestions
        .map((d) => `- ${d.suggestion} — because: ${d.reason}`)
        .join("\n")
    );
  }

  if (brain.validatedMethods.length > 0) {
    parts.push(
      "--- Validated methods (have produced held outcomes here) ---",
      brain.validatedMethods.map((m) => `- ${m.method} — why: ${m.why}`).join("\n")
    );
  }

  if (brain.knownPatterns.length > 0) {
    parts.push(
      "--- Known patterns observed on this team ---",
      brain.knownPatterns
        .slice(0, 20) // keep prompt size sane
        .map(
          (p) =>
            `- (${p.confidence}, from ${p.derived_from}) ${p.claim}`
        )
        .join("\n")
    );
  }

  // §1.3 reminder — the brain biases style, not which assumptions to challenge.
  // This line prevents the brain from becoming an echo chamber over time.
  parts.push(
    "--- Discipline reminder ---",
    "The above is style and accumulated context. Outside-view generation, ripple-tracing, and refusal to assert before the user states their read are NOT overridden by this context. The discipline (CLAUDE.md §3.2, §3.3) applies to every response."
  );

  return parts.join("\n\n");
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
}): Promise<LlmResult & { gate: ControlGate; brainVersion: number }> {
  const [brain, gate] = await Promise.all([
    loadBrain(args.companyId),
    loadControlGate(args.companyId),
  ]);

  if (!gate.guidanceEnabled) {
    // §3.4 honesty: the System refuses to speak during the control window.
    // The "response" is a placeholder that surfaces honestly upstream.
    return {
      text: "",
      model: "(suppressed)",
      provider: "(suppressed)",
      gate,
      brainVersion: brain.version,
    };
  }

  const composedPrompt = composeSystemPrompt(args.basePrompt, brain);
  const result = await llmCall({
    systemPrompt: composedPrompt,
    messages: args.messages,
    maxTokens: args.maxTokens,
    expectJson: args.expectJson,
  });

  return { ...result, gate, brainVersion: brain.version };
}
