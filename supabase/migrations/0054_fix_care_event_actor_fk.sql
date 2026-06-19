-- 0054 — drop the bad zero-UUID fallback in 0050's care event
-- trigger functions. Use NULL instead, which is what the schema
-- always allowed.
--
-- Root cause
-- ──────────
-- 0050's trigger functions emit rows into `events`. They set
-- `actor` via:
--     coalesce(new.author_id, '00000000-0000-0000-0000-000000000000'::uuid)
--     coalesce(new.assigned_agent_id, '00000000-...'::uuid)
--     '00000000-...'::uuid  (in the durability_due helper)
--
-- The intent was "fall back to a sentinel UUID when the message
-- has no human author" — typical for customer messages (the
-- visitor isn't an auth.users row) and for system-emitted events
-- (no acting agent).
--
-- BUT `events.actor` (from 0004) is defined as:
--     actor uuid references auth.users(id) on delete set null,
--
-- The zero UUID isn't a real auth.users row, so the FK fails on
-- every customer message. The column was already nullable (the
-- `on delete set null` tells us so) — NULL was the right
-- "no actor" value all along.
--
-- Surface: every Jeff send still failed after 0053 with
--   "violates foreign key constraint events_actor_fkey"
-- because the trigger DID execute (good, 0053 fixed the typo)
-- but the actor coalesce produced an FK-violating UUID.
--
-- Constitutional sources consulted
-- ────────────────────────────────
--   §1.2 — diagnosis from the trail. Vercel log →
--   `events_actor_fkey` → grep events table definition → 0004
--   shows `references auth.users(id) on delete set null`.
--   The column was always nullable; the zero UUID was a
--   workaround for an imagined NOT NULL.
--   §A12 — CREATE OR REPLACE keeps the migration idempotent.

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
    new.author_id,
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
    new.assigned_agent_id,
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
    new.assigned_agent_id,
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

-- ─── (d) durability_due ──────────────────────────────────────
create or replace function emit_care_durability_due_event(
  p_check_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_check support_durability_checks%rowtype;
  v_conv  support_conversations%rowtype;
begin
  select * into v_check from support_durability_checks where id = p_check_id;
  if v_check.id is null or v_check.checked_at is not null then
    return;
  end if;
  select * into v_conv from support_conversations where id = v_check.conversation_id;
  if v_conv.id is null then
    return;
  end if;

  if exists (
    select 1 from events e
    where e.kind = 'care.conversation.durability_due'
      and e.subject = 'support_conversation:' || v_conv.id::text
      and (e.payload->>'check_id')::uuid = v_check.id
  ) then
    return;
  end if;

  insert into events (
    company_id, actor, kind, subject, payload, occurred_at
  ) values (
    v_conv.company_id,
    null,
    'care.conversation.durability_due',
    'support_conversation:' || v_conv.id::text,
    jsonb_build_object(
      'check_id', v_check.id,
      'conversation_id', v_conv.id,
      'resolution_id', v_check.resolution_id,
      'scheduled_for', v_check.scheduled_for,
      'subject', v_conv.subject,
      'captured_by_agent_id', v_check.captured_by
    ),
    now()
  );
end;
$$;

-- ─── End migration 0054. ─────────────────────────────────────
