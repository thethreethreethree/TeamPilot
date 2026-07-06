-- 0085_care_widget_load_events_append_only.sql
--
-- Harden care_widget_load_events (0038) to the SAME §3.1 structural enforcement
-- every other append-only table in this codebase already has. Per the audit
-- docs/AUDIT-2026-07-06-append-only-enforcement.md.
--
-- WHY. care_widget_load_events is widget-bootstrap telemetry — an immutable
-- event (§3.1). Its RLS grants no update/delete policy, so a USER-client can't
-- mutate it. But the SERVICE-ROLE bypasses RLS, so nothing at the DB level stops
-- a future server code path from updating or deleting a load event and silently
-- breaking the immutable record. The core C.A.R.E chain (support_messages 0034,
-- support_conversation_events 0035, support_resolutions / support_ai_co_pilot_edits
-- 0036) and every coaching table (0070/0074/0080) already block this with a
-- `do instead nothing` rule. This closes the gap for this one table (§3.2 — encode
-- the guarantee structurally, don't leave immutability to code discipline).
--
-- SAFE TO APPLY. Verified insert-only in code before writing this: the table is
-- written ONLY via `admin.from("care_widget_load_events").insert(...)`
-- (src/lib/care/config.ts, src/lib/care/email/outbound.ts). No update/delete/upsert
-- path exists, so these rules can never suppress a legitimate write.
--
-- SCOPE. Deliberately does NOT touch crm_activity_events (the audit's other flag):
-- its write path was not traced, so a `do instead nothing` rule there could
-- silently break a legitimate write. That one stays flagged pending confirmation.
--
-- Idempotent (§A12): create-or-replace rule.

create or replace rule care_widget_load_events_no_update as
  on update to care_widget_load_events do instead nothing;

create or replace rule care_widget_load_events_no_delete as
  on delete to care_widget_load_events do instead nothing;

comment on table care_widget_load_events is
  '§3.1 append-only telemetry (widget bootstraps). Immutable: no_update / no_delete rules block even the service-role (0085). Inserted server-side only.';
