-- 0035 — Care operational depth (Sprint 3, part A).
--
-- Extends the Sprint 1 foundation with the schema a competitive
-- support platform needs:
--   - Tags (categorize conversations: billing, bug, feature-request,
--     etc.) — per-company palette
--   - Priority (urgent / high / normal / low)
--   - Snooze (hide a conversation from the active inbox until a
--     specific time)
--   - Customer enrichment (phone, lifetime value, signup date,
--     last_seen — the data agents need to give context-aware
--     responses)
--   - Conversation event timeline (every state change, assignment,
--     tag add/remove, snooze, etc.) — the "audit log" surface that
--     makes support tools feel like real products
--   - Canned responses (per-company templates the agent can drop
--     into a reply with a shortcut)
--   - SLA first-response target per conversation
--
-- A12 idempotent: every alter / create / drop uses if-(not-)exists.

-- ─── Tags ──────────────────────────────────────────────────────
create table if not exists support_tags (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  name        text not null,
  -- Limited color palette so the UI stays readable. Maps to
  -- Tailwind tone tokens in src/lib/care/tagColors.ts.
  color       text not null default 'gray'
              check (color in ('gray', 'blue', 'emerald', 'amber', 'red', 'violet', 'pink', 'arc')),
  created_at  timestamptz not null default now(),
  unique (company_id, name)
);

create index if not exists support_tags_company_idx
  on support_tags (company_id);

create table if not exists support_conversation_tags (
  conversation_id  uuid not null references support_conversations(id) on delete cascade,
  tag_id           uuid not null references support_tags(id) on delete cascade,
  added_by         uuid references profiles(id) on delete set null,
  added_at         timestamptz not null default now(),
  primary key (conversation_id, tag_id)
);

create index if not exists support_conversation_tags_tag_idx
  on support_conversation_tags (tag_id);

-- ─── Conversation columns: priority, snooze, SLA target ────────
alter table support_conversations
  add column if not exists priority text not null default 'normal'
    check (priority in ('urgent', 'high', 'normal', 'low'));

alter table support_conversations
  add column if not exists snoozed_until timestamptz;

alter table support_conversations
  add column if not exists sla_first_response_minutes int not null default 30;

-- A snooze that's passed becomes invisible to the "Snoozed" filter
-- and visible again in normal views. We don't auto-unset the
-- column — the readout history matters — we just compare against
-- now() in queries.

create index if not exists support_conversations_priority_idx
  on support_conversations (priority, last_message_at desc)
  where status in ('open', 'in_conversation', 'awaiting_customer');

create index if not exists support_conversations_snoozed_idx
  on support_conversations (snoozed_until)
  where snoozed_until is not null;

-- ─── Customer enrichment ──────────────────────────────────────
-- Optional data the business wants to surface in the customer
-- panel next to the conversation. metadata stays as the flexible
-- catch-all; these are the common-enough fields to deserve their
-- own columns for fast querying.
alter table support_customers
  add column if not exists phone text;

alter table support_customers
  add column if not exists lifetime_value numeric;

alter table support_customers
  add column if not exists signup_date date;

alter table support_customers
  add column if not exists last_seen_at timestamptz;

-- ─── Conversation event timeline ──────────────────────────────
-- Append-only audit of everything that happens to a conversation
-- beyond messages. The detail view's right-side timeline reads
-- from here. Helps with debugging ("who closed this and why?")
-- and gives the inbox a richer feel.
create table if not exists support_conversation_events (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references support_conversations(id) on delete cascade,
  actor_id         uuid references profiles(id) on delete set null,
  actor_type       text not null check (actor_type in ('system', 'agent', 'customer', 'ai')),
  event_type       text not null,
  -- Free-form context per event:
  --   status_changed   → { from, to }
  --   claimed          → { previous_agent_id? }
  --   unassigned       → { previous_agent_id }
  --   tag_added        → { tag_id, tag_name }
  --   tag_removed      → { tag_id, tag_name }
  --   priority_changed → { from, to }
  --   snoozed          → { until }
  --   unsnoozed        → {}
  --   note             → { body } (agent-authored internal note shows here too)
  metadata         jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now()
);

create index if not exists support_conversation_events_conv_idx
  on support_conversation_events (conversation_id, created_at desc);

-- Append-only: same rule as messages.
create or replace rule support_conversation_events_no_update as
  on update to support_conversation_events do instead nothing;
create or replace rule support_conversation_events_no_delete as
  on delete to support_conversation_events do instead nothing;

-- ─── Canned responses ─────────────────────────────────────────
-- Per-company templates. Agents type a shortcut in the composer
-- (e.g. /refund) and the body gets inserted. Templates can include
-- placeholders that the future template-render layer substitutes
-- (e.g. {customer_name}); kept simple for v1 — body is rendered
-- as-is.
create table if not exists support_canned_responses (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  shortcut    text not null,
  title       text not null,
  body        text not null,
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (company_id, shortcut)
);

create index if not exists support_canned_responses_company_idx
  on support_canned_responses (company_id);

-- ─── Auto-event triggers ───────────────────────────────────────
-- Whenever a conversation's claim / status / priority / snooze
-- transitions, log an event automatically. Keeps the timeline
-- complete even when callers forget to emit explicitly.
create or replace function emit_support_conversation_event()
returns trigger
language plpgsql
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

drop trigger if exists trg_emit_support_conv_event on support_conversations;
create trigger trg_emit_support_conv_event
  after update on support_conversations
  for each row execute function emit_support_conversation_event();

-- ─── Tag add/remove events ────────────────────────────────────
create or replace function emit_support_tag_event()
returns trigger
language plpgsql
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

drop trigger if exists trg_emit_support_tag_event on support_conversation_tags;
create trigger trg_emit_support_tag_event
  after insert or delete on support_conversation_tags
  for each row execute function emit_support_tag_event();

-- ─── RLS on new tables ────────────────────────────────────────

alter table support_tags enable row level security;
alter table support_conversation_tags enable row level security;
alter table support_conversation_events enable row level security;
alter table support_canned_responses enable row level security;

-- Tags: company-scoped read; agents OR company admins write
drop policy if exists "support_tags - select" on support_tags;
create policy "support_tags - select" on support_tags
  for select using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.company_id = support_tags.company_id)
  );

drop policy if exists "support_tags - mutate" on support_tags;
create policy "support_tags - mutate" on support_tags
  for all using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.company_id = support_tags.company_id
        and (p.is_support_agent or p.role in ('CEO', 'COO', 'admin'))
    )
  );

-- Conversation tags: same gating as the conversation update RLS
drop policy if exists "support_conversation_tags - select" on support_conversation_tags;
create policy "support_conversation_tags - select" on support_conversation_tags
  for select using (
    exists (
      select 1 from support_conversations c
      join profiles p on p.id = auth.uid()
      where c.id = support_conversation_tags.conversation_id
        and c.company_id = p.company_id
    )
  );

drop policy if exists "support_conversation_tags - mutate" on support_conversation_tags;
create policy "support_conversation_tags - mutate" on support_conversation_tags
  for all using (
    exists (
      select 1 from support_conversations c
      join profiles p on p.id = auth.uid()
      where c.id = support_conversation_tags.conversation_id
        and c.company_id = p.company_id
        and (p.is_support_agent or p.role in ('CEO', 'COO', 'admin'))
    )
  );

-- Events: read by anyone in the company; never written from client
-- (only triggers + server-side API insert via service role)
drop policy if exists "support_conversation_events - select" on support_conversation_events;
create policy "support_conversation_events - select" on support_conversation_events
  for select using (
    exists (
      select 1 from support_conversations c
      join profiles p on p.id = auth.uid()
      where c.id = support_conversation_events.conversation_id
        and c.company_id = p.company_id
    )
  );

-- Canned responses: read by any agent; mutate by agents OR admins
drop policy if exists "support_canned_responses - select" on support_canned_responses;
create policy "support_canned_responses - select" on support_canned_responses
  for select using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.company_id = support_canned_responses.company_id
        and (p.is_support_agent or p.role in ('CEO', 'COO', 'admin'))
    )
  );

drop policy if exists "support_canned_responses - mutate" on support_canned_responses;
create policy "support_canned_responses - mutate" on support_canned_responses
  for all using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.company_id = support_canned_responses.company_id
        and (p.is_support_agent or p.role in ('CEO', 'COO', 'admin'))
    )
  );

-- ─── Comments ─────────────────────────────────────────────────

comment on table support_tags is
  'Per-company conversation labels. Color palette enforced via check
   constraint. Pre-seeded set is created via the admin UI rather
   than the migration so each tenant builds their own taxonomy.';

comment on table support_conversation_events is
  'Append-only audit log of conversation state changes (status,
   assignment, tags, priority, snooze). The detail view''s timeline
   sidebar reads from here. Triggers on support_conversations and
   support_conversation_tags populate this automatically; explicit
   inserts are also allowed for events the schema can''t detect
   (e.g., note-level events).';

comment on column support_conversations.priority is
  'urgent (red) / high (amber) / normal (default) / low (gray). The
   inbox sorts by priority then last_message_at — high-priority
   conversations always surface above older normal ones.';

comment on column support_conversations.snoozed_until is
  'When set, conversation is hidden from the active inbox until
   this time. UI shows a "snoozed" filter for the agent who set it.';

comment on column support_conversations.sla_first_response_minutes is
  'Target FRT in minutes. Inbox shows a visual indicator when a
   conversation is approaching breach (>80% elapsed) and a red
   indicator when breached. Default 30 — businesses with their own
   SLA contracts will override per-conversation via the API.';
