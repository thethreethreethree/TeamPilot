-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 0263 — a rep flagging a clip reaches a manager
-- ═════════════════════════════════════════════════════════════════════════════════════════════
--
-- FOUNDER RULING 2026-09-22: do it now rather than bundling it.
--
-- `clip_disputed` has been a valid `pattern_events` kind since 0258 and the rep's button shipped
-- this morning. It writes a row a manager sees only if they happen to open that pattern again.
--
-- WHY THIS ONE IS NOT COSMETIC. Every number in Pattern Interrupt descends from an LLM reading a
-- recording, and "this clip looks wrong" is the ONLY channel the product has for the scorer being
-- wrong about a specific moment. A rep who flags something and hears nothing back learns not to
-- flag — which does not remove the disagreement, it removes the evidence of it, and leaves the
-- board looking more reliable than it is. A11 is the clause: the system mirrors rather than
-- judges, and a mirror a rep cannot dispute is a judge.
--
-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- THE DIRECTION IS THE INTERESTING PART
-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- Every notification type added today points AT the rep: a correction, a comment, a share
-- request, a coaching note. This one points back. `manager_notifications` was built for exactly
-- this direction (0242) and its recipient resolution already exists — a "manager" is any company
-- admin or sales-coach admin, because there is no per-agent manager FK, so the alert fans out.
--
-- That fan-out is why this needs its own type rather than reusing `pattern_coached`: the same
-- pattern can carry a rep's dispute AND a manager's coaching at once, and they go to different
-- people. One type would make them collide on the dedupe key and silently overwrite each other.
--
-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- THE DEDUPE KEY ALREADY EXISTS
-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- 0262 added `pattern_id` and the unique index over `(recipient_id, type, pattern_id)`. This type
-- reuses both, so a rep who flags two clips on one pattern sends each manager ONE live alert that
-- refreshes — not one per clip. That is the right shape here: the manager's action is to open the
-- pattern and read the disputes, and they only need to be told once that there are some.
--
-- Idempotent (§A12): drop-then-add, as 0257, 0261 and 0262 did.
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
    'pattern_clip_disputed'
  ));

comment on constraint manager_notifications_type_check on manager_notifications is
  'Closed set, and it points BOTH ways: strong_session / deal_closed / pattern_clip_disputed go '
  'to managers, the rest to the rep they are about. A new type needs a migration extending this '
  'list, a decision about what it dedupes to (session_id or pattern_id), AND a branch in '
  'NotificationBell.tsx — whose switch is exhaustive, so a missing branch is a compile error '
  'rather than a wrong sentence in someone''s bell. See 0257, 0261, 0262, 0263.';
