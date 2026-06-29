-- 0075: dedicated Sales Coach cue voice.
--
-- WHY: the live-cue TTS reused care_tenant_config.voice_id (Jeff's voice),
-- so a Sales Coach voice change would also change C.A.R.E's. This column
-- gives the Sales Coach its own per-company voice (§5), decoupled.
--
-- Reuses the existing per-company config table rather than a new one
-- (§A21 — one mechanism). NULL → the cue voice FOLLOWS the C.A.R.E voice
-- (voice_id), which itself falls back to the deployment default. So
-- existing behavior is preserved until a dedicated voice is picked.

alter table care_tenant_config
  add column if not exists sales_coach_voice_id text;
