-- 0060 — Fix Supabase Security Definer View advisor warning
-- on the asset_event_kinds view created in migration 0057.
--
-- Why this matters
-- ────────────────
-- In Postgres 15+, views without an explicit `security_invoker`
-- option default to SECURITY DEFINER behavior — they run with
-- the permissions of the VIEW CREATOR (typically the migration
-- runner, which has elevated privileges), NOT the user executing
-- the SELECT. RLS on any underlying tables is BYPASSED when
-- accessed via the view.
--
-- For asset_event_kinds specifically, the practical leak is
-- bounded — the view is a static lookup that hardcodes
-- event-kind names and their descriptions, no underlying
-- table query. But the linter flag is correct: if anyone
-- later extends this view to read from the events table or
-- any other tenant-scoped surface, the SECURITY DEFINER
-- default would silently bypass RLS at that moment with no
-- code review trigger. Better to set the right posture now.
--
-- Same fix as migration 0052 applied to the two views from
-- 0048 / 0049 / 0050. The pattern: ALTER VIEW + recreate with
-- (security_invoker = true).
--
-- Per CLAUDE.md §A11 — RLS is the source of truth for row-
-- level access. A view that bypasses it is the System claiming
-- a security boundary it isn't enforcing.
--
-- §A12 — idempotent (CREATE OR REPLACE; ALTER VIEW SET is
-- safe to re-run regardless of current state).

alter view if exists asset_event_kinds set (security_invoker = true);

-- Recreate so the option is recorded in the view definition
-- (some Postgres tooling reads the option from creation, not
-- from ALTER). Same body as 0057; only the security_invoker
-- option is added.
create or replace view asset_event_kinds
  with (security_invoker = true)
  as
  select kind, description from (values
    ('asset.file.uploaded',
     'A file row was created. Payload: file_id, uploader_id, size_bytes, mime_type, classification_lane.'),
    ('asset.file.classified',
     'A file moved from casual to classified (gate cleared). Payload: file_id, department_ids[], task_ids[], tags[].'),
    ('asset.file.viewed',
     'A user opened the file viewer. Distinct from downloaded — a view does not transfer bytes off-server.'),
    ('asset.file.downloaded',
     'A user downloaded the file bytes. Counts toward §4 retrieval-rate readout.'),
    ('asset.file.shared',
     '@person share: file was @-mentioned at a specific user. Payload: file_id, shared_with_profile_id, surface (chat/care).'),
    ('asset.file.cited',
     'File was @file-referenced in a chat/task/decision/resolution. Counts toward §4 citation-rate readout.'),
    ('asset.file.deprecated',
     'Uploader or admin marked the file deprecated. Soft-delete; the file row remains.'),
    ('asset.file.access_changed',
     'Access role was changed (e.g., everyone → admins). Payload: file_id, prev_role, new_role.'),
    ('asset.suggestion.acted_on',
     'User responded to an AI classification suggestion. Payload: file_id, user_action.')
  ) as t (kind, description);

comment on view asset_event_kinds is
  'Vocabulary of asset.* event kinds for the existing events
   table. Declared per ThinkerThinker A13 (vocabulary-once
   discipline). security_invoker=true per migration 0060 so
   the view honors the querying user''s RLS context if it ever
   gains underlying-table reads — the existing static body
   needs no RLS, but the posture must be safe by default.';

-- ─── End migration 0060. ────────────────────────────────────
