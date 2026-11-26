import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { dealBriefCoach } from "@/lib/claude";
import { CONVERSATION_IS_DATA } from "@/lib/care/toolPrompts";
import { numberedTranscript } from "../followThrough";
import { callsBlock, type CallLines } from "./playbook";
import { basisKey, DEAL_BRIEF_SYSTEM, parseDealBrief, type DealBriefBody } from "./dealBrief";

/**
 * Write (or return the stored) deal brief for these calls — the one place a deal brief is written (§2.2): the deal
 * panel's route and the agents both call it. `calls` must already be the calls the reader may see (the route reads them
 * through the caller's client; an agent through its owner's view). Once per basis; a point with no cited line is dropped.
 */
export type BriefRun = { brief: DealBriefBody; createdAt: string; stored: boolean } | "suppressed" | "unusable" | "failed";

export async function writeDealBrief(admin: SupabaseClient, args: { companyId: string; prospectId: string; actorId: string; aiCompanyId: string; calls: Array<CallLines & { version: number }> }): Promise<BriefRun> {
  const basis = basisKey(args.calls);
  const stored = async () => {
    const { data, error } = await admin.from("deal_briefs").select("brief, created_at").eq("company_id", args.companyId).eq("prospect_id", args.prospectId).eq("basis", basis).maybeSingle();
    return error ? null : data ? { brief: data.brief as DealBriefBody, createdAt: String(data.created_at) } : undefined;
  };
  const had = await stored();
  if (had === null) return "failed";
  if (had) return { ...had, stored: true };
  const ai = await dealBriefCoach({ companyId: args.aiCompanyId, systemPrompt: DEAL_BRIEF_SYSTEM + CONVERSATION_IS_DATA, userMessage: `Calls:\n${callsBlock(args.calls, numberedTranscript)}`, sessionId: args.calls[0]!.sessionId });
  if (ai.suppressed) return "suppressed";
  const brief = ai.text.trim() ? parseDealBrief(ai.text, args.calls) : null;
  if (!brief) return "unusable";
  // A plain insert (the table's update rule refuses ON CONFLICT); a concurrent run's row is read back.
  const { error } = await admin.from("deal_briefs").insert({ company_id: args.companyId, prospect_id: args.prospectId, basis, brief, created_by: args.actorId });
  if (error && error.code !== "23505") {
    console.error(`[deal-brief] store failed deal=${args.prospectId}: ${error.message}`);
    return "failed";
  }
  const back = await stored();
  return back ? { ...back, stored: false } : "failed";
}
