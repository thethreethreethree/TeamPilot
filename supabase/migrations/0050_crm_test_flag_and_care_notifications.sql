-- 0050 — CRM test-account flag + C.A.R.E notification event emission.
--
-- Two related-but-independent changes:
--
-- (1) CRM is_test_account flag
--     Per founder direction: distinguish test signups (the founder's
--     own QA accounts) from real customer accounts so the metrics
--     aren't polluted. Defaults to false — every account is
--     production-by-default (honest). The founder marks test rows
--     manually. List filters exclude test accounts unless explicitly
--     shown.
--
-- (2) C.A.R.E notification events
--     Per AMD-006 §1.5.1 L3 — compose with the existing events-chain
--     notification pipeline at /api/notifications. Emit four kinds:
--       • care.conversation.message_added (customer messaging in)
--       • care.conversation.assigned (assignment change)
--       • care.conversation.guidance_requested (supervisor needed)
--       • care.conversation.durability_due (7-day re-review fires)
--
--     These flow through the same chain the rest of the System uses;
--     the notifications aggregator filters/targets per-user in JS.

-- ─────────────────────────────────────────────────────────────
-- Part 1 — CRM is_test_account
-- ─────────────────────────────────────────────────────────────
alter table crm_accounts
  add column if not exists is_test_account boolean not null default false;

create index if not exists crm_accounts_is_test_idx
  on crm_accounts (is_test_account);

-- Patch the view to expose the flag so the list can filter.
create or replace view crm_account_summary as
select
  a.id,
  a.company_id,
  c.name as company_name,
  a.lifecycle_stage,
  a.source,
  a.account_owner_user_id,
  a.health_score,
  a.industry,
  a.size_bracket,
  a.region,
  a.primary_contact_email,
  a.billing_status,
  a.is_test_account,
  a.created_at,
  a.updated_at,
  (select count(*)::int from crm_contacts ct where ct.account_id = a.id) as contact_count,
  (select count(*)::int from crm_notes n where n.account_id = a.id) as note_count,
  (
    select s.status from crm_subscriptions s
    where s.account_id = a.id
    order by s.created_at desc
    limit 1
  ) as subscription_status,
  (
    select s.plan from crm_subscriptions s
    where s.account_id = a.id
    order by s.created_at desc
    limit 1
  ) as subscription_plan,
  (
    select max(created_at) from crm_activity_events e where e.account_id = a.id
  ) as last_activity_at
from crm_accounts a
join companies c on c.id = a.company_id;

-- ─────────────────────────────────────────────────────────────
-- Part 2 — C.A.R.E notification events
--
-- Helper: emit a chain event row from a SECURITY DEFINER trigger
-- without going through the application layer. Mirrors the
-- pattern used by other SECURITY DEFINER trigger functions in
-- migrations 0034/0036/0039.
--
-- Per CLAUDE.md §3.1 the events table is append-only and the
-- source of truth for cross-module notifications. The
-- notifications aggregator (/api/notifications) reads from it.
-- ─────────────────────────────────────────────────────────────

-- (a) message_added — a new customer message lands in a conversation
create or replace function emit_care_message_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conv support_conversations%rowtype;
begin
  -- Only emit for customer-authored messages on non-internal posts.
  -- Agent/AI/system messages don't need to notify agents.
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
      'assigned_agent_id', v_conv.assigned_to,
      'status', v_conv.status,
      'priority', v_conv.priority,
      'customer_id', v_conv.customer_id,
      'message_id', new.id,
      -- A trimmed preview so the notification panel can render
      -- without a second DB roundtrip per row. 200 chars max.
      'preview', left(new.body, 200)
    ),
    new.created_at
  );

  return new;
end;
$$;

drop trigger if exists support_messages_emit_notification on support_messages;
create trigger support_messages_emit_notification
  after insert on support_messages
  for each row execute function emit_care_message_event();

-- (b) assigned — assignment changes (claim, reassign, unclaim)
create or replace function emit_care_assignment_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.assigned_to is not distinct from new.assigned_to then
    return new;
  end if;

  insert into events (
    company_id, actor, kind, subject, payload, occurred_at
  ) values (
    new.company_id,
    coalesce(new.assigned_to, '00000000-0000-0000-0000-000000000000'::uuid),
    'care.conversation.assigned',
    'support_conversation:' || new.id::text,
    jsonb_build_object(
      'conversation_id', new.id,
      'previous_agent_id', old.assigned_to,
      'new_agent_id', new.assigned_to,
      'status', new.status,
      'priority', new.priority,
      'subject', new.subject
    ),
    now()
  );

  return new;
end;
$$;

drop trigger if exists support_conversations_emit_assignment on support_conversations;
create trigger support_conversations_emit_assignment
  after update on support_conversations
  for each row execute function emit_care_assignment_event();

-- (c) guidance_requested — the supervisor guidance flag flips on
create or replace function emit_care_guidance_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Fire ONLY on the transition from null → set. Clearing it
  -- (re-resolution etc.) doesn't notify.
  if old.supervisor_guidance_requested_at is not null
     or new.supervisor_guidance_requested_at is null then
    return new;
  end if;

  insert into events (
    company_id, actor, kind, subject, payload, occurred_at
  ) values (
    new.company_id,
    coalesce(new.assigned_to, '00000000-0000-0000-0000-000000000000'::uuid),
    'care.conversation.guidance_requested',
    'support_conversation:' || new.id::text,
    jsonb_build_object(
      'conversation_id', new.id,
      'requested_by_agent_id', new.assigned_to,
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

drop trigger if exists support_conversations_emit_guidance on support_conversations;
create trigger support_conversations_emit_guidance
  after update on support_conversations
  for each row execute function emit_care_guidance_event();

-- (d) durability_due — fires when a check's scheduled_for becomes
-- 'due' (the agent's expected re-review window has passed and the
-- check has NOT been recorded yet). Pure event, not a derived state.
-- Inserted by the application layer via a periodic sweep; this
-- migration provides the helper function for the sweep to call.
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

  -- Dedup: don't emit twice for the same check.
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
    '00000000-0000-0000-0000-000000000000'::uuid,
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

-- ─────────────────────────────────────────────────────────────
-- End migration 0050.
-- The application layer (next commits) will:
--   • update fetchCareCommandStats to honor is_test_account
--   • add the new kinds to /api/notifications kinds[] filter
--   • add C.A.R.E-specific targeting logic in the aggregator
--   • add a periodic sweep that calls emit_care_durability_due_event
--     for each due-but-unchecked durability check
-- ─────────────────────────────────────────────────────────────
