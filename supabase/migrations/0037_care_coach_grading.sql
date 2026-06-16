-- 0037 — Care Coach grading on agent replies.
--
-- Adds the columns that hold the Coach's grade on every agent
-- reply. Per §A18, visibility is asymmetric: the agent sees their
-- own grade + reason; their leader sees aggregate; the customer
-- never sees it. The grading itself happens async after the
-- message is inserted — best-effort, never blocks the reply.
--
-- A12 idempotent.

alter table support_messages
  add column if not exists coach_grade text
    check (coach_grade in ('productive', 'neutral', 'needs_guidance', 'withheld'));

alter table support_messages
  add column if not exists coach_reason_internal text;

alter table support_messages
  add column if not exists coach_graded_at timestamptz;

comment on column support_messages.coach_grade is
  '§A18 grade on agent replies. productive = the reply read as
   clear, resolution-centered, well-suited to the customer. neutral
   = no strong signal. needs_guidance = the reply read as evaluation,
   identity-attack, or otherwise likely to escalate the customer.
   withheld = grader unavailable. Visible to the agent + leader
   only. Never surfaced to the customer.';

comment on column support_messages.coach_reason_internal is
  'Short internal reason the grader returned. Surfaces to the
   agent in /dashboard/care/growth so they understand the grade.
   Never leaves the agent + leader scope.';

-- Index for the agent growth query (per-agent grade aggregation
-- over the last N days).
create index if not exists support_messages_agent_grade_idx
  on support_messages (author_id, coach_grade, created_at desc)
  where author_type = 'agent' and coach_grade is not null;

-- ─── Refine the append-only protection ────────────────────────
--
-- 0034 set up support_messages_no_update as a do-instead-nothing
-- rule blocking ALL updates. That preserved §3.1 append-only on
-- message CONTENT but it also blocks updates to grading metadata
-- (which is data ABOUT the message, not the message itself).
--
-- Replace the rule with a trigger that:
--   - Allows updates to coach_grade, coach_reason_internal,
--     coach_graded_at (meta added AFTER send by the grader)
--   - Silently reverts any change to body, author_type, author_id,
--     created_at, is_internal_note, conversation_id (the real
--     content the §3.1 discipline protects)
--
-- This keeps the append-only contract honest for what matters
-- while letting the grader do its work.

drop rule if exists support_messages_no_update on support_messages;

create or replace function preserve_support_message_content()
returns trigger
language plpgsql
as $$
begin
  -- Revert any attempt to mutate the content columns. The grade
  -- columns (and only those) are mutable.
  new.body              := old.body;
  new.author_type       := old.author_type;
  new.author_id         := old.author_id;
  new.conversation_id   := old.conversation_id;
  new.is_internal_note  := old.is_internal_note;
  new.created_at        := old.created_at;
  return new;
end;
$$;

drop trigger if exists trg_preserve_support_message_content on support_messages;
create trigger trg_preserve_support_message_content
  before update on support_messages
  for each row execute function preserve_support_message_content();

comment on function preserve_support_message_content() is
  '§3.1 append-only protection refined. UPDATE to coach_grade /
   coach_reason_internal / coach_graded_at columns is allowed
   (grader writes after-the-fact); any UPDATE to body / author /
   created_at / conversation_id / is_internal_note is silently
   reverted to preserve the message-content honesty.';
