-- 0086_crm_activity_events_append_only.sql
--
-- Harden crm_activity_events (0049) to DB-level §3.1 immutability — the second
-- and final flag from docs/AUDIT-2026-07-06-append-only-enforcement.md (0085
-- closed the first, care_widget_load_events).
--
-- WHY. 0049 declares crm_activity_events "append-only per §3.1" and its RLS grants
-- only a SELECT policy, so a USER-client can't mutate it. But the SERVICE-ROLE
-- bypasses RLS, and nothing at the DB level stopped a future server path from
-- updating or deleting an activity event — silently breaking the immutable CRM
-- history that lifecycle derivation + retrospective analysis (§1.2) rely on.
--
-- SAFE TO APPLY — write path now fully traced (the audit deferred this until
-- confirmed). Every write is `insert into crm_activity_events` inside the 0049
-- SECURITY DEFINER trigger functions; the only application reference
-- (src/lib/crm/data.ts) is a `.select()` READ. There is NO update/delete/upsert
-- anywhere in code or migrations, so these rules cannot suppress a legitimate
-- write.
--
-- This brings every §3.1-declared table in the codebase to the SAME structural
-- enforcement (§3.2 — encode the guarantee, don't leave it to code discipline):
-- coaching (0070/0074/0080), core C.A.R.E (0034-0036), care_widget_load_events
-- (0085), and now crm_activity_events.
--
-- Idempotent (§A12): create-or-replace rule.

create or replace rule crm_activity_events_no_update as
  on update to crm_activity_events do instead nothing;

create or replace rule crm_activity_events_no_delete as
  on delete to crm_activity_events do instead nothing;

comment on table crm_activity_events is
  '§3.1 append-only CRM activity chain. Immutable: no_update / no_delete rules block even the service-role (0086). Inserted only by the 0049 SECURITY DEFINER triggers.';
