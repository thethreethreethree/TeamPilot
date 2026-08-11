-- 0210 — Sales Coach: store the ACTUAL audio length of an uploaded recording (§3.5 measurement honesty).
--
-- BUG (2026-08-11, founder-reported during a client test): an uploaded call recording showed a
-- "62m 47s conversation" for a ~4-minute audio file. Root cause: for an UPLOADED recording, the
-- After-Pitch duration is computed from the session WALL-CLOCK (ended_at - started_at) — i.e. how long the
-- SESSION sat open — which is meaningless for audio captured elsewhere and pulled in later. For a LIVE
-- coaching session the wall-clock IS the conversation length and stays correct; only uploads are wrong.
--
-- FIX (data foundation): store the real audio length, captured from the ElevenLabs Scribe word timestamps
-- at transcription time (upload-recording JSON + multipart branches, and retranscribe). The After-Pitch +
-- KPI duration prefer this when present, falling back to the wall-clock for live sessions with no upload.
--
-- ADDITIVE ONLY: one new nullable integer column on coaching_sessions. Changes NO existing column, read,
-- write, policy, or trigger — the live-coaching render path (started_at/ended_at) is byte-for-byte
-- unaffected; it simply gains a more accurate source when an upload populated it. §3.5: measure the real
-- conversation length, never a fabricated one — a duration that doesn't match the audio is exactly the kind
-- of dishonest metric the constitution forbids.
--
-- Idempotent: add-column-if-not-exists. Safe to run twice.

alter table coaching_sessions
  add column if not exists audio_duration_seconds integer;

comment on column coaching_sessions.audio_duration_seconds is
  'Sales Coach (0210): the ACTUAL length of an UPLOADED call recording, in whole seconds, captured from the '
  'transcription word timestamps at upload/retranscribe time. NULL for live-coaching sessions (their '
  'conversation length is the started_at..ended_at wall-clock, which is correct). The After-Pitch + KPI '
  'duration prefer this when present so an uploaded recording shows its real length, not the session open-time.';
