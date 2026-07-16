-- 0187 — ELOSALES Standard revision, Layer 1 (data foundation): recording retention + save flag.
--
-- SPEC (PDF, Sessions tab item 1b, verbatim intent): "the manager can see all their recordings the past 2 days.
-- Then it deletes the recordings after 2 days (unless saved by the manager or user)."
--
-- This migration is ADDITIVE ONLY — three new nullable/defaulted columns on coaching_sessions. It changes NO
-- existing column, read, write, policy, or trigger, so the EXPERT mode render path (which reads
-- audio_asset_url + status but never these new columns) is byte-for-byte unaffected. The retention PURGE and the
-- manager/rep SAVE action live in Layer-2 routes (a service-role save route with an in-code manager-or-owner
-- check, and a storage-sweep-pattern purge), not here — this file only establishes the state a recording carries.
--
-- WHY A FLAG, NOT A HARD DELETE HERE: the audio itself is an immutable asset in the assets bucket (0070). "Delete
-- after 2 days" means the purge job nulls audio_asset_url + removes the asset for sessions whose recording is
-- older than 2 days AND recording_saved = false. Until the purge runs, the same predicate is applied at read time
-- so an expired-but-not-yet-purged recording is never shown (defense in depth). recording_saved is the founder's
-- "unless saved" escape hatch; either the owning rep OR a manager may set it (enforced in the Layer-2 route).
--
-- Idempotent: add-column-if-not-exists + create-index-if-not-exists. Safe to run twice.

alter table coaching_sessions
  add column if not exists recording_saved     boolean not null default false;

alter table coaching_sessions
  add column if not exists recording_saved_by  uuid references profiles(id) on delete set null;

alter table coaching_sessions
  add column if not exists recording_saved_at  timestamptz;

comment on column coaching_sessions.recording_saved is
  'ELOSALES retention (0187): when true, the recording is exempt from the 2-day auto-purge. Set by the owning rep '
  'OR a manager (company admin / sales_coach_role=admin) via the save-recording route. The "unless saved by the '
  'manager or user" escape hatch from the PDF spec.';
comment on column coaching_sessions.recording_saved_by is
  'Who saved the recording (rep or manager). Audit trail for the retention exemption; null when not saved.';

-- Purge-support index: the retention job scans for sessions that still have audio, are not saved, and are older
-- than the window. Partial index keeps it small (only unpurged, unsaved rows matter).
create index if not exists coaching_sessions_retention_idx
  on coaching_sessions (created_at)
  where audio_asset_url is not null and recording_saved = false;
