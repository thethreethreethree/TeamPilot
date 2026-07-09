import "server-only";

import { createClient } from "@/lib/supabase/server";
import { llmCall } from "@/lib/llm";
import { computeFrequentSignalKinds } from "./frequentSignals";

/**
 * Brain learning cycle (§3.6, §4).
 *
 * Distills the recent chain activity into structured brain updates. Only sources
 * that have *measured consequence* count toward "validated" learning:
 *
 *   - held_resolutions: resolutions where durability='held' → validated_methods
 *   - reopened_resolutions: resolutions where durability='reopened' → what did NOT
 *     hold, per §1.1 ("errors, abandoned approaches, dead ends are assets equal to
 *     successes"). Feeds disabled_suggestions / known_patterns.
 *   - partial_resolutions: resolutions where durability='partial' → refine-not-adopt
 *     (§1.1 / §A26 — partial is the third MEASURED consequence; only 'unknown' is not).
 *   - dismissed_problems: problems explicitly dismissed → disabled_suggestions
 *   - frequent signals: patterns appearing repeatedly → known_patterns (low confidence)
 *
 * Per AMD-003 risk-flag: this distillation MUST NOT update from acceptance alone
 * (rejected resolutions, accepted dialogues without held outcomes). Acceptance is
 * not consequence (§3.5). The learning cycle is the structural guard.
 *
 * NOTE on reopened_resolutions vs the AMD-003 prohibition: a REOPENED resolution is
 * NOT acceptance-based learning. It is a resolution that was DECIDED, enacted, and
 * then MEASURED to have failed (the problem came back) — measured consequence, the
 * exact §3.5 basis the cycle is allowed to learn from, and the negative mirror of
 * held. Learning "action X did not hold for problem-kind Y" is consequence, not
 * agreement. The forbidden case is learning from a suggestion being accepted/rejected
 * WITHOUT a measured outcome; reopened has the measured outcome by definition.
 */

type LearningEvidence = {
  heldResolutions: Array<{
    id: string;
    problem_title: string | null;
    action_taken: string;
    reasoning: string;
    observed_outcome: string | null;
  }>;
  reopenedResolutions: Array<{
    id: string;
    problem_title: string | null;
    action_taken: string;
    reasoning: string;
    observed_outcome: string | null;
  }>;
  partialResolutions: Array<{
    id: string;
    problem_title: string | null;
    action_taken: string;
    reasoning: string;
    observed_outcome: string | null;
  }>;
  dismissedProblems: Array<{
    id: string;
    title: string;
    diagnosis: string | null;
    dismissal_reason: string | null;
  }>;
  frequentSignalKinds: Array<{ kind: string; count: number }>;
};

async function gatherEvidence(supabase: Awaited<ReturnType<typeof createClient>>): Promise<LearningEvidence> {
  // Pull last 90 days' worth — enough to see patterns, not so much that the
  // LLM token budget explodes.
  const since = new Date();
  since.setDate(since.getDate() - 90);
  const sinceIso = since.toISOString();

  const [heldRes, reopenedRes, partialRes, dismissedRes, signalsRes] = await Promise.all([
    supabase
      .from("resolutions")
      .select(
        "id, action_taken, reasoning, observed_outcome, problems(title)"
      )
      .eq("durability", "held")
      .gte("decided_at", sinceIso)
      .limit(20),
    // §1.1 mirror of held: resolutions that REOPENED — measured failures the
    // brain must learn from equally. Same shape/window as held.
    supabase
      .from("resolutions")
      .select(
        "id, action_taken, reasoning, observed_outcome, problems(title)"
      )
      .eq("durability", "reopened")
      .gte("decided_at", sinceIso)
      .limit(20),
    // §1.1 / §A26 boundary: PARTIAL is the third MEASURED consequence (only
    // 'unknown' is unmeasured). A method that partially held is neither a clean
    // success nor a clean failure — refine, don't fully trust or fully discard.
    supabase
      .from("resolutions")
      .select(
        "id, action_taken, reasoning, observed_outcome, problems(title)"
      )
      .eq("durability", "partial")
      .gte("decided_at", sinceIso)
      .limit(20),
    supabase
      .from("problems")
      .select("id, title, diagnosis, dismissal_reason")
      .eq("status", "dismissed")
      .gte("dismissed_at", sinceIso)
      .limit(20),
    supabase
      .from("signals")
      .select("kind")
      .gte("observed_at", sinceIso)
      .limit(500),
  ]);

  // §4 evidence gate — a signal kind counts as a "pattern" only at >= 5
  // observations (pure + tested in frequentSignals.ts).
  const frequentSignalKinds = computeFrequentSignalKinds(
    (signalsRes.data ?? []) as Array<{ kind: string }>
  );

  return {
    heldResolutions: (heldRes.data ?? []).map((r) => ({
      id: r.id,
      problem_title: (r.problems as { title?: string } | null)?.title ?? null,
      action_taken: r.action_taken,
      reasoning: r.reasoning,
      observed_outcome: r.observed_outcome,
    })),
    reopenedResolutions: (reopenedRes.data ?? []).map((r) => ({
      id: r.id,
      problem_title: (r.problems as { title?: string } | null)?.title ?? null,
      action_taken: r.action_taken,
      reasoning: r.reasoning,
      observed_outcome: r.observed_outcome,
    })),
    partialResolutions: (partialRes.data ?? []).map((r) => ({
      id: r.id,
      problem_title: (r.problems as { title?: string } | null)?.title ?? null,
      action_taken: r.action_taken,
      reasoning: r.reasoning,
      observed_outcome: r.observed_outcome,
    })),
    dismissedProblems: (dismissedRes.data ?? []).map((p) => ({
      id: p.id,
      title: p.title,
      diagnosis: p.diagnosis,
      dismissal_reason: p.dismissal_reason,
    })),
    frequentSignalKinds,
  };
}

const DISTILL_SYSTEM_PROMPT = `You are running the per-company brain learning cycle.

Your job is to distill recent VALIDATED activity into structured brain updates.
You are extremely conservative: anything not supported by held outcomes or explicit
dismissal reasons does NOT count as learning. Acceptance is not consequence (§3.5).

Inputs include:
  - heldResolutions: actions that produced outcomes confirmed to have held
  - reopenedResolutions: actions that were enacted and then MEASURED to have failed
    (the problem reopened). These are consequence, not acceptance — learn what did
    NOT hold from them, per §1.1 (dead ends are assets equal to successes). Route
    them into disabled_suggestions (do not repeat action X for problem-kind Y) and/or
    known_patterns (this class of fix tends to reopen). A held and a reopened
    resolution for the SAME action/problem-kind is a genuine tension — lower the
    confidence, do not silently prefer the success.
  - partialResolutions: actions MEASURED to have held only partially — neither clean
    success nor clean failure. Route into known_patterns as a refine-not-adopt signal
    ("action X partially resolves problem-kind Y; it needs augmentation"). Never
    promote a partial to a validated_method on its own.
  - dismissedProblems: problems explicitly rejected with reasons
  - frequentSignalKinds: observed-pattern frequency, NOT confirmed problems

For each learning, you must:
  - Cite the specific source ids
  - Set confidence honestly: 'high' only when multiple resolutions agree (held OR
    reopened); a held/reopened split on the same method is at most 'medium'
  - Refuse to invent learnings for the sake of looking active

Return strict JSON:
{
  "addendum_delta": "0-2 short sentences of additional context to inject into future system prompts, or empty string",
  "validated_methods": [{ "method": "...", "why": "...", "source_resolution_ids": [...] }],
  "disabled_suggestions": [{ "suggestion": "...", "reason": "...", "source_event_ids": [...] }],
  "known_patterns": [{ "claim": "...", "source_event_ids": [...], "confidence": "low|medium|high", "derived_from": "..." }],
  "summary": "one-line summary of what was learned this cycle, or 'no validated learnings this cycle'"
}

If the inputs are sparse or unvalidated, return mostly empty arrays. Empty is correct.`;

export async function runLearningCycle(_companyId: string): Promise<{
  ok: boolean;
  summary: string;
  evidence: LearningEvidence;
  rawResponse?: string;
  error?: string;
}> {
  const supabase = await createClient();
  const evidence = await gatherEvidence(supabase);

  // If nothing changed in the chain, don't burn an LLM call.
  if (
    evidence.heldResolutions.length === 0 &&
    evidence.reopenedResolutions.length === 0 &&
    evidence.partialResolutions.length === 0 &&
    evidence.dismissedProblems.length === 0 &&
    evidence.frequentSignalKinds.length === 0
  ) {
    return {
      ok: true,
      summary: "No new validated activity. Brain unchanged.",
      evidence,
    };
  }

  let raw: string;
  try {
    const r = await llmCall({
      systemPrompt: DISTILL_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Recent validated activity for this company:\n\n${JSON.stringify(evidence, null, 2)}`,
        },
      ],
      maxTokens: 1100,
      expectJson: true,
    });
    raw = r.text;
  } catch (err) {
    return {
      ok: false,
      summary: "Learning cycle failed to call LLM provider.",
      evidence,
      error: err instanceof Error ? err.message : "unknown",
    };
  }

  let parsed: {
    addendum_delta?: string;
    validated_methods?: Array<{
      method: string;
      why: string;
      source_resolution_ids?: string[];
    }>;
    disabled_suggestions?: Array<{
      suggestion: string;
      reason: string;
      source_event_ids?: string[];
    }>;
    known_patterns?: Array<{
      claim: string;
      source_event_ids?: string[];
      confidence?: string;
      derived_from?: string;
    }>;
    summary?: string;
  };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      ok: false,
      summary: "LLM returned unparseable response.",
      evidence,
      rawResponse: raw,
      error: "JSON parse failed",
    };
  }

  // Persist each piece through the audited record_brain_learning RPC.
  for (const m of parsed.validated_methods ?? []) {
    // §3.4 / integrity — JSON.parse is `any` at runtime despite the typed cast;
    // skip a malformed item (missing the method or its WHY) rather than write a
    // null-claim brain row or abort the whole cycle on an RPC constraint error.
    if (!m.method || !m.why) continue;
    await supabase.rpc("record_brain_learning", {
      p_kind: "method_validated",
      p_claim: m.method,
      p_reasoning: m.why,
      p_confidence: "high", // validated methods come only from held resolutions
      p_validated_method: {
        method: m.method,
        why: m.why,
        source_resolution_ids: m.source_resolution_ids ?? [],
        learned_at: new Date().toISOString(),
      },
      p_source_resolution_ids: m.source_resolution_ids ?? [],
    });
  }
  for (const d of parsed.disabled_suggestions ?? []) {
    if (!d.suggestion || !d.reason) continue; // skip malformed item (see above)
    await supabase.rpc("record_brain_learning", {
      p_kind: "suggestion_disabled",
      p_claim: `Disabled: ${d.suggestion}`,
      p_reasoning: d.reason,
      p_confidence: "high",
      p_disabled_suggestion: {
        suggestion: d.suggestion,
        reason: d.reason,
        source_event_ids: d.source_event_ids ?? [],
        learned_at: new Date().toISOString(),
      },
    });
  }
  for (const p of parsed.known_patterns ?? []) {
    if (!p.claim) continue; // skip malformed item (a pattern needs its claim)
    const conf =
      p.confidence === "high" || p.confidence === "medium" || p.confidence === "low"
        ? p.confidence
        : "low";
    await supabase.rpc("record_brain_learning", {
      p_kind: "pattern_learned",
      p_claim: p.claim,
      p_reasoning: `Distilled from ${p.derived_from ?? "recent chain activity"}.`,
      p_confidence: conf,
      p_known_pattern: {
        claim: p.claim,
        source_event_ids: p.source_event_ids ?? [],
        confidence: conf,
        derived_from: p.derived_from ?? "unspecified",
        learned_at: new Date().toISOString(),
      },
      p_source_event_ids: p.source_event_ids ?? [],
    });
  }

  // Optional addendum is appended via one final record_brain_learning call so
  // it lands in the audit trail with a reasoning entry.
  if (parsed.addendum_delta && parsed.addendum_delta.trim().length > 0) {
    await supabase.rpc("record_brain_learning", {
      p_kind: "style_calibrated",
      p_claim: "Addendum updated from recent activity",
      p_reasoning: parsed.summary ?? "Distilled by learning cycle",
      p_confidence: "medium",
      p_addendum_delta: parsed.addendum_delta,
    });
  }

  return {
    ok: true,
    summary: parsed.summary ?? "Learning cycle completed.",
    evidence,
    rawResponse: raw,
  };
}
// Silence unused-var warning for the companyId param — RLS scopes the data, but
// we accept it for clarity in callers.
void (async (id: string) => id);
