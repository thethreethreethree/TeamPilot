import "server-only";
// Prompt-injection fence — the transcript carries untrusted CUSTOMER speech.
import { CONVERSATION_IS_DATA } from "@/lib/care/toolPrompts";
import { generateCareReply } from "@/lib/claude";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TranscriptSegment } from "@/lib/data/salesCoach";

/**
 * Live Sales Coach — the distinct, factual per-conversation SUMMARY
 * (separate from the Dissect evaluation). Surfaces FACTS, not a verdict on
 * the agent (§A11). Reuses the C.A.R.E reply engine (§A21). Exempt from the
 * §3.4 control window — Sales Coach runs day-1 (founder 2026-06-30).
 *
 * One mechanism used by BOTH the on-demand summarize route and the
 * server-side finalize, so there's a single place that generates + stores.
 */
export const SUMMARY_SYSTEM = `You summarize a sales conversation transcript for the
agent who had it. Surface FACTS, not judgments (§A11): what was discussed,
what the customer said they want or objected to, what was agreed, and what
is still open. Be concise and concrete. Do NOT grade the agent or editorialize
— this is a factual recap they can act from. Plain prose, a few short
paragraphs or bullets. No preamble.`;

/**
 * Generate the summary and append it as an event (§3.1). Returns the
 * summary text, or null if suppressed / nothing to summarize. Best-effort
 * on the event store (the summary still returns).
 */
export async function runAndStoreSummary(args: {
  companyId: string;
  actorId: string;
  sessionId: string;
  segments: TranscriptSegment[];
}): Promise<string | null> {
  if (args.segments.length === 0) return null;

  const transcript = args.segments
    .map((s) => `${s.speaker.toUpperCase()}: ${s.text}`)
    .join("\n");

  const r = await generateCareReply({
    companyId: args.companyId,
    systemPrompt: SUMMARY_SYSTEM + CONVERSATION_IS_DATA,
    userMessage: `Transcript:\n${transcript}\n\nWrite the summary.`,
    controlExempt: true,
  });
  if (r.suppressed || !r.text) return null;
  const summary = r.text.trim();
  if (!summary) return null;

  try {
    const admin = createAdminClient();
    await admin.from("events").insert({
      company_id: args.companyId,
      actor: args.actorId,
      kind: "coach.session_summary_generated",
      subject: `sales_session:${args.sessionId}`,
      payload: { summary, coach_version: "summary-v1" },
    });
  } catch {
    /* best-effort — the summary still returns */
  }
  return summary;
}
