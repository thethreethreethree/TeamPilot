-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 0262 — a bell a coaching note can actually ring
-- ═════════════════════════════════════════════════════════════════════════════════════════════
--
-- FOUNDER RULING 2026-09-22, picked over two cheaper options: a pattern-scoped bell.
--
-- The problem this solves is a dedupe key that does not fit. 0242's unique index is
--
--     (recipient_id, type, session_id)
--
-- and every writer since has upserted against it — `pitch_score_corrected` and the two recording
-- types all belong to a coaching SESSION. A pattern does not. With `session_id` null, Postgres
-- treats every row as distinct, so a manager writing three notes on one pattern in one sitting
-- would ring three separate bells and the rep would learn to ignore the icon.
--
-- The shipped alternative was to ring no bell at all, which left AWAITING REP REVIEW counting
-- reps who had never been told anything — a card that is honest about what it measures and
-- misleading about what a manager will infer from it.
--
-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- WHY A COLUMN AND NOT A PAYLOAD KEY
-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- `payload` already carries pattern ids for rendering. Deduping on a jsonb path would need an
-- expression index and would make the constraint invisible to anyone reading the table — and the
-- thing being enforced here is exactly the sort that gets quietly lost. A column with a foreign
-- key also means a deleted pattern takes its notifications with it, which a payload key cannot do.
--
-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- WHY THE NEW INDEX IS NOT PARTIAL
-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- A partial `where pattern_id is not null` would be tidier and is the wrong call here: PostgREST's
-- `on_conflict` emits the column list and no predicate, so Postgres cannot infer a partial index
-- and the upsert fails at runtime — green types, green tests, a 500 the first time a manager
-- writes a note. A plain unique index over the three columns is inferrable, and rows with a null
-- `pattern_id` do not collide with one another because Postgres treats nulls as distinct. That
-- null-distinctness is the same property 0242 already relies on, so nothing about the existing
-- three types changes.
--
-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- ONE TYPE FOR THREE ACTIONS
-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- `coached`, `drill_assigned` and a plain `note` all mean the same thing to the rep — *your
-- manager said something about this pattern* — and they are read in the same place. Three
-- notification types would put three rows in one bell for one conversation. The payload carries
-- which action it was, so the alert can word itself without the type multiplying.
--
-- Idempotent throughout (§A12): every object is `if not exists`, and the CHECK is dropped before
-- being re-added exactly as 0257 and 0261 did.
-- ═════════════════════════════════════════════════════════════════════════════════════════════

alter table manager_notifications
  add column if not exists pattern_id uuid references patterns(id) on delete cascade;

-- The upsert target for pattern-scoped alerts. See the header for why this is not partial.
create unique index if not exists manager_notifications_pattern_dedupe
  on manager_notifications (recipient_id, type, pattern_id);

alter table manager_notifications drop constraint if exists manager_notifications_type_check;
alter table manager_notifications
  add constraint manager_notifications_type_check
  check (type in (
    'strong_session',
    'deal_closed',
    'pitch_score_corrected',
    'recording_comment',
    'recording_share_requested',
    'pattern_coached'
  ));

comment on column manager_notifications.pattern_id is
  'Set only for pattern-scoped alerts. Null for every session-scoped type, which keeps 0242''s '
  '(recipient_id, type, session_id) index as their dedupe key and this one as the pattern types''.';

comment on constraint manager_notifications_type_check on manager_notifications is
  'Closed set. A new notification type needs a migration extending this list AND a decision about '
  'what it dedupes to — session_id for a session, pattern_id for a pattern. See 0257, 0261, 0262.';
