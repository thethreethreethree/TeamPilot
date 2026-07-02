-- 0081: fix chat RLS infinite recursion (42P17) on chat_participants.
--
-- ROOT CAUSE (diagnosed 2026-07-03 from the live error "42P17: infinite
-- recursion detected in policy for relation chat_participants"):
--
--   - Migration 0071 recreated the chat_topics SELECT policy to check topic
--     membership INLINE:
--        ... or exists (select 1 from chat_participants p
--                       where p.topic_id = chat_topics.id and ...)
--   - The chat_participants SELECT policy (0010) checks access by querying
--     chat_topics:
--        exists (select 1 from chat_topics t
--                where t.id = chat_participants.topic_id and ...)
--
--   => Reading chat_topics evaluates its policy, which queries
--      chat_participants, which evaluates ITS policy, which queries
--      chat_topics, ... Postgres raises 42P17 and EVERY chat read fails. This
--      is the outage that presented as "my previous chats are gone" — the rows
--      were always intact; the DB simply refused to evaluate the looping policy.
--
-- FIX: break the cycle the same way 0033 broke it for the admin check — a
-- SECURITY DEFINER helper that reads chat_participants WITHOUT triggering its
-- RLS. Rewrite the chat_topics SELECT policy to call the helper instead of the
-- inline subquery. Visibility is IDENTICAL to 0071 (company members see
-- unlocked topics; a locked topic is visible only to its active participants) —
-- only the recursion is removed. chat_participants / chat_messages SELECT are
-- unchanged: with chat_topics no longer evaluating chat_participants RLS, their
-- existing checks terminate (…→ chat_topics → is_topic_participant (definer) →
-- stop).
--
-- A12 idempotent: create-or-replace function, drop-policy-if-exists.
-- Data-safe: touches only a function + a policy, never a row.

-- ─── Helper: is_topic_participant(topic_id) — security definer ─────
-- Mirrors is_topic_admin() (0033). security definer + fixed search_path so the
-- membership read does NOT re-enter chat_participants RLS (which is what loops).
create or replace function is_topic_participant(p_topic_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from chat_participants
    where topic_id = p_topic_id
      and user_id = auth.uid()
      and left_at is null
  );
$$;

comment on function is_topic_participant(uuid) is
  'RLS helper (security definer). True when the calling user is an ACTIVE
   participant of the topic. Reads chat_participants WITHOUT triggering its
   RLS, breaking the chat_topics <-> chat_participants SELECT recursion (42P17)
   that 0071''s inline membership check reintroduced.';

-- ─── Rewrite chat_topics SELECT to use the helper (no recursion) ───
drop policy if exists "chat_topics - select" on chat_topics;
create policy "chat_topics - select" on chat_topics
  for select using (
    company_id = auth_company_id()
    and (
      locked = false
      or is_topic_participant(id)
    )
  );
