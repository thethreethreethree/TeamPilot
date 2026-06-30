-- 0076: scope chat topics to a product surface (Elostate vs Sales Coach).
--
-- WHY: the Sales Coach team chat must be SEPARATE from the Elostate main
-- chat (founder 2026-06-30) — each surface shows only its own topics. A
-- future "sync" can merge a company's Sales Coach topics into Elostate when
-- they consolidate to one system; this column is what makes that possible.
--
-- Additive + safe: existing topics default to 'elostate' (they ARE Elostate
-- topics), so no data moves and the Elostate chat is unchanged. The app
-- reads with a fallback to unscoped until this is applied, so nothing breaks
-- in the deploy-before-migration window.

alter table chat_topics
  add column if not exists scope text not null default 'elostate'
    check (scope in ('elostate', 'sales_coach'));

create index if not exists chat_topics_scope_idx
  on chat_topics (company_id, scope, created_at desc);

-- Recreate the counts view so `t.*` includes the new `scope` column.
-- chat_topic_with_counts is `select t.*`, expanded at view-creation, so it
-- won't include `scope` until recreated.
-- CRITICAL: re-apply security_invoker=true (0052/0071) — otherwise the view
-- runs as its owner (security_definer) and BYPASSES chat_topics RLS.
-- fetchTopics/fetchTopic read this view.
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
