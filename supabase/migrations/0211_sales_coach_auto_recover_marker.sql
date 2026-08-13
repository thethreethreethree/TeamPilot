-- 0211 — Sales Coach: at-most-once marker for automatic post-call re-transcribe recovery.
--
-- CONTEXT (2026-08-14, founder-reported): a real 6-minute session produced a blank After-Pitch. Proven
-- root cause: the transcript was ONE-SIDED — the customer's whole side was never captured/attributed by live
-- STT (computeTalkRatio emits its "—" caveat exactly when the customer side carries zero words, while the
-- agent side scored 10 turns). A one-sided transcript can't yield a written read or graded scores.
--
-- FIX: an automatic server-side recovery (/auto-recover) — when the After-Pitch is opened and detected
-- one-sided (talk_ratio caveat) with saved audio, the server re-diarizes the recording cleanly offline,
-- auto-assigns the agent cluster, replaces the broken transcript, and regenerates. This column is the
-- persistent AT-MOST-ONCE guard: /auto-recover atomically claims it
--   (UPDATE ... SET auto_recover_attempted_at = now() WHERE id = ? AND auto_recover_attempted_at IS NULL)
-- BEFORE spending any speech-to-text cost, so a page reload — or a session whose audio genuinely holds only
-- one voice, whose caveat therefore persists — can never re-trigger the batch STT into a cost loop. A
-- client-only latch is insufficient (it resets on reload); the guarantee must be server-side.
--
-- TRADEOFF (documented, accepted): a transient STT/download failure also consumes the marker, so automatic
-- retry won't re-fire for that session. The manual one-tap recovery card + the upload path remain the
-- always-available escape hatch, so no session is stranded — an honest, bounded bound on automatic cost.
--
-- ADDITIVE ONLY: one new nullable timestamptz column on coaching_sessions. Changes NO existing column, read,
-- write, policy, or trigger. Idempotent: add-column-if-not-exists. Safe to run twice.

alter table coaching_sessions
  add column if not exists auto_recover_attempted_at timestamptz;

comment on column coaching_sessions.auto_recover_attempted_at is
  'Sales Coach (0211): timestamp the automatic post-call re-transcribe recovery (/auto-recover) was attempted '
  'for this session, claimed atomically before any STT cost. NULL = never attempted. Enforces at-most-one '
  'batch re-diarization per session (cost + re-entrancy guard) across page reloads and the persistent-caveat '
  'still-one-sided case. The manual recovery card remains available regardless of this marker.';
