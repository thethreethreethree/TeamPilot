import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllPagedResult } from "@/lib/supabase/paginate";
import { dealReviewCoach } from "@/lib/claude";
import { CONVERSATION_IS_DATA } from "@/lib/care/toolPrompts";
import { numberedTranscript } from "@/lib/coach/remote/followThrough";
import { allowed, DEAL_REVIEW_SYSTEM, parseReview, replayNotes, reviewPrompt, type CallLines, type Element, type NoteEvent } from "./playbook";

/**
 * The AI Deal Reviewer's one run (revenue Phase 3b, 0373; Gong F20.7; Engage E12 / F27.10 runs it from an agent). Given
 * the deal's calls — already opened by whoever runs it (the person through their own access, or an agent's runner with
 * the owner's hidden calls left out) — read the company's current playbook, ask the AI for each element's evidence, and
 * store a read only where it cites a real line and the note's state allows one (a person's note is never overwritten).
 * Every read and write is pinned to the company: an agent runs this with the service role.
 */
export type ReviewResult = { found: number; of: number; calls: number } | "no_playbook" | "suppressed" | "unusable" | "failed";

export async function reviewPlaybook(admin: SupabaseClient, args: { companyId: string; prospectId: string; actorId: string; calls: CallLines[] }): Promise<ReviewResult> {
  const { companyId, prospectId, actorId, calls } = args;
  const { data: pb, error: pErr } = await admin.from("deal_playbook_current").select("id, elements").eq("company_id", companyId).maybeSingle();
  if (pErr) return "failed";
  if (!pb) return "no_playbook";
  const elements = pb.elements as Element[];
  // The whole history (review 2026-11-28: a 1,000-row cap could drop the newest notes, a person's validate among them).
  const { data: ev, error: eErr } = await fetchAllPagedResult<{ id: number; element: number; action: NoteEvent["action"]; note: string | null; ai: NoteEvent["ai"]; actor_id: string; created_at: string }>(
    (f, t) => admin.from("deal_element_notes").select("id, element, action, note, ai, actor_id, created_at").eq("company_id", companyId).eq("prospect_id", prospectId).eq("playbook_id", pb.id).order("id", { ascending: true }).range(f, t),
    { label: "deal element notes", maxRows: 20_000 },
  );
  if (eErr) return "failed";
  const events = ((ev ?? []) as Array<{ element: number; action: NoteEvent["action"]; note: string | null; ai: NoteEvent["ai"]; actor_id: string; created_at: string }>).map((e) => ({
    element: e.element, action: e.action, note: e.note, ai: e.ai, actorId: e.actor_id, at: e.created_at,
  }));
  const views = replayNotes(events, elements.length);
  const ai = await dealReviewCoach({
    companyId,
    systemPrompt: DEAL_REVIEW_SYSTEM + CONVERSATION_IS_DATA,
    userMessage: reviewPrompt(elements, calls, numberedTranscript),
    sessionId: calls[0]!.sessionId,
  });
  if (ai.suppressed) return "suppressed";
  const reads = ai.text.trim() ? parseReview(ai.text, elements, calls) : null;
  if (!reads) return "unusable";
  const rows = reads
    .map((read, element) => ({ read, element }))
    .filter(({ read, element }) => read.cites.length > 0 && allowed(views[element]!.state, "ai_suggest"))
    .map(({ read, element }) => ({ company_id: companyId, prospect_id: prospectId, playbook_id: pb.id, element, action: "ai_suggest", ai: read, actor_id: actorId }));
  if (rows.length) {
    const { error } = await admin.from("deal_element_notes").insert(rows);
    if (error) {
      console.error(`[deal-playbook] review store failed deal=${prospectId}: ${error.message}`);
      return "failed";
    }
  }
  return { found: rows.length, of: elements.length, calls: calls.length };
}
