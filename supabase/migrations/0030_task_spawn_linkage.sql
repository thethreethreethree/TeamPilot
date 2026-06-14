-- 0030 — Task Spawn Engine linkage columns
--
-- Per the Task Spawn Engine spec — tasks can now be SPAWNED from
-- either a finalized Decision Dialogue or a selection of chat
-- messages. Both entry points run the same LLM-based plan
-- generator and land structured step lists on the task.
--
-- This migration is additive: new columns on tasks, all nullable
-- so existing rows are unaffected. The columns let the §3.1
-- readout trace where each task originated (closing the §1.6 loop
-- — chats and decisions now produce action, not just storage).
--
-- A12 discipline: every `add column` uses `if not exists`; the
-- check constraint uses `drop ... if exists` before `add` so
-- re-runs are clean. No data backfill needed (all nullable).

-- ─── Linkage to source (decision OR chat topic) ────────────────
alter table tasks
  add column if not exists linked_decision_id uuid
    references decisions(id) on delete set null;

alter table tasks
  add column if not exists linked_chat_topic_id uuid
    references chat_topics(id) on delete set null;

-- Which specific messages in the chat topic were selected as the
-- reference scope. Whole-conversation context is still passed to
-- the LLM at spawn time; this array records the user's selection
-- intent for downstream readout / audit.
alter table tasks
  add column if not exists linked_message_ids uuid[];

-- ─── Step-by-step plan (LLM-generated) ─────────────────────────
-- Stored as jsonb array of strings. v1 of the spawn engine keeps
-- steps editable as text in the task description; this column is
-- the structured form for future per-step completion tracking.
-- Empty array (or null) means "no spawned plan" — covers existing
-- tasks created before the spawn engine.
alter table tasks
  add column if not exists spawn_steps jsonb;

-- Honest source-of-truth: a task can be spawned from a decision OR
-- a chat OR neither (created directly). But not both at once —
-- enforcing that surfaces the lineage as a single clear pointer
-- per row.
alter table tasks drop constraint if exists tasks_spawn_source_xor;
alter table tasks add constraint tasks_spawn_source_xor
  check (
    linked_decision_id is null
    or linked_chat_topic_id is null
  );

-- ─── Indexes for the readout query paths ───────────────────────
-- "What tasks did this decision spawn?" — frequent on Decision
-- Dialogue detail views.
create index if not exists tasks_linked_decision_idx
  on tasks (linked_decision_id) where linked_decision_id is not null;

-- "What tasks did this chat topic spawn?" — frequent on Team Chat
-- topic detail views.
create index if not exists tasks_linked_chat_topic_idx
  on tasks (linked_chat_topic_id) where linked_chat_topic_id is not null;

-- ─── Column documentation ─────────────────────────────────────
comment on column tasks.linked_decision_id is
  'When the task was spawned from a Decision Dialogue. Null otherwise.
   The on-delete-set-null lets a decision be hard-deleted without
   orphaning task rows; the linkage just goes null.';

comment on column tasks.linked_chat_topic_id is
  'When the task was spawned from a chat (admin Chat→Task feature).
   Null otherwise. Mutually exclusive with linked_decision_id per
   the tasks_spawn_source_xor constraint.';

comment on column tasks.linked_message_ids is
  'Specific message IDs the admin selected as the reference scope
   when spawning. The whole conversation is still passed to the LLM
   at spawn time; this array records the selection intent.';

comment on column tasks.spawn_steps is
  'LLM-generated step-by-step plan from the Task Spawn Engine.
   jsonb array of strings, e.g. ["Identify the integration test that
   covers...", "Write a failing case for...", ...]. Null on tasks
   created before the spawn engine or without a generated plan.';

comment on constraint tasks_spawn_source_xor on tasks is
  'A task can be spawned from a decision OR a chat OR neither, but
   not both. Surfaces lineage as a single clear pointer per row.';
