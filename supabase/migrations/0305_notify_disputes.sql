-- 0305 — a score dispute and its answer each reach the other person (Gong ledger F15.21, 2026-11-22).
--
-- A rep files a dispute (coach.pitch_score_disputed) and nobody is told: the manager finds it only by opening the queue,
-- and the rep finds the answer only by re-opening the call. Two types join 0294's closed set:
--   score_disputed   → the rep's managers (resolveManagers: up the tree, else every manager — the one fan-out rule);
--   dispute_answered → the rep whose score it is.
-- Both dedupe on (recipient_id, type, session_id) and are UPSERTED by the writer, so a second dispute on the same call
-- brings the one alert back to the top rather than stacking bells. Additive; re-runnable.

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
    'call_ready',
    'comment_mention',
    'score_disputed',
    'dispute_answered'
  ));

comment on constraint manager_notifications_type_check on manager_notifications is
  'Closed set, and it points BOTH ways: strong_session / deal_closed / pattern_clip_disputed / feedback_requested / '
  'training_attempted / score_disputed go to managers; call_ready, dispute_answered and the rest to the rep they are '
  'about; comment_mention to whoever was mentioned. A new type needs a migration extending this list, a decision about '
  'what it dedupes to, AND a branch in NotificationBell (its exhaustive switch fails to compile otherwise).';
