-- 0043 — Voice (Jeff goes real-time).
--
-- Phase 9 commit 1. Adds the schema for per-tenant voice
-- configuration + per-message medium tracking so the §4 readout
-- can compare voice vs text durability honestly. Constitutional
-- sources (consulted per §0.1):
--   - §A16 — voice composes with Coach + Co-Pilot. The text
--     produced by Jeff is the source; voice is downstream. The
--     /messages endpoint stays the spine; STT/TTS sit at the
--     edges. Coach grades the text Jeff replied with regardless
--     of whether the customer heard it as audio.
--   - §A14 — multi-state UI; the medium column is the data
--     layer's record of which state produced each message.
--   - §A4 — per-tenant voice override is a known uncertainty;
--     defer the picker UI to commit 2, ship the column now so
--     the data layer is ready.
--   - §A8 — voice is participant, not feature. The column name
--     is medium (descriptive: 'text' or 'voice'), not
--     voice_enabled (status flag).
--   - §A12 — every column add is idempotent.
--
-- What this migration enables
-- ───────────────────────────
-- - Per-tenant voice picker (deferred UI lands in commit 2 but
--   the column lives now).
-- - §4 readout — does voice-conversation result in comparable
--   or better resolution durability than text-only? The
--   answerable form is "split conversations by whether any
--   message had medium='voice', compare durability_held rates."
--   Same shape as the existing Co-Pilot value readout in
--   src/lib/data/care.ts fetchCoPilotValueReadout. Deferred per
--   §A4 until we have voice messages to compare against.

alter table care_tenant_config
  add column if not exists voice_id text;

-- Per-message medium — text (existing default) or voice. The
-- /messages endpoint sets this based on whether the message
-- originated from the STT pipeline (voice) or the text composer.
alter table support_messages
  add column if not exists medium text not null default 'text'
    check (medium in ('text', 'voice'));

-- ─── Preserve trigger refresh for the new column ──────────────
-- The preserve_support_message_content trigger (last touched in
-- 0041) reverts updates to append-only columns. medium is set
-- on INSERT and never updated — same treatment as the other
-- author-shape columns.
create or replace function preserve_support_message_content()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.body := old.body;
  new.author_id := old.author_id;
  new.author_type := old.author_type;
  new.is_internal_note := old.is_internal_note;
  new.conversation_id := old.conversation_id;
  new.created_at := old.created_at;
  new.co_pilot_reasoning := old.co_pilot_reasoning;
  new.co_pilot_invoked := old.co_pilot_invoked;
  new.external_message_id := old.external_message_id;
  new.email_metadata := old.email_metadata;
  -- medium is set on INSERT, immutable after.
  new.medium := old.medium;
  return new;
end;
$$;

-- ─── Comments ────────────────────────────────────────────────
comment on column care_tenant_config.voice_id is
  'ElevenLabs voice ID this tenant uses for Jeff''s TTS output.
   When NULL the deployment-level ELEVENLABS_DEFAULT_VOICE_ID
   env var is used (currently Antoni — well-rounded
   conversational male). Tenants can pick their own voice via
   the settings UI; per §A4 the picker shipped in a follow-up
   commit so the data layer is ready when it lands.';

comment on column support_messages.medium is
  'How this message reached / left Jeff. text (default) — typed
   via the composer. voice — created via the real-time voice
   conversation loop (customer audio transcribed via STT, or
   Jeff''s text spoken back via TTS, depending on author_type).
   Used in the §4 readout to compare voice vs text durability
   without confounding by message ordering.';
