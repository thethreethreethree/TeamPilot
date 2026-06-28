-- 0071_chat_topic_lock.sql
--
-- Team Chat — lockable 2-person topics (founder request 2026-06-28).
-- The CREATOR of a 2-person topic can LOCK it: after that, no one else
-- can join ("enter") and no other HUMAN — not even a company admin —
-- can view the topic or its context. Decisions on the record:
--
--   - Hidden from all humans incl. admins (founder choice 2026-06-28).
--     Enforced by RLS with NO admin exception.
--   - The SYSTEM still reads it (founder choice): the AI coach +
--     diagnosis run via the service-role client, which bypasses RLS, so
--     no change is needed for the System to keep its visibility. The
--     lock UI DISCLOSES this (§A10 — no shadow read).
--   - §3.1: the lock restricts ACCESS only. It does NOT delete or alter
--     any message/event — the append-only history stays fully intact.
--     Unlocking re-exposes the topic's existence (messages were always
--     participant-only anyway).
--
-- Idempotent (§A12): add-column-if-not-exists, create-or-replace,
-- drop-policy-if-exists.

alter table chat_topics
  add column if not exists locked boolean not null default false;
alter table chat_topics
  add column if not exists locked_at timestamptz;

-- ─── Topic visibility: locked topics are participant-only ──────────
-- Was company-wide (everyone saw every topic exists). Now: unlocked
-- topics stay company-wide (unchanged); LOCKED topics are visible only
-- to their active participants — no admin exception (founder choice).
drop policy if exists "chat_topics - select" on chat_topics;
create policy "chat_topics - select" on chat_topics
  for select using (
    company_id = auth_company_id()
    and (
      locked = false
      or exists (
        select 1 from chat_participants p
        where p.topic_id = chat_topics.id
          and p.user_id = auth.uid()
          and p.left_at is null
      )
    )
  );

-- ─── No entry into a locked topic ──────────────────────────────────
-- A trigger rejects any new participant on a locked topic, regardless
-- of which RLS path the insert takes. (Locking happens AFTER the two
-- participants exist, so this only blocks FUTURE additions.)
create or replace function reject_participant_on_locked_topic()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1 from chat_topics t
    where t.id = new.topic_id and t.locked
  ) then
    raise exception 'Cannot add a participant to a locked topic';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_reject_participant_on_locked on chat_participants;
create trigger trg_reject_participant_on_locked
  before insert on chat_participants
  for each row execute function reject_participant_on_locked_topic();

-- ─── Recreate the counts view so it exposes `locked` ───────────────
-- chat_topic_with_counts is `select t.*`, but t.* is expanded at view
-- creation, so it won't include the new `locked` column until recreated.
-- CRITICAL: re-apply security_invoker=true (0052) — otherwise the view
-- runs as its owner (security_definer) and BYPASSES the locked-topic RLS
-- above, leaking locked topics. fetchTopics/fetchTopic read this view.
drop view if exists chat_topic_with_counts;
create view chat_topic_with_counts as
select
  t.*,
  (
    select count(*)::bigint from chat_participants p where p.topic_id = t.id
  ) as participant_count,
  (
    select count(*)::bigint from chat_messages m where m.topic_id = t.id
  ) as message_count,
  (
    select max(m.created_at) from chat_messages m where m.topic_id = t.id
  ) as last_message_at
from chat_topics t;
alter view chat_topic_with_counts set (security_invoker = true);
