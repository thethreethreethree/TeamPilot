import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { LlmAttribution, LlmResult } from "./types";

/**
 * The AI cost ledger's writer: one `ai_usage` row per model call (migration 0272; RSS Phase 0 step 6;
 * Gong F28.7).
 *
 * WHY HERE. Every model call in the codebase goes through llmCall (src/lib/llm/index.ts), including the
 * brain and claude.ts wrappers, and the providers already return token counts (deepseek.ts maps
 * prompt_tokens/completion_tokens) that nothing saved. Recording at the chokepoint covers every engine at
 * once; attribution (engine, company, session) is whatever the caller passed down.
 *
 * NEVER AFFECTS THE CALL. The answer is already in hand when this runs. A ledger failure is logged, never
 * thrown, and never delays more than one insert. Before 0272 is applied the table does not exist: that is
 * logged once per process, not once per call.
 *
 * NO USAGE, NO ROW. If a provider reports no token counts, writing zeros would record the call as free —
 * the "missing shown as zero" this ledger exists to prevent. The call is logged as unmetered instead.
 *
 * Streaming calls (llmStream) are recorded too, from the usage each provider reports when its stream ends
 * (DeepSeek: stream_options.include_usage; Anthropic: message_start / message_delta). Speech-to-text audio seconds
 * are recorded by recordSttUsage (below), from the batch transcription's own measured length.
 */

const MISSING_TABLE = new Set(["PGRST205", "42P01"]);
let warnedMissingTable = false;

export async function recordAiUsage(result: LlmResult, attribution?: LlmAttribution): Promise<void> {
  try {
    const u = result.usage;
    if (!u || (u.promptTokens === undefined && u.completionTokens === undefined)) {
      console.warn(
        `[ai-usage] provider reported no token usage (provider=${result.provider}, model=${result.model}, engine=${attribution?.engine ?? "unattributed"}) — call not metered.`
      );
      return;
    }
    const { error } = await createAdminClient()
      .from("ai_usage")
      .insert({
        company_id: attribution?.companyId ?? null,
        session_id: attribution?.sessionId ?? null,
        engine: attribution?.engine ?? "unattributed",
        provider: result.provider,
        model: result.model,
        input_tokens: Math.max(0, Math.round(u.promptTokens ?? 0)),
        output_tokens: Math.max(0, Math.round(u.completionTokens ?? 0)),
      });
    if (error) {
      if (MISSING_TABLE.has(String(error.code))) {
        if (!warnedMissingTable) {
          warnedMissingTable = true;
          console.error("[ai-usage] ai_usage table missing — AI cost is not being recorded until migration 0272 is applied.");
        }
        return;
      }
      console.error(`[ai-usage] insert failed (engine=${attribution?.engine ?? "unattributed"}): ${error.message}`);
    }
  } catch (err) {
    console.error("[ai-usage] ledger write threw:", err);
  }
}

/** Test hook: forget the once-per-process missing-table warning. */
export function _resetUsageLedgerWarnings(): void {
  warnedMissingTable = false;
}

/**
 * Speech-to-text audio for the ledger (ai_usage.audio_seconds, 0272): one row per batch transcription, with the audio
 * length the transcription itself measured. Same rules as recordAiUsage: never throws, never delays the caller, and no
 * row when there is nothing real to record (zero seconds would read as a free call).
 */
export async function recordSttUsage(args: {
  provider: string;
  model: string;
  audioSeconds: number;
  attribution: LlmAttribution;
}): Promise<void> {
  try {
    if (!(args.audioSeconds > 0)) {
      console.warn(`[ai-usage] transcription reported no audio length (engine=${args.attribution.engine}) — not metered.`);
      return;
    }
    const { error } = await createAdminClient().from("ai_usage").insert({
      company_id: args.attribution.companyId ?? null,
      session_id: args.attribution.sessionId ?? null,
      engine: args.attribution.engine,
      provider: args.provider,
      model: args.model,
      input_tokens: 0,
      output_tokens: 0,
      audio_seconds: Math.round(args.audioSeconds * 10) / 10,
    });
    if (error && !MISSING_TABLE.has(String(error.code))) console.error(`[ai-usage] stt row failed: ${error.message}`);
  } catch (err) {
    console.error("[ai-usage] recordSttUsage threw:", err);
  }
}
