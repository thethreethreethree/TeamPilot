-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 0289 — manager_notifications gains 'call_ready' (RSS Phase 1 follow-up: an uploaded call finished processing)
-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- An uploaded phone/video call takes minutes to transcribe, read and score, and the rep has usually left the page.
-- When the coaching reads land (generateSessionArtifacts), the rep who took the call is told, once: the dedupe index
-- (recipient_id, type, session_id) means a later re-read (a trim, a relabel) does not ring again. To the REP, about
-- their own call. Bell branch: NotificationBell.tsx (exhaustive switch). List copied from 0283. Idempotent (§A12).
-- ═════════════════════════════════════════════════════════════════════════════════════════════

alter table manager_notifications drop constraint if exists manager_notifications_type_check;
alter table manager_notifications
  add constraint manager_notifications_type_check
  check (type in (
    'strong_session',
    'deal_closed',
    'pitch_score_corrected',
    'recording_comment',
    'recording_share_requested',
    'pattern_coached',
    'pattern_clip_disputed',
    'feedback_requested',
    'training_attempted',
    'call_ready'
  ));

comment on constraint manager_notifications_type_check on manager_notifications is
  'Closed set, and it points BOTH ways: strong_session / deal_closed / pattern_clip_disputed / feedback_requested / '
  'training_attempted go to managers, the rest (call_ready included) to the rep they are about. A new type needs a '
  'migration extending this list, a decision about what it dedupes to, AND a branch in NotificationBell.tsx. '
  'See 0257, 0261-0263, 0279, 0283, 0289.';
