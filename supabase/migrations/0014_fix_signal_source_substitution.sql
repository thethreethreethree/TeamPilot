-- 0014 — Fix derive_signals_for_event template substitution
--
-- Why
-- ───
-- The substitution logic introduced in 0005 (and lightly extended in
-- 0012) used a hardcoded fallback chain: `coalesce(payload->>'task_id',
-- payload->>'meeting_id', payload->>'topic_id', payload->>'message_id',
-- ...)`. That ignored the key actually named in the template. For
-- task/meeting events it happened to be right (each event carries
-- exactly one of those ids). For chat events the payload carries BOTH
-- `topic_id` AND `message_id`, and the fallback picked topic_id first
-- — so a `chat.pinned` rule with template `chat_message:${payload.
-- message_id}` produced `chat_message:<topic_id>` in the signal row.
--
-- The §1.7 smoke-test of 0012 caught it on the first real pin.
--
-- Fix: parse the captured key name from the template and look up that
-- specific key from the payload. Supports multiple substitutions per
-- template via a loop over regexp_matches.

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
  v_match   text[];
  v_key     text;
  v_value   text;
begin
  select * into v_event from events where id = p_event_id;
  if not found then return; end if;

  for v_rule in
    select * from signal_sources
    where event_kind = v_event.kind
      and enabled = true
      and (predicate is null or v_event.payload @> predicate)
  loop
    v_source := v_rule.source_template;

    -- Walk every `${payload.<key>}` token in the template and replace
    -- each with the value at that exact key in the event's payload.
    -- Missing keys substitute to 'unknown' rather than silently picking
    -- some other id — that would re-introduce the 0005/0012 defect.
    for v_match in
      select regexp_matches(v_source, '\$\{payload\.([a-zA-Z0-9_]+)\}', 'g')
    loop
      v_key   := v_match[1];
      v_value := v_event.payload ->> v_key;
      v_source := replace(
        v_source,
        '${payload.' || v_key || '}',
        coalesce(v_value, 'unknown')
      );
    end loop;

    insert into signals (company_id, kind, source, payload, observed_at)
      values (
        v_event.company_id,
        v_rule.signal_kind,
        v_source,
        v_event.payload,
        v_event.occurred_at
      )
      returning id into v_signal;
    return next v_signal;
  end loop;
  return;
end;
$$;
