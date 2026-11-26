import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { customBriefCoach } from "@/lib/claude";
import { CONVERSATION_IS_DATA } from "@/lib/care/toolPrompts";
import { audioBaseIso } from "@/lib/coach/v5/segmentTiming";
import { loadLines, numberedTranscript } from "./followThrough";
import { CUSTOM_BRIEF_SYSTEM, parseAnswers, questionsBlock, type Answer, type Section } from "./briefTemplates";

/**
 * Run a brief template on one call's CURRENT transcript and store the answers (0364). Once per (call, template,
 * transcript version): a stored run is returned as it is. The caller has already decided the person may open the call.
 * Returns the answers, "empty" (no usable transcript), "suppressed" (the AI is off for this account), or null (failed).
 */
export type RunResult = { answers: Answer[]; transcriptVersion: number; createdAt: string } | "empty" | "suppressed" | null;

export async function runBriefTemplate(
  admin: SupabaseClient,
  args: { companyId: string; userId: string; session: { id: string; companyId: string; agentId: string; startedAt: string; audioStartedAt: string | null }; template: { id: string; sections: Section[] } },
): Promise<RunResult> {
  const { session, template } = args;
  const loaded = await loadLines(admin, session.id, audioBaseIso(session.startedAt, session.audioStartedAt) ?? session.startedAt);
  if (!loaded || loaded.lines.length < 2) return "empty";
  const stored = async () => {
    const { data, error } = await admin
      .from("custom_briefs")
      .select("answers, transcript_version, created_at")
      .eq("company_id", session.companyId)
      .eq("session_id", session.id)
      .eq("template_id", template.id)
      .eq("transcript_version", loaded.version)
      .maybeSingle();
    if (error) return null;
    return data ? { answers: data.answers as Answer[], transcriptVersion: Number(data.transcript_version), createdAt: String(data.created_at) } : undefined;
  };
  const had = await stored();
  if (had === null) return null;
  if (had) return had;
  const r = await customBriefCoach({
    companyId: args.companyId,
    systemPrompt: CUSTOM_BRIEF_SYSTEM + CONVERSATION_IS_DATA,
    userMessage: `Questions:\n${questionsBlock(template.sections)}\n\nTranscript:\n${numberedTranscript(loaded.lines)}`,
    sessionId: session.id,
  });
  if (r.suppressed) return "suppressed";
  if (!r.text.trim()) return null;
  const atOf = new Map(loaded.lines.map((l) => [l.seq, l.atMs]));
  const parsed = parseAnswers(r.text, template.sections, loaded.lines);
  // A reply that isn't a usable answer list is a failure, not "nothing discussed": nothing is stored, so it can be run again.
  if (!parsed) return null;
  const answers = parsed.map((a) => ({ ...a, atMs: a.seqs.map((q) => atOf.get(q) ?? null) }));
  // A plain insert: the table has an UPDATE rule, so ON CONFLICT is refused; a concurrent run's row is read back.
  // Filed under the CALL's company (review 2026-11-26), so erasure — which matches the call's company — always finds it.
  const { error } = await admin.from("custom_briefs").insert({
    company_id: session.companyId,
    session_id: session.id,
    rep_id: session.agentId,
    template_id: template.id,
    transcript_version: loaded.version,
    answers,
    created_by: args.userId,
  });
  if (error && error.code !== "23505") {
    console.error(`[custom-brief] store failed session=${session.id}: ${error.message}`);
    return null;
  }
  const back = await stored();
  return back ?? null;
}
