-- 0240 — Data cleanup: null the misleading backfilled ended_at on stale-closed sessions.
--
-- SOURCE OF THE BAD DATA: the 0070 active→ended trigger stamps ended_at = now() when a session's status flips to
-- 'ended'. When auto-close-stale-cron closed ~215 long-open sessions at once on 2026-08-21, every one received
-- ended_at = 2026-08-21T00:28:33.175Z regardless of when the call actually ended (many started in June) → wall-clock
-- spans of ~54 DAYS. Averaged into the KPI avg-session-duration, one of these produced the founder-reported
-- "32051.9 min" (verified against the live DB 2026-08-29).
--
-- The code fix (src/lib/coach/conversationDuration.ts MAX_WALLCLOCK_SECONDS = 4h) already neutralizes these on
-- EVERY read surface (After-Pitch header, Sessions list, KPI). This migration makes the RAW rows honest too: a
-- session whose wall-clock is implausibly long AND carries no real audio length never had a knowable end time, so
-- ended_at becomes NULL ("ended, end-time unknown") rather than a fabricated close-time (§3.4 — no invented number).
-- STATUS is untouched (the session stays 'ended'); only the wrong timestamp is cleared.
--
-- PRECISE + IDEMPOTENT: targets only implausible-wall-clock (>4h, matching the code cap) + no-audio sessions. Real
-- calls are minutes; no legitimate LIVE session runs >4h. Re-running matches 0 rows. UPLOADS
-- (audio_duration_seconds > 0) are NEVER touched — their true audio length is the trusted duration.
--
-- Not fixed here (recurrence): the trigger will keep stamping now() on future stale-closes; the code cap
-- neutralizes that for durations, so this is a one-time raw-data hygiene pass, not a trigger change.

update coaching_sessions
set ended_at = null
where audio_duration_seconds is null
  and ended_at is not null
  and extract(epoch from (ended_at - started_at)) > 4 * 3600;
