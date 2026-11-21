-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 0283 — manager_notifications gains 'training_attempted' (RSS Phase 7, Gong F17.11)
-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- When a rep completes a scored attempt at an assigned scenario, the manager who assigned it is told (to the
-- manager, about the rep). Dedupe: (recipient_id, type, session_id) has no session here, so session_id is null and
-- Postgres treats nulls as distinct — each attempt is its own alert, which is right: a second attempt is news.
-- Bell branch: NotificationBell.tsx (exhaustive switch). Read 0279 (the latest CHECK) first. Idempotent (§A12).
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
    'training_attempted'
  ));

comment on constraint manager_notifications_type_check on manager_notifications is
  'Closed set, and it points BOTH ways: strong_session / deal_closed / pattern_clip_disputed / feedback_requested / '
  'training_attempted go to managers, the rest to the rep they are about. A new type needs a migration extending '
  'this list, a decision about what it dedupes to, AND a branch in NotificationBell.tsx. See 0257, 0261-0263, 0279, 0283.';
