-- 0044 — Supervisor guidance request flag on conversations.
--
-- New column on support_conversations:
--   supervisor_guidance_requested_at TIMESTAMPTZ NULL
--
-- Why a separate column, not a new status enum value
-- ──────────────────────────────────────────────────
-- The status field (open / in_conversation / awaiting_customer /
-- resolved / closed) is semantic about CUSTOMER FLOW — where the
-- conversation sits in the back-and-forth between customer and
-- responder. "Needs supervisor guidance" is orthogonal to that:
-- an agent can need supervisor input WHILE the conversation is
-- in any customer-flow state. Conflating the two would force a
-- false choice ("is this awaiting_customer OR is it
-- awaiting_supervisor?" — answer: both can be true).
--
-- Per AMD-006 §1.5.1 layer 1 (structure efficiency): a separate
-- column keeps the two axes decomposable. status answers "where
-- are we with the customer?"; supervisor_guidance_requested_at
-- answers "do we need internal escalation help right now?"
--
-- Per CLAUDE.md §3.1 events are immutable: the column carries
-- when the request was made. Clearing the request sets it back
-- to NULL — the prior request is preserved in the
-- support_conversation_events emit trigger (next migration may
-- want to extend the trigger to log this transition; not in this
-- one — kept minimal).
--
-- A12 idempotent.

alter table support_conversations
  add column if not exists supervisor_guidance_requested_at timestamptz null;

-- Index for the agent inbox "Needs guidance" filter — partial
-- index over non-null values only, since most conversations
-- won't have an active request. Bounded growth.
create index if not exists support_conversations_guidance_idx
  on support_conversations (company_id, supervisor_guidance_requested_at desc)
  where supervisor_guidance_requested_at is not null;
