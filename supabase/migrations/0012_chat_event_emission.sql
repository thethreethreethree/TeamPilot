-- 0012 — Chat event emission + predicate-aware signal derivation
--
-- Why this exists
-- ──────────────
-- The §1.4 audit caught a real gap: chat actions (post / pin / close)
-- never entered the `events` table, so the §3.1 chain never accumulated
-- evidence from chat activity. Tasks emit events via 0006; chat had no
-- equivalent. This migration closes that loop.
--
-- It also extends `derive_signals_for_event` to evaluate the `predicate`
-- column on signal_sources (jsonb @> subset match). The column existed
-- in 0005 but was never read — meaning two different outcomes of the
-- same event kind (a topic closed as held vs reopened) couldn't be
-- routed to different signal kinds. Now they can.
--
-- What it does NOT do
-- ──────────────────
-- It does not make every chat message a signal. Routine posts emit
-- events for the audit timeline but produce no signal — only pinned
-- evidence and closed-topic outcomes earn signal status. §3.2: signals
-- must be earned, not assumed.
--
-- ─────────────────────────────────────────────────────────────────────
-- 1) Extend derive_signals_for_event with predicate evaluation
-- ─────────────────────────────────────────────────────────────────────
--
-- The original (0005) function looped over signal_sources matching by
-- event_kind alone. The `predicate` jsonb column was loaded but never
-- compared. We now compare with the @> jsonb subset operator: a rule's
-- predicate is satisfied when every key/value in the predicate appears
-- in the event's payload. Predicate NULL = "always matches" (matches
-- the existing task.*/meeting.* mappings, which all have predicate NULL).

create or replace function derive_signals_for_event(p_event_id uuid)
returns setof uuid
language plpgsql
security invoker
as $$
declare
  v_event   record;
  v_rule    record;
  v_source  text;
  v_signal  uuid;
begin
  select * into v_event from events where id = p_event_id;
  if not found then return; end if;

  for v_rule in
    select * from signal_sources
    where event_kind = v_event.kind
      and enabled = true
      -- Predicate NULL = no filter; otherwise the event payload must
      -- contain every key/value in the predicate.
      and (predicate is null or v_event.payload @> predicate)
  loop
    -- Render the source template. Falls back through known id keys.
    v_source := v_rule.source_template;
    v_source := regexp_replace(
      v_source,
      '\$\{payload\.([a-zA-Z0-9_]+)\}',
      coalesce(
        v_event.payload ->> 'task_id',
        v_event.payload ->> 'meeting_id',
        v_event.payload ->> 'topic_id',
        v_event.payload ->> 'message_id',
        v_event.payload ->> 'problem_id',
        'unknown'
      ),
      'g'
    );

    insert into signals (company_id, kind, source, payload, observed_at)
      values (v_event.company_id, v_rule.signal_kind, v_source, v_event.payload, v_event.occurred_at)
      returning id into v_signal;
    return next v_signal;
  end loop;
  return;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- 2) chat_messages → events
-- ─────────────────────────────────────────────────────────────────────
--
-- One trigger function covers all message kinds, but it deliberately
-- SKIPS kind='system' to avoid noise. System messages (e.g. "Topic
-- closed: ...") are already reflected as their semantic event (e.g.
-- chat.topic_closed) — emitting both would double-count.

create or replace function chat_messages_emit_events()
returns trigger
language plpgsql
security invoker
as $$
declare
  v_event_id uuid;
  v_kind     text;
begin
  -- Skip system messages — close_topic etc. emit their own semantic event.
  if NEW.kind = 'system' then
    return NEW;
  end if;

  -- Pick a stable event kind per message kind so signal_sources can
  -- target each independently (e.g. only the AI summaries, only voice).
  v_kind := case NEW.kind
    when 'summary' then 'chat.summary_posted'
    when 'voice' then 'chat.voice_posted'
    when 'attachment' then 'chat.attachment_posted'
    else 'chat.message_posted'
  end;

  insert into events (company_id, kind, subject, actor, payload, occurred_at)
  values (
    NEW.company_id,
    v_kind,
    'chat_message:' || NEW.id::text,
    NEW.author_id,
    jsonb_build_object(
      'topic_id', NEW.topic_id,
      'message_id', NEW.id,
      'ai_assisted', NEW.ai_assisted,
      'kind', NEW.kind
    ),
    NEW.created_at
  )
  returning id into v_event_id;

  perform derive_signals_for_event(v_event_id);
  return NEW;
end;
$$;

drop trigger if exists chat_messages_emit_events_trigger on chat_messages;
create trigger chat_messages_emit_events_trigger
  after insert on chat_messages
  for each row execute function chat_messages_emit_events();

-- ─────────────────────────────────────────────────────────────────────
-- 3) chat_pins → events
-- ─────────────────────────────────────────────────────────────────────
--
-- Pinning is the team explicitly flagging "this matters" — it earns a
-- signal. Unpinning is the reversal and emits an event for the timeline
-- but produces no signal (reversal is not problem evidence; the
-- original pin's signal stays on the record per §3.1 immutability).

create or replace function chat_pins_emit_events()
returns trigger
language plpgsql
security invoker
as $$
declare
  v_event_id uuid;
  v_company_id uuid;
  v_kind text;
  v_message_id uuid;
  v_topic_id uuid;
  v_actor uuid;
begin
  if TG_OP = 'INSERT' then
    v_message_id := NEW.message_id;
    v_topic_id   := NEW.topic_id;
    v_actor      := NEW.pinned_by;
    v_kind       := 'chat.pinned';
  else -- DELETE
    v_message_id := OLD.message_id;
    v_topic_id   := OLD.topic_id;
    v_actor      := auth.uid();  -- whoever is unpinning, if known
    v_kind       := 'chat.unpinned';
  end if;

  -- company_id lives on the topic, not the pin row. Look it up so the
  -- event lands on the right company partition for RLS / per-company
  -- queries.
  select company_id into v_company_id
    from chat_topics where id = v_topic_id;
  if v_company_id is null then
    -- Topic was deleted before we could resolve it (cascade scenario).
    -- Drop the event silently rather than fail the trigger.
    if TG_OP = 'INSERT' then return NEW; else return OLD; end if;
  end if;

  insert into events (company_id, kind, subject, actor, payload, occurred_at)
  values (
    v_company_id,
    v_kind,
    'chat_message:' || v_message_id::text,
    v_actor,
    jsonb_build_object(
      'topic_id', v_topic_id,
      'message_id', v_message_id
    ),
    now()
  )
  returning id into v_event_id;

  perform derive_signals_for_event(v_event_id);

  if TG_OP = 'INSERT' then return NEW; else return OLD; end if;
end;
$$;

drop trigger if exists chat_pins_emit_events_trigger on chat_pins;
create trigger chat_pins_emit_events_trigger
  after insert or delete on chat_pins
  for each row execute function chat_pins_emit_events();

-- ─────────────────────────────────────────────────────────────────────
-- 4) Update close_topic to ALWAYS emit a chat.topic_closed event
-- ─────────────────────────────────────────────────────────────────────
--
-- Previously close_topic only emitted `problem.resolved` (and only if
-- the topic was linked to a problem). Now we always emit
-- `chat.topic_closed` with the close_durability in the payload, so
-- signal_sources can route held/reopened/partial outcomes to distinct
-- signal kinds via predicate matching.
--
-- Note: close_durability is filled later in the close lifecycle (per
-- 0010 comments — "Filled when the close is reviewed for §3.5
-- consequence measurement"). At the moment of close it is NULL. We
-- emit a separate event for the durability update later — for now the
-- close itself fires with whatever durability state exists.

create or replace function close_topic(
  p_topic_id   uuid,
  p_summary    text
)
returns void
language plpgsql
security invoker
as $$
declare
  v_topic   chat_topics;
  v_user_id uuid := auth.uid();
  v_is_admin boolean;
  v_event_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_topic from chat_topics where id = p_topic_id;
  if v_topic.id is null then
    raise exception 'Topic not found';
  end if;

  select exists (
    select 1 from chat_participants
    where topic_id = p_topic_id
      and user_id = v_user_id
      and role = 'admin'
  ) or exists (
    select 1 from profiles
    where id = v_user_id
      and company_id = v_topic.company_id
      and role in ('CEO', 'COO', 'admin')
  ) into v_is_admin;

  if not v_is_admin then
    raise exception 'Only topic admins or company CEO/COO can close a topic';
  end if;

  if v_topic.status = 'closed' then
    raise exception 'Topic already closed';
  end if;

  insert into chat_messages (topic_id, company_id, author_id, kind, body)
  values (p_topic_id, v_topic.company_id, v_user_id, 'system',
          'Topic closed: ' || coalesce(p_summary, '(no summary)'));

  update chat_topics
     set status = 'closed',
         closed_at = now(),
         closed_by = v_user_id,
         close_summary = p_summary
   where id = p_topic_id;

  -- ALWAYS emit chat.topic_closed (new in 0012). signal_sources rows
  -- with predicate {close_durability: 'held'|'reopened'|...} route
  -- this single event kind to outcome-specific signal kinds. At close
  -- time durability is usually NULL — the durability-update event is
  -- a separate emit by a future review flow.
  insert into events (company_id, kind, subject, actor, payload)
  values (
    v_topic.company_id,
    'chat.topic_closed',
    'chat_topic:' || p_topic_id::text,
    v_user_id,
    jsonb_build_object(
      'topic_id', p_topic_id,
      'close_summary', p_summary,
      'close_durability', v_topic.close_durability,
      'linked_problem_id', v_topic.problem_id
    )
  )
  returning id into v_event_id;
  perform derive_signals_for_event(v_event_id);

  if v_topic.problem_id is not null then
    update problems
       set status = 'resolved',
           resolved_at = now()
     where id = v_topic.problem_id;
    perform record_event(
      'problem.resolved',
      'problem:' || v_topic.problem_id::text,
      jsonb_build_object(
        'problem_id', v_topic.problem_id,
        'closed_via_chat_topic', p_topic_id,
        'close_summary', p_summary
      )
    );
  end if;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- 5) signal_sources rows for chat events
-- ─────────────────────────────────────────────────────────────────────
--
-- A pin is the team's explicit "this matters" — high-confidence
-- evidence. It earns a signal regardless of context.
--
-- topic-closed with durability='held' is a resolution-durable signal —
-- direct §3.5 consequence measurement.
--
-- topic-closed with durability='reopened' is a problem-recurrence
-- signal — feeds the next §3.2 Understanding Gate cycle.
--
-- Routine posts / summary posts / unpins are events but not signals.

insert into signal_sources (event_kind, signal_kind, predicate, source_template, notes)
values
  ('chat.pinned', 'pinned_evidence', null,
   'chat_message:${payload.message_id}',
   'A team member pinned a message — explicit "this matters" flag.'),
  ('chat.topic_closed', 'resolution_held', '{"close_durability":"held"}'::jsonb,
   'chat_topic:${payload.topic_id}',
   '§3.5 consequence: a chat-driven resolution that held under review.'),
  ('chat.topic_closed', 'problem_recurrence', '{"close_durability":"reopened"}'::jsonb,
   'chat_topic:${payload.topic_id}',
   '§3.5 consequence: a chat-driven resolution that reopened.'),
  ('chat.topic_closed', 'partial_resolution', '{"close_durability":"partial"}'::jsonb,
   'chat_topic:${payload.topic_id}',
   '§3.5 consequence: a chat-driven resolution that held partially.')
on conflict do nothing;
