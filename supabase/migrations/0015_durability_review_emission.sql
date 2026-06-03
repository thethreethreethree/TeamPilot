-- 0015 — §3.5 durability review event emission
--
-- Why
-- ───
-- The 0012 close_topic flow emits `chat.topic_closed` with whatever
-- close_durability happens to be set at close time — which is almost
-- always NULL (durability is "filled when the close is reviewed for
-- §3.5 consequence measurement", per the 0010 comments). The signal
-- mappings in 0012 expect durability='held'/'reopened'/'partial', so a
-- bare close emits the event but produces no signal.
--
-- That's correct for the close action itself — the consequence has not
-- yet been judged. What was missing was the REVIEW action: someone
-- coming back later and saying "this stuck" or "this came back." That
-- review IS the §3.5 measurement; without it, the chain stops at
-- "closed" and never reaches the held-vs-reopened judgment that the
-- constitution requires as evidence the System is producing real
-- outcomes.
--
-- This migration:
--   1. Adds a trigger on chat_topics that emits a
--      `chat.topic_durability_reviewed` event whenever close_durability
--      transitions from NULL to a non-NULL value OR changes between
--      non-NULL values. The signal_sources mappings derive the
--      appropriate signal from the durability the reviewer picked.
--   2. Registers the three signal_sources rows.
--
-- Why a separate event kind (not re-emitting chat.topic_closed)
-- ─────────────────────────────────────────────────────────────
-- §3.1 events are append-only. Re-emitting `chat.topic_closed` would
-- imply the topic was closed twice, which is a lie. The review is its
-- own discrete action with its own audit trail; it earns its own kind.
--
-- Idempotency / replay
-- ────────────────────
-- If a reviewer changes their mind (e.g. from 'partial' to 'reopened'
-- after seeing more evidence), the trigger fires again and a new event
-- + new signal land. Both stay on the record per §3.1 — the timeline
-- shows the evolution. Querying for "the current durability" reads the
-- chat_topics row; querying for "what the team concluded over time"
-- reads the events.

create or replace function chat_topics_emit_durability_review()
returns trigger
language plpgsql
security invoker
as $$
declare
  v_event_id uuid;
begin
  -- Only fire when close_durability actually changes (including NULL→value).
  -- IS DISTINCT FROM handles the NULL comparison correctly; `=` doesn't.
  if NEW.close_durability is distinct from OLD.close_durability then
    insert into events (company_id, kind, subject, actor, payload, occurred_at)
    values (
      NEW.company_id,
      'chat.topic_durability_reviewed',
      'chat_topic:' || NEW.id::text,
      auth.uid(),
      jsonb_build_object(
        'topic_id', NEW.id,
        'close_durability', NEW.close_durability,
        'previous_durability', OLD.close_durability,
        'close_summary', NEW.close_summary
      ),
      now()
    )
    returning id into v_event_id;
    perform derive_signals_for_event(v_event_id);
  end if;
  return NEW;
end;
$$;

drop trigger if exists chat_topics_durability_review_trigger on chat_topics;
create trigger chat_topics_durability_review_trigger
  after update of close_durability on chat_topics
  for each row execute function chat_topics_emit_durability_review();

-- ─────────────────────────────────────────────────────────────────────
-- signal_sources for the new event kind
-- ─────────────────────────────────────────────────────────────────────
--
-- Mirrors the chat.topic_closed mappings from 0012 but binds to the
-- REVIEW event, which is what actually carries a non-NULL durability.
-- `unknown` does not earn a signal — it explicitly means "not yet a
-- consequence measurement," and signals must be earned (§3.2).

insert into signal_sources (event_kind, signal_kind, predicate, source_template, notes)
values
  ('chat.topic_durability_reviewed', 'resolution_held',
   '{"close_durability":"held"}'::jsonb,
   'chat_topic:${payload.topic_id}',
   '§3.5: a reviewer confirmed the resolution held.'),
  ('chat.topic_durability_reviewed', 'problem_recurrence',
   '{"close_durability":"reopened"}'::jsonb,
   'chat_topic:${payload.topic_id}',
   '§3.5: a reviewer confirmed the problem came back.'),
  ('chat.topic_durability_reviewed', 'partial_resolution',
   '{"close_durability":"partial"}'::jsonb,
   'chat_topic:${payload.topic_id}',
   '§3.5: a reviewer confirmed the resolution held only partially.')
on conflict do nothing;
