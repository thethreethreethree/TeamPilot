-- 0067 — Add files.linked_task_id, completing the linked_* pattern.
--
-- Audit 2026-06-26 finding H1: file upload behaved inconsistently
-- across surfaces — Files/Task uploads could classify-to-escape the
-- casual cap, but chat/C.A.R.E uploads were forced casual and
-- dead-ended at the cap with no escape. The fix is ONE uniform rule:
-- a file with a DESIGNATED PURPOSE (context-linked OR explicitly
-- classified) is never subject to the casual cap; only a purposeless
-- upload is. "Context-linked" must be a clean check on the files row.
--
-- The files table already carries linked_topic_id and
-- linked_conversation_id (migration 0056). Task linkage, however,
-- lived only in the file_tasks join — so "is this upload linked to a
-- task?" required a subquery and was invisible at the row level. This
-- migration completes the original linked_* column pattern by adding
-- linked_task_id, mirroring the two existing columns exactly
-- (uuid references the parent, on delete set null, partial index).
-- This follows the ORIGINAL file-system structure rather than
-- inventing a new one (founder directive).
--
-- Constitutional sources (§0.1, read this session):
--   • §A12 — ADD COLUMN IF NOT EXISTS + CREATE INDEX IF NOT EXISTS;
--     replayable against any partial state.
--   • §1.5 holistic — the column is nullable with ON DELETE SET NULL,
--     mirroring linked_topic_id/linked_conversation_id, so it cannot
--     break inserts, the classification_lane trigger (which does not
--     read it), or task deletion.
--   • AMD-006 L1 (structure) — extends the existing data shape rather
--     than adding a parallel mechanism; the row now answers
--     "is this file context-linked?" with three sibling columns.

alter table files
  add column if not exists linked_task_id uuid
    references tasks(id) on delete set null;

create index if not exists files_linked_task_idx
  on files (linked_task_id) where linked_task_id is not null;

comment on column files.linked_task_id is
  '2026-06-26 (audit H1): the task this file was uploaded against, if
   any. Sibling of linked_topic_id / linked_conversation_id. Used by
   the casual-cap rule to recognize a designated purpose — a
   task-linked upload is a purposeful asset and is not cap-counted.';

-- ─── End migration 0067. ────────────────────────────────────
