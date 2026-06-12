-- 0025 — decision_dialogues append-only at the SQL layer
--
-- Closes audit finding C1 from the §1.7 ground-up audit of 2026-06-12.
--
-- The §1.7 audit identified that decision_dialogues is claimed
-- §3.1 append-only in scripts/rls-audit.mjs ALLOWLIST and in
-- migration 0003's table-level comments, but only an immutability
-- trigger blocks column updates — there's no DO INSTEAD NOTHING rule
-- on UPDATE or DELETE. Every other §3.1 table (chat_messages, events,
-- signals, brain_evolution_events) has the rule. decision_dialogues
-- was the gap.
--
-- Why this matters: a service-role caller or a direct SQL path could
-- have hard-deleted dialogue rows, silently violating the chain's
-- claimed immutability. The "everything else has the rule" pattern
-- was load-bearing for the integrity claim; this migration closes
-- the inconsistency.
--
-- A12 (migrations safe-to-re-run) discipline applied:
--   - CREATE OR REPLACE RULE is idempotent by construction.
--   - Re-running this migration against a DB where the rules already
--     exist is a no-op.
--   - Re-running against a DB where the rules were dropped (manual
--     ops intervention) re-creates them.
--   - The migration can be replayed against ANY partially-applied
--     target without error.
--
-- A14 (verify the render path) — n/a, this is a backend-only change
-- with no UI surface. Verification is: attempt UPDATE or DELETE
-- against the table via a non-service-role context and confirm the
-- row is unchanged.

create or replace rule decision_dialogues_no_update as
  on update to decision_dialogues do instead nothing;

create or replace rule decision_dialogues_no_delete as
  on delete to decision_dialogues do instead nothing;

comment on rule decision_dialogues_no_update on decision_dialogues is
  '§3.1 append-only — closed audit C1 (2026-06-12). The on-row
   immutability trigger from 0003 blocked column updates; this rule
   blocks the UPDATE statement entirely, matching the discipline on
   chat_messages / events / signals.';

comment on rule decision_dialogues_no_delete on decision_dialogues is
  '§3.1 append-only — closed audit C1 (2026-06-12). Deletion of
   dialogue rows would falsify the §1.1 data-as-asset trail. Cascade
   deletes from the parent decisions row still apply via FK; the
   table-level DELETE statement is blocked.';
