-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 0279 — manager_notifications gains 'feedback_requested' (RSS Phase 4)
-- ═════════════════════════════════════════════════════════════════════════════════════════════
--
-- A rep's "Request feedback" (0278) that rang no bell would sit in an inbox the manager has no reason to open —
-- a request that reaches nobody. So the request notifies: the named manager (the rep's manager_id), or, when the
-- rep has none, every manager the alert fan-out already uses (src/lib/coach/gamification/notify.ts).
--
-- Dedupe: the existing (recipient_id, type, session_id) index — a second request on the same call refreshes the
-- one alert instead of stacking. Bell branch: NotificationBell.tsx (its switch is exhaustive; 0263's comment).
-- Own migration, after reading the latest CHECK (0263), as docs/rss/docs/07-BUILD-ORDER.md asks.
-- Idempotent (§A12): drop-then-add, as 0257, 0261, 0262 and 0263 did.
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
    'feedback_requested'
  ));

comment on constraint manager_notifications_type_check on manager_notifications is
  'Closed set, and it points BOTH ways: strong_session / deal_closed / pattern_clip_disputed / feedback_requested '
  'go to managers, the rest to the rep they are about. A new type needs a migration extending this list, a '
  'decision about what it dedupes to (session_id or pattern_id), AND a branch in NotificationBell.tsx — whose '
  'switch is exhaustive. See 0257, 0261, 0262, 0263, 0279.';
