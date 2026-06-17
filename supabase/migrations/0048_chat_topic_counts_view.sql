-- 0048 — Chat topic aggregate counts view.
--
-- Background — found in the system-wide audit (post-AMD-006
-- §1.5.2 proactive rule).
--
-- src/lib/data/chats.ts fetchTopics() returns ChatTopic rows with
-- participantCount: 0, messageCount: 0, lastMessageAt: null
-- HARDCODED at the data-layer mapping step. The /dashboard/chats
-- topic list page renders these values directly — every topic
-- shows "0 participants · 0 messages" regardless of actual
-- activity.
--
-- High-severity UX bug: users open the topic list, see what looks
-- like a dead workspace ("0 messages on everything"), and decide
-- the system is empty when it actually has real activity.
--
-- Root cause was likely scope-deferral when fetchTopics was
-- first wired — the counts were intended to come later but never
-- shipped. The data has always been queryable from the
-- chat_messages + chat_participants tables; just nobody plugged
-- the wires.
--
-- Approach
-- ────────
-- A SQL view that joins chat_topics with COUNT subqueries +
-- MAX(created_at) for last_message_at. The data layer queries
-- the view instead of the table; the response shape gains the
-- three real values without changing the TypeScript type
-- (participantCount / messageCount / lastMessageAt already
-- existed; they were just always zero).
--
-- Why a view (not denormalized counter columns):
--   - Schema additions to chat_topics would need triggers on
--     INSERT/DELETE of chat_messages and chat_participants to
--     maintain. Plus backfill. Plus race-condition handling.
--   - A view is a single SQL object — Postgres handles
--     aggregation correctly on every read, and PostgREST exposes
--     it as a queryable resource just like a table.
--   - Performance: chat tables are bounded per company; the
--     COUNT subqueries scan the indexed (topic_id) columns. Fine
--     until a single company has tens of thousands of topics
--     (well beyond pilot horizon).
--   - If performance becomes a concern, denormalized counters
--     can replace the view later without changing the data
--     layer's query shape (view becomes a column-set on the
--     table).
--
-- A12 idempotent: CREATE OR REPLACE VIEW.

create or replace view chat_topic_with_counts as
select
  t.*,
  (
    select count(*)::bigint
    from chat_participants p
    where p.topic_id = t.id
  ) as participant_count,
  (
    select count(*)::bigint
    from chat_messages m
    where m.topic_id = t.id
  ) as message_count,
  (
    select max(m.created_at)
    from chat_messages m
    where m.topic_id = t.id
  ) as last_message_at
from chat_topics t;

-- RLS — views inherit policies from their underlying tables, so
-- chat_topics' RLS applies. No additional policy needed: a caller
-- who can SELECT a chat_topics row via RLS can also SELECT the
-- corresponding view row. PostgREST recognizes the view via the
-- automatic GraphQL/REST exposure.
--
-- The view does NOT need to be added to the realtime publication;
-- realtime updates already fire on chat_messages and
-- chat_participants directly, and the data layer can refetch the
-- view when needed.

comment on view chat_topic_with_counts is
  'Aggregated chat_topics: adds participant_count, message_count, '
  'last_message_at derived from chat_participants and chat_messages. '
  'Used by lib/data/chats.ts fetchTopics() and fetchTopic() to '
  'replace the hardcoded zeros that previously made every topic '
  'look inactive.';
