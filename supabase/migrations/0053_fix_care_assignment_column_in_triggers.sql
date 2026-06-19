-- 0053 — fix three trigger functions in 0050 that referenced a
-- non-existent column `assigned_to` on support_conversations.
--
-- Root cause
-- ──────────
-- Migration 0034 named the assignment column `assigned_agent_id`.
-- Migration 0050 wrote three trigger functions that referenced
-- `assigned_to` instead — a plain typo. The trigger functions
-- deploy fine (PL/pgSQL doesn't bind column references until the
-- function actually executes) but the FIRST customer message
-- insert after deploy hits emit_care_message_event(), the
-- record-field lookup fails, and the whole INSERT rolls back.
--
-- Surface: every Jeff send returned 500 with
-- `record "v_conv" has no field "assigned_to"`. The widget showed
-- "Couldn't send. Please try again." with no message ever landing
-- in the agent inbox because the message insert was aborted by
-- the trigger.
--
-- Constitutional sources consulted
-- ────────────────────────────────
--   §1.2 — the diagnosis came from the trail: Vercel function
--   log `[care.postCustomerMessage] error=record "v_conv" has no
--   field "assigned_to"`. Looking BACKWARD at the record gave
--   us the column name; grepping the migrations gave us where it
--   was supposed to be `assigned_agent_id`.
--   §A12 — every redefinition is idempotent (CREATE OR REPLACE
--   on functions, DROP/CREATE on triggers).
--
-- The fourth function in 0050 (emit_care_durability_due_event)
-- doesn't reference assignment columns and is left alone.

-- ─── (a) message_added ────────────────────────────────────────
create or replace function emit_care_message_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conv support_conversations%rowtype;
begin
  if new.author_type <> 'customer' or new.is_internal_note then
    return new;
  end if;

  select * into v_conv
  from support_conversations
  where id = new.conversation_id;
  if v_conv.id is null then
    return new;
  end if;

  insert into events (
    company_id, actor, kind, subject, payload, occurred_at
  ) values (
    v_conv.company_id,
    coalesce(new.author_id, '00000000-0000-0000-0000-000000000000'::uuid),
    'care.conversation.message_added',
    'support_conversation:' || v_conv.id::text,
    jsonb_build_object(
      'conversation_id', v_conv.id,
      'assigned_agent_id', v_conv.assigned_agent_id,
      'status', v_conv.status,
      'priority', v_conv.priority,
      'customer_id', v_conv.customer_id,
      'message_id', new.id,
      'preview', left(new.body, 200)
    ),
    new.created_at
  );

  return new;
end;
$$;

-- ─── (b) assignment changed ──────────────────────────────────
create or replace function emit_care_assignment_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.assigned_agent_id is not distinct from new.assigned_agent_id then
    return new;
  end if;

  insert into events (
    company_id, actor, kind, subject, payload, occurred_at
  ) values (
    new.company_id,
    coalesce(new.assigned_agent_id, '00000000-0000-0000-0000-000000000000'::uuid),
    'care.conversation.assigned',
    'support_conversation:' || new.id::text,
    jsonb_build_object(
      'conversation_id', new.id,
      'previous_agent_id', old.assigned_agent_id,
      'new_agent_id', new.assigned_agent_id,
      'status', new.status,
      'priority', new.priority,
      'subject', new.subject
    ),
    now()
  );

  return new;
end;
$$;

-- ─── (c) supervisor guidance requested ───────────────────────
create or replace function emit_care_guidance_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.supervisor_guidance_requested_at is not null
     or new.supervisor_guidance_requested_at is null then
    return new;
  end if;

  insert into events (
    company_id, actor, kind, subject, payload, occurred_at
  ) values (
    new.company_id,
    coalesce(new.assigned_agent_id, '00000000-0000-0000-0000-000000000000'::uuid),
    'care.conversation.guidance_requested',
    'support_conversation:' || new.id::text,
    jsonb_build_object(
      'conversation_id', new.id,
      'requested_by_agent_id', new.assigned_agent_id,
      'status', new.status,
      'priority', new.priority,
      'subject', new.subject,
      'requested_at', new.supervisor_guidance_requested_at
    ),
    now()
  );

  return new;
end;
$$;

-- ─── End migration 0053. ─────────────────────────────────────
