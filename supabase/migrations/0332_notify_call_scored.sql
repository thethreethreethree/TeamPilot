-- 0332 — manager_notifications gains 'call_scored' (2026-11-25; Gong ledger F15.13 "Notify the scored person").
--
-- The rep was told when an uploaded call was READY (0289, which fires before scoring) and when a manager CORRECTED a
-- score, but never when the AI's score itself landed. 'call_scored' goes to the rep whose phone/video call was scored,
-- once per call (0242's dedupe index on recipient, type, session — a re-score after a trim is the intended no-op).
-- Door pitches are not notified: a door rep pitches dozens of times a day and sees each score on the spot.
-- Additive; re-runnable.

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
    'dispute_answered',
    'call_scored'
  ));

comment on constraint manager_notifications_type_check on manager_notifications is
  'Closed set, and it points BOTH ways: strong_session / deal_closed / pattern_clip_disputed / feedback_requested / '
  'training_attempted / score_disputed go to managers; call_ready, call_scored, dispute_answered and the rest to the rep '
  'they are about; comment_mention to whoever was mentioned. A new type needs a migration extending this list, a '
  'decision about what it dedupes to, AND a branch in NotificationBell (its exhaustive switch fails to compile otherwise).';
