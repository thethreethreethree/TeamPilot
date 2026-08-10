import { createClient, supabaseEnabled } from "@/lib/supabase/client";

/**
 * Client-side data layer for in-thread Decision Dialogues
 * (chat_topic_decisions). Mirrors the shape used by /dashboard/decisions
 * so the in-thread card and the off-thread page share the same field
 * vocabulary.
 *
 * The component drives state via these helpers + the four API routes
 * under /api/chat/topic-decisions/*. Reads can go direct to Supabase
 * (RLS-gated); writes go through the API so the chain event emission
 * and the system-message post happen as a single server-side action.
 */

export type TopicDecisionPhase =
  | "situation"
  | "elicit"
  | "respond"
  | "decide"
  | "decided";

export interface TopicDecisionSystemResponse {
  engagement: string;
  addedPerspective: string;
  suggestion: { action: string; why: string };
  comparison: string;
}

export type TopicDecisionChosenPath = "user" | "system" | "hybrid" | "defer";

export interface TopicDecision {
  id: string;
  companyId: string;
  topicId: string;
  openedBy: string | null;
  openedAt: string;
  phase: TopicDecisionPhase;
  situation: string;
  userDiagnosis: string;
  userProposal: string;
  systemResponse: TopicDecisionSystemResponse | null;
  chosenPath: TopicDecisionChosenPath | null;
  chosenNote: string;
  decidedAt: string | null;
  persistedDecisionId: string | null;
  updatedAt: string;
}

interface TopicDecisionRow {
  id: string;
  company_id: string;
  topic_id: string;
  opened_by: string | null;
  opened_at: string;
  phase: TopicDecisionPhase;
  situation: string | null;
  user_diagnosis: string | null;
  user_proposal: string | null;
  system_response: TopicDecisionSystemResponse | null;
  chosen_path: TopicDecisionChosenPath | null;
  chosen_note: string | null;
  decided_at: string | null;
  persisted_decision_id: string | null;
  updated_at: string;
}

function rowToDecision(row: TopicDecisionRow): TopicDecision {
  return {
    id: row.id,
    companyId: row.company_id,
    topicId: row.topic_id,
    openedBy: row.opened_by,
    openedAt: row.opened_at,
    phase: row.phase,
    situation: row.situation ?? "",
    userDiagnosis: row.user_diagnosis ?? "",
    userProposal: row.user_proposal ?? "",
    systemResponse: row.system_response,
    chosenPath: row.chosen_path,
    chosenNote: row.chosen_note ?? "",
    decidedAt: row.decided_at,
    persistedDecisionId: row.persisted_decision_id,
    updatedAt: row.updated_at,
  };
}

/**
 * Fetch the in-thread Decision Dialogue for a topic.
 *
 * Returns the OPEN dialogue if one exists (phase != 'decided'), or the
 * most recent DECIDED dialogue otherwise. The card UI uses this to
 * decide whether to render the active 4-phase flow or the folded
 * decided summary.
 */
export async function fetchTopicDecision(
  topicId: string
): Promise<TopicDecision | null> {
  if (!supabaseEnabled) return null;
  const supabase = createClient();

  const { data: open, error: openErr } = await supabase
    .from("chat_topic_decisions")
    .select(
      "id, company_id, topic_id, opened_by, opened_at, phase, situation, user_diagnosis, user_proposal, system_response, chosen_path, chosen_note, decided_at, persisted_decision_id, updated_at"
    )
    .eq("topic_id", topicId)
    .neq("phase", "decided")
    .maybeSingle();
  // Error-as-no-data guard: on error, a missing open dialogue would fall through and the topic could render as
  // "no decision yet" when one exists. Fail closed; reserve the fall-through for a genuinely absent open dialogue.
  if (openErr) throw new Error(`Failed to load the topic decision: ${openErr.message}`);
  if (open) return rowToDecision(open as TopicDecisionRow);

  const { data: latest, error: latestErr } = await supabase
    .from("chat_topic_decisions")
    .select(
      "id, company_id, topic_id, opened_by, opened_at, phase, situation, user_diagnosis, user_proposal, system_response, chosen_path, chosen_note, decided_at, persisted_decision_id, updated_at"
    )
    .eq("topic_id", topicId)
    .order("decided_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  // Error-as-no-data guard: on error, null would read as "never decided" and hide a real decided dialogue.
  if (latestErr) throw new Error(`Failed to load the topic decision: ${latestErr.message}`);
  return latest ? rowToDecision(latest as TopicDecisionRow) : null;
}

// ─── Write helpers (API-mediated) ──────────────────────────────

export async function openTopicDecision(
  topicId: string,
  initialSituation: string
): Promise<TopicDecision> {
  const res = await fetch("/api/chat/topic-decisions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topicId, initialSituation }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Could not open dialogue.");
  return rowToDecision(data.row as TopicDecisionRow);
}

export async function saveTopicDecision(
  id: string,
  patch: {
    situation?: string;
    userDiagnosis?: string;
    userProposal?: string;
    phase?: Exclude<TopicDecisionPhase, "decided">;
  }
): Promise<TopicDecision> {
  const res = await fetch(`/api/chat/topic-decisions/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Could not save dialogue state.");
  return rowToDecision(data.row as TopicDecisionRow);
}

export async function requestTopicDecisionSystemResponse(
  id: string
): Promise<TopicDecision> {
  const res = await fetch(`/api/chat/topic-decisions/${id}/respond`, {
    method: "POST",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Could not request System response.");
  return rowToDecision(data.row as TopicDecisionRow);
}

export async function decideTopicDecision(
  id: string,
  chosenPath: TopicDecisionChosenPath,
  chosenNote: string
): Promise<TopicDecision> {
  const res = await fetch(`/api/chat/topic-decisions/${id}/decide`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chosenPath, chosenNote }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Could not record decision.");
  return rowToDecision(data.row as TopicDecisionRow);
}
