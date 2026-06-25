/**
 * Coach v5.0 — Shared Types
 *
 * The conversational LLM-primary Coach. Replaces the v3.x regex-primary
 * architecture with full LLM analysis against the verified Knowledge Base
 * (docs/COACH_KNOWLEDGE_BASE.md).
 *
 * Spec: docs/COACH_PROMPT_DESIGN.md
 */

/** Composer surface the Coach is being invoked from. The context schema
 *  varies by surface — a Decision Dialogue "Your read" has different
 *  contextual signals than a chat message reply. */
export type CoachContextType =
  | "chat_message"
  | "decision_dialogue"
  | "chat_reply"
  | "task_field"
  | "feedback"
  | "smoke_test_note"
  /** Per TT.md A21 — C.A.R.E uses the same Coach v5 the rest of
   *  ELOSTATE uses. "Ask Coach" must behave identically across
   *  modules; the only difference is the surface context payload. */
  | "support_reply";

/** Mode determines whether the Coach speaks when the draft is "correct".
 *  - "auto": Coach is passive — speaks only when needs_improvement=true
 *  - "ask": Coach is active — user asked, so Coach responds either way
 *  - "review_sent": Coach is reviewing an already-sent message (no
 *    accept/refine possible; teaching only) */
export type CoachAnalysisMode = "auto" | "ask" | "review_sent";

export type CoachContextPayload = {
  /** Recent messages in the thread, oldest first. For chat_message,
   *  chat_reply, decision_dialogue surfaces. */
  recentThread?: Array<{
    author: string;
    body: string;
    timestamp: string;
  }>;
  /** Topic-level context for chat-based surfaces. */
  topic?: {
    title?: string;
    description?: string;
  };
  /** For decision_dialogue surface — the situation being decided plus
   *  any phase entries already authored (so the Coach knows whether
   *  this is the "Your read" phase or another). */
  decisionSituation?: string;
  decisionPriorPhases?: {
    situation?: string;
    userRead?: string;
    userProposal?: string;
  };
  /** For chat_reply surface — the message being replied to. */
  parentMessage?: {
    author: string;
    body: string;
  };
  /** For task_field surface. */
  taskTitle?: string;
  taskDescription?: string;
  /** For feedback surface. */
  feedbackKind?: string;
  /** For smoke_test_note surface. */
  smokeTestItemTitle?: string;
  /** For support_reply surface — the C.A.R.E customer conversation
   *  context the agent is drafting against. */
  supportCustomerLastMessage?: { author: string; body: string };
  supportProductContext?: string;
  supportCustomerName?: string;
};

export type CoachAnalysisRequest = {
  mode: CoachAnalysisMode;
  draft: string;
  contextType: CoachContextType;
  contextPayload: CoachContextPayload;
};

/** v5.0 classifies every draft into exactly one category. */
export type CoachClassification =
  | "correct"
  | "unclear"
  | "unproductive"
  | "negative";

/** A reference to a principle in the Knowledge Base. The `sectionRef`
 *  is the section number in COACH_KNOWLEDGE_BASE.md (e.g., "2.6" for
 *  Crucial Conversations' Contrasting Statement). */
export type CoachPrincipleCitation = {
  name: string;
  book: string;
  sectionRef: string;
};

export type CoachAnalysisResponse = {
  classification: CoachClassification;
  needsImprovement: boolean;
  /** Brief positive acknowledgment when classification is "correct" or
   *  when needsImprovement is false but the draft has a notable
   *  strength worth naming. */
  affirmation?: string;
  /** Present when needsImprovement is true. */
  improvement?: {
    suggestedRevision: string;
    principleCited: CoachPrincipleCitation;
    /** Optional secondary cite — typically Zinsser (prose layer)
     *  underneath the main situational principle. Max one. */
    secondaryPrinciple?: CoachPrincipleCitation;
    /** Why this rewrite fits the conversation context (1-2 sentences,
     *  references chat history). */
    whyContext: string;
    /** What specifically changed and why under the named principle
     *  (1-2 sentences, specific to draft+principle). */
    whySentence: string;
  };
  /** 2-3 suggested follow-up questions the user might want to ask.
   *  Seeds the multi-turn conversational depth. */
  conversationStarters: string[];
};

export type CoachFollowUpRequest = {
  draft: string;
  contextType: CoachContextType;
  contextPayload: CoachContextPayload;
  /** Prior turns in the conversation between user and Coach. */
  priorTurns: Array<{
    role: "user" | "coach";
    content: string;
  }>;
  userQuestion: string;
};

export type CoachFollowUpResponse = {
  reply: string;
  /** Optional new rewrite if the user's question implied wanting one. */
  alternativeRevision?: string;
  conversationStarters: string[];
};

// ─── Encouragement System (post-send grading) — §10 of design doc ───

/** The four grades the Encouragement System grader can return.
 *  Drives the asymmetric visibility layer:
 *   - productive → 🙌 (sender sees only)
 *   - neutral → no indicator
 *   - needs_guidance → "Review with Coach" (sender) +
 *     "Needs Guidance" label (admins/execs/CEO)
 *   - withheld → grader unavailable; no indicator shown
 */
export type EncouragementGrade =
  | "productive"
  | "neutral"
  | "needs_guidance"
  | "withheld";

export type GradeRequest = {
  sentMessage: string;
  contextType: CoachContextType;
  recentThread?: Array<{
    author: string;
    body: string;
    timestamp: string;
  }>;
  parentMessage?: { author: string; body: string };
};

export type GradeResponse = {
  grade: EncouragementGrade;
  /** Internal-only reason text — shown to the Coach when the user
   *  clicks "Review with Coach" so it can pick up the grader's
   *  diagnosis. NEVER surfaced as the leader-visible label. NEVER
   *  shown to peers. */
  reasonInternal?: string;
};

// ─── End-of-conversation Debrief (§3.6 make-learning-visible) ───

/** Which conversation surface the debrief is being generated for.
 *  Team Chat closes a topic; C.A.R.E resolves a support conversation.
 *  The engine reads different tables per surface but the LLM contract
 *  and the rendered shape are identical (one engine, both surfaces). */
export type CoachDebriefSurface = "chat_topic" | "support_conversation";

/** A single message the user authored in the conversation, paired with
 *  its post-send grade (when one was recorded). The grade is the §3.5
 *  consequence anchor — "what to work on" must lean on graded outcomes,
 *  not the debrief LLM's fresh opinion alone. */
export type CoachDebriefMessage = {
  body: string;
  /** Post-send grade if the message was graded; null if it predates
   *  grading or grading was withheld. */
  grade: EncouragementGrade | null;
  timestamp: string;
};

/** The structured debrief the Coach returns at conversation end. */
export type CoachDebrief = {
  /** Did the conversation carry enough coachable signal to teach from?
   *  false → the honest empty state ("you communicated cleanly here —
   *  nothing to flag"), never a fabricated lesson (§3.4). */
  hasSignal: boolean;
  /** 1-3 "what you did well" items, each grounded in a real message
   *  the user actually wrote. Empty when hasSignal is false. */
  learned: string[];
  /** 0-2 "your current edge" items — what to work on, anchored to the
   *  message grades + any recurring cross-conversation pattern. MAY be
   *  empty even when hasSignal is true: a genuinely clean conversation
   *  has nothing to work on, and inventing something would be the
   *  §3.4 dishonesty the whole product exists to refuse. */
  workOn: string[];
  /** One short closing line in the Coach's peer voice. Optional. */
  closing?: string;
};
