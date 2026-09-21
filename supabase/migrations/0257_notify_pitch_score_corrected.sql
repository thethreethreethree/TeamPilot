-- 0257 — tell the REP when a manager corrects their Pitch Score
--
-- WHY. The override feature shipped earlier today: a manager can correct one item on a scored
-- pitch, the score recomputes, and the rep can read the correction and its reason on their own
-- pitch detail. Nothing tells them it happened. A rep only finds out if they reopen that pitch.
--
-- That is the quieter version of the exact lesson overrides exist to stop teaching. The dispute
-- loop was built because "you're right" followed by an unchanged number teaches a rep that
-- disputing is theatre; a number that changes and is never mentioned teaches the same thing more
-- slowly. It also breaks worst in the case the feature was most proud of — a manager listening
-- back and correcting a pitch NOBODY disputed, which is precisely the correction a rep would
-- otherwise never learn about.
--
-- REUSING manager_notifications, and the name is now wrong. The table from 0242 is structurally
-- generic: company_id, recipient_id, agent_id, type, payload, read_at, with RLS granting
-- `recipient_id = auth.uid()`. Only its NAME and its type CHECK are manager-specific. A rep as
-- recipient needs neither a new table nor a new bell — NotificationBell already reads whatever the
-- caller is the recipient of.
--
-- Renaming the table to `notifications` would be the tidier change and is NOT made here: it has
-- run in production, it is read by a route, a component and a realtime subscription, and renaming
-- it to make a comment accurate is a large blast radius for a cosmetic gain. The honest fix is to
-- say so here, which is what this paragraph is.

alter table manager_notifications drop constraint if exists manager_notifications_type_check;
alter table manager_notifications
  add constraint manager_notifications_type_check
  check (type in ('strong_session', 'deal_closed', 'pitch_score_corrected'));

-- ── The dedupe index has to mean something different for this type ──────────────────────────
--
-- 0242's unique index is (recipient_id, type, session_id), and the writer upserts with
-- ignoreDuplicates so a re-fire is a no-op. That is right for 'strong_session': the same session
-- is strong once, and a retry must not notify twice.
--
-- It is WRONG for a correction. A manager can correct two different items on one pitch, minutes
-- apart, and the rep must be told the second time — under ignore-on-conflict they would silently
-- not be. The index is kept (it is what makes one row per pitch per rep possible at all) and the
-- writer for this type upserts with an UPDATE instead: same row, refreshed timestamp, read_at
-- cleared, payload carrying the latest total. The rep sees one "your score was corrected" item
-- that becomes unread again rather than a pile of them.
--
-- No schema change is needed for that — it is a property of how the writer calls upsert — but it
-- is recorded here because the index and the writer only make sense read together, and the next
-- person to touch either will read this file.

comment on constraint manager_notifications_type_check on manager_notifications is
  'strong_session and deal_closed go to MANAGERS (0242). pitch_score_corrected goes to the REP whose score moved (0257) — the table name predates that and is now narrower than its contents.';
