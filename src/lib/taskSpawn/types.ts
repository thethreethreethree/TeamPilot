/**
 * Task Spawn Engine — Shared types.
 *
 * Used by both entry points (Decision→Task and Chat→Task) and the
 * shared refinement panel. The contextType field discriminates the
 * payload shape; the engine reads only the relevant fields.
 */

export type SpawnContextType = "decision" | "chat_messages";

export type SpawnContextPayload = {
  // ─── For contextType === "decision" ───
  /** ID of the source Decision Dialogue. Stored on the spawned task
   *  as `linked_decision_id` so the readout can trace lineage. */
  decisionId?: string;
  decisionSituation?: string;
  decisionDiagnosis?: string;
  decisionProposal?: string;
  /** The structured system response from the dialogue (engagement,
   *  added perspective, suggestion, comparison). Kept as freeform
   *  JSON so the LLM can read whatever shape the dialogue produced. */
  decisionSystemResponse?: Record<string, unknown>;
  decisionChosenPath?: "user" | "system" | "hybrid" | "defer";
  decisionChosenNote?: string;

  // ─── For contextType === "chat_messages" ───
  /** ID of the source chat topic. Stored on the spawned task as
   *  `linked_chat_topic_id`. */
  chatTopicId?: string;
  chatTopicTitle?: string;
  chatTopicDescription?: string;
  /** IDs of the messages the admin explicitly selected as the focus
   *  scope. Stored on the spawned task as `linked_message_ids`. */
  selectedMessageIds?: string[];
  /** Full bodies of the selected messages — the LLM's primary focus. */
  selectedMessages?: Array<{ author: string; body: string }>;
  /** Bodies of the surrounding ~10 messages around the selection so
   *  the LLM has full conversational context (§1.5 holistic). */
  surroundingThread?: Array<{ author: string; body: string }>;
};

/** The structured task draft the LLM produces. The user reviews this
 *  in the refinement panel before saving. */
export type SpawnedTaskDraft = {
  title: string;
  description: string;
  steps: string[];
};

export type SpawnRequest = {
  contextType: SpawnContextType;
  contextPayload: SpawnContextPayload;
  /** Optional natural-language adjustment the user wants applied to
   *  a previous draft. When present, previousTaskDraft must also be
   *  set; the engine enters refinement mode. */
  adjustmentPrompt?: string;
  /** The prior draft the user is iterating on. Required when
   *  adjustmentPrompt is set; ignored otherwise. */
  previousTaskDraft?: SpawnedTaskDraft;
};

export type SpawnResponse = {
  task: SpawnedTaskDraft;
};
