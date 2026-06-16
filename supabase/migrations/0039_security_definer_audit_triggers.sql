-- 0039 — Fix RLS rejection of audit-emitting triggers + harden
-- signal_sources RLS.
--
-- Root cause caught from a real user action: agent clicked Close
-- on a conversation, the divergence detector (see frontend
-- runAction) surfaced the actual Postgres error:
--
--   "new row violates row-level security policy for table
--    support_conversation_events"
--
-- What happened: the AFTER UPDATE trigger on support_conversations
-- (emit_support_conversation_event from 0035) fires inside the
-- agent's auth context. It tries to INSERT into
-- support_conversation_events to log the status_changed event.
-- That table has RLS enabled but only a SELECT policy — no INSERT
-- policy — so RLS rejects, the trigger raises, and the whole
-- transaction rolls back. Result: status DIDN'T change, but
-- without §1.6 divergence detection the UI silently reported
-- success.
--
-- Same shape on two more triggers:
--   - emit_support_tag_event (0035) — INSERTs to
--     support_conversation_events when a tag is added/removed
--   - schedule_support_durability_check (0036) — INSERTs to
--     support_durability_checks when a conversation is resolved
--
-- These are SYSTEM-emitted writes, not user-driven ones. The
-- standard Postgres pattern for system audit triggers is
-- SECURITY DEFINER: the function runs with the privileges of its
-- owner (the schema owner / superuser in Supabase's case), which
-- bypasses RLS the same way the service-role client does. The
-- caller still went through RLS to do the UPDATE on the parent
-- row; the trigger just records what happened.
--
-- The alternative — adding broad INSERT policies on the event
-- tables — would be wrong: the only writes that should land there
-- are the trigger's. Letting agents INSERT directly would let
-- them forge timeline events.
--
-- Bonus: signal_sources flagged by Supabase Security Advisor for
-- having RLS disabled while exposed via PostgREST. It's a system
-- config table (not tenant-scoped) so the right shape is RLS on +
-- read for all authenticated users + no write policies (mutation
-- via service role only). This isn't a security regression — the
-- table holds rule definitions, not customer data — but ticking
-- the Advisor clean keeps the signal-to-noise ratio honest.
--
-- A12 idempotent.

-- ─── 1. emit_support_conversation_event → SECURITY DEFINER ────
create or replace function emit_support_conversation_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
begin
  -- status_changed
  if new.status is distinct from old.status then
    insert into support_conversation_events (conversation_id, actor_id, actor_type, event_type, metadata)
    values (
      new.id, v_actor, case when v_actor is null then 'system' else 'agent' end,
      'status_changed',
      jsonb_build_object('from', old.status, 'to', new.status)
    );
  end if;

  -- claimed / unassigned
  if new.assigned_agent_id is distinct from old.assigned_agent_id then
    if new.assigned_agent_id is not null then
      insert into support_conversation_events (conversation_id, actor_id, actor_type, event_type, metadata)
      values (
        new.id, v_actor, 'agent',
        'claimed',
        jsonb_build_object('previous_agent_id', old.assigned_agent_id)
      );
    else
      insert into support_conversation_events (conversation_id, actor_id, actor_type, event_type, metadata)
      values (
        new.id, v_actor, 'agent',
        'unassigned',
        jsonb_build_object('previous_agent_id', old.assigned_agent_id)
      );
    end if;
  end if;

  -- priority_changed
  if new.priority is distinct from old.priority then
    insert into support_conversation_events (conversation_id, actor_id, actor_type, event_type, metadata)
    values (
      new.id, v_actor, 'agent',
      'priority_changed',
      jsonb_build_object('from', old.priority, 'to', new.priority)
    );
  end if;

  -- snooze / unsnooze
  if new.snoozed_until is distinct from old.snoozed_until then
    if new.snoozed_until is null then
      insert into support_conversation_events (conversation_id, actor_id, actor_type, event_type, metadata)
      values (new.id, v_actor, 'agent', 'unsnoozed', '{}'::jsonb);
    else
      insert into support_conversation_events (conversation_id, actor_id, actor_type, event_type, metadata)
      values (
        new.id, v_actor, 'agent',
        'snoozed',
        jsonb_build_object('until', new.snoozed_until)
      );
    end if;
  end if;

  return new;
end;
$$;

-- ─── 2. emit_support_tag_event → SECURITY DEFINER ─────────────
create or replace function emit_support_tag_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor    uuid := auth.uid();
  v_tag_name text;
begin
  if tg_op = 'INSERT' then
    select name into v_tag_name from support_tags where id = new.tag_id;
    insert into support_conversation_events (conversation_id, actor_id, actor_type, event_type, metadata)
    values (
      new.conversation_id, coalesce(new.added_by, v_actor), 'agent',
      'tag_added',
      jsonb_build_object('tag_id', new.tag_id, 'tag_name', v_tag_name)
    );
  elsif tg_op = 'DELETE' then
    select name into v_tag_name from support_tags where id = old.tag_id;
    insert into support_conversation_events (conversation_id, actor_id, actor_type, event_type, metadata)
    values (
      old.conversation_id, v_actor, 'agent',
      'tag_removed',
      jsonb_build_object('tag_id', old.tag_id, 'tag_name', v_tag_name)
    );
  end if;
  return null;
end;
$$;

-- ─── 3. schedule_support_durability_check → SECURITY DEFINER ──
create or replace function schedule_support_durability_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'resolved' and old.status is distinct from 'resolved' then
    insert into support_durability_checks (
      conversation_id, company_id, scheduled_for
    ) values (
      new.id, new.company_id, now() + interval '7 days'
    );
  end if;
  return new;
end;
$$;

-- Note: stamp_support_conversation_timestamps (0034) does NOT
-- need SECURITY DEFINER. It runs from AFTER INSERT on
-- support_messages — which on the customer-side path is the
-- service-role client (RLS bypassed) and on the agent-side path
-- is an agent who already has the RLS UPDATE policy on
-- support_conversations. Both paths reach the parent update
-- legitimately under existing policy.

-- ─── 4. signal_sources RLS hardening ──────────────────────────
-- Flagged by Supabase Security Advisor: table exposed to
-- PostgREST without RLS. It's system config (not tenant-scoped),
-- so the right shape is: RLS on, all authenticated users can
-- READ (they need to see the diagnosis rules), no WRITE policy
-- — mutations go through migrations or the service-role admin.
alter table signal_sources enable row level security;

drop policy if exists "signal_sources - read" on signal_sources;
create policy "signal_sources - read" on signal_sources
  for select using (auth.uid() is not null);

comment on policy "signal_sources - read" on signal_sources is
  'Signal sources are system-wide diagnosis rules, not tenant
   data. Any authenticated user can read them; writes only
   happen via migration or service-role admin.';
