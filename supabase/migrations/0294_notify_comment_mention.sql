-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 0294 — manager_notifications gains 'comment_mention' (RSS F9.8: someone @mentioned you on a recording)
-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- To the person mentioned (rep or manager), about the comment's call. session_id is the call's session, so the
-- dedupe index (recipient_id, type, session_id) means one ring per call per person until it is read — a thread that
-- mentions you five times does not ring five times. Bell branch: NotificationBell.tsx (exhaustive switch).
-- List copied from 0289. Idempotent (§A12).
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
    'call_ready',
    'comment_mention'
  ));

comment on constraint manager_notifications_type_check on manager_notifications is
  'Closed set, and it points BOTH ways: strong_session / deal_closed / pattern_clip_disputed / feedback_requested / '
  'training_attempted go to managers; call_ready and the rest to the rep they are about; comment_mention to whoever '
  'was mentioned. A new type needs a migration extending this list, a decision about what it dedupes to, AND a branch '
  'in NotificationBell.tsx. See 0257, 0261-0263, 0279, 0283, 0289, 0294.';
