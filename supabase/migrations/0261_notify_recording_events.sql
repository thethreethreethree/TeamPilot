-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 0261 — two more notification types for the Recordings tab
-- ═════════════════════════════════════════════════════════════════════════════════════════════
--
-- Guide Step 4 items 6 and 7 both END AT THE REP:
--
--     "Save and send to rep" notifies the rep and shows the comment in their Pitch detail.
--     "Save as team example" needs the rep's permission before other reps can hear it.
--
-- Neither can be delivered without a type the CHECK accepts. 0257 narrowed the constraint to
-- three values and left a comment saying a new type must extend it — this is that extension, and
-- the reason the constraint is worth its friction: a route inserting 'recording_comment' today
-- would 500 at the database with the comment already saved, which is the A34 shape (code
-- hard-requiring an unapplied migration) pointed at a CHECK instead of a table.
--
-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- WHAT THE DEDUPE INDEX MEANS FOR THESE TWO
-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- 0242's unique index is (recipient_id, type, session_id), so both of these upsert-UPDATE the
-- same way `pitch_score_corrected` does: ONE live alert per pitch per rep, refreshed and marked
-- unread again each time. A manager who leaves four comments on one recording sends one "your
-- manager commented on this pitch" that keeps moving to the top — not four bells for one sitting.
--
-- That is deliberate for comments and it is the right shape for the share request too, because a
-- second ask about the same recording is the same question, not a new one.
--
-- Idempotent (§A12): drop-then-add, as 0257 did.
-- ═════════════════════════════════════════════════════════════════════════════════════════════

alter table manager_notifications drop constraint if exists manager_notifications_type_check;
alter table manager_notifications
  add constraint manager_notifications_type_check
  check (type in (
    'strong_session',
    'deal_closed',
    'pitch_score_corrected',
    'recording_comment',
    'recording_share_requested'
  ));

comment on constraint manager_notifications_type_check on manager_notifications is
  'Closed set. A new notification type needs a migration extending this list AND a decision about '
  'what (recipient_id, type, session_id) dedupes to for it — see 0257 and 0261.';
