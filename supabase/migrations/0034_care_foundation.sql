-- 0034 — ELOSTATE Care foundation (Sprint 1 of the CMS / customer
-- support product line).
--
-- Adds the customer-support schema so an external customer (no auth
-- needed — they're a stranger visiting a public page or a customer
-- of a business using our widget) can start a conversation that AI
-- handles first, then an internal agent claims and resolves.
--
-- Multi-tenancy: every conversation is scoped to a company_id.
-- ELOSTATE itself is one tenant (the support inbox you'll use to
-- answer your own customers). Future external businesses become
-- additional tenants under the same schema — no fork required.
--
-- Customer-side has no auth. The widget creates a conversation,
-- receives a session_token, and uses that as its bearer for all
-- subsequent reads/writes against the API (server-side validates
-- the token against the row, then uses service-role DB). RLS keeps
-- direct DB access locked to authenticated agents.
--
-- A12 idempotent: every create / alter / drop / policy uses
-- if-not-exists or drop-if-exists then create. Safe to re-run.

-- ─── support_customers ─────────────────────────────────────────
-- Identified customers (those who shared an email during chat).
-- Anonymous conversations land here only after the customer
-- volunteers contact info. Metadata is per-business custom (plan,
-- signup date, lifetime spend, anything the business cares to
-- track — fed in via the widget config).
create table if not exists support_customers (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  email       text,
  name        text,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  -- Unique per company so the same email at two different businesses
  -- stays separate. Null emails allowed (anonymous customers).
  constraint support_customers_email_unique_per_company unique (company_id, email)
);

create index if not exists support_customers_company_idx
  on support_customers (company_id) where email is not null;

-- ─── support_conversations ─────────────────────────────────────
-- The chat thread between a customer (+ AI + later a human agent).
-- session_token is the customer's bearer — generated server-side at
-- conversation start, returned to the widget, used by the widget
-- for all subsequent calls. The widget stores it in localStorage so
-- the customer can come back to the same conversation across page
-- loads.
--
-- ai_responding flag: true while the AI is the first responder.
-- Flipped to false the moment a human agent claims the conversation,
-- so the AI doesn't compete with the agent for the next reply.
create table if not exists support_conversations (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references companies(id) on delete cascade,
  customer_id         uuid references support_customers(id) on delete set null,
  session_token       text not null unique default gen_random_uuid()::text,
  status              text not null default 'open'
                      check (status in (
                        'open',              -- newly created, AI is first responder
                        'in_conversation',   -- agent has claimed, actively replying
                        'awaiting_customer', -- agent replied, waiting on customer
                        'resolved',          -- agent marked as resolved
                        'closed'             -- archived (no further activity expected)
                      )),
  assigned_agent_id   uuid references profiles(id) on delete set null,
  source              text not null default 'web_widget'
                      check (source in ('web_widget', 'email', 'embedded_widget')),
  ai_responding       boolean not null default true,
  -- Lifecycle timestamps for SLA reporting (FRT, TTR).
  first_message_at    timestamptz,
  last_message_at     timestamptz,
  first_response_at   timestamptz,
  resolved_at         timestamptz,
  -- Subject / summary surfaced in the inbox list (auto-derived from
  -- first customer message; agent can edit).
  subject             text,
  created_at          timestamptz not null default now()
);

create index if not exists support_conversations_company_status_idx
  on support_conversations (company_id, status, last_message_at desc nulls last);

create index if not exists support_conversations_session_idx
  on support_conversations (session_token);

create index if not exists support_conversations_agent_idx
  on support_conversations (assigned_agent_id) where assigned_agent_id is not null;

-- ─── support_messages ──────────────────────────────────────────
-- Append-only chat. author_type discriminates who said it:
--   customer → from the widget; visible to everyone
--   ai       → AI response; visible to everyone
--   agent    → human agent reply; visible to customer unless
--              is_internal_note=true (then agent-only)
--   system   → status changes, agent assignments, etc.
create table if not exists support_messages (
  id                uuid primary key default gen_random_uuid(),
  conversation_id   uuid not null references support_conversations(id) on delete cascade,
  author_type       text not null check (author_type in ('customer', 'ai', 'agent', 'system')),
  author_id         uuid,  -- profiles.id for 'agent'; null otherwise
  body              text not null,
  is_internal_note  boolean not null default false,
  created_at        timestamptz not null default now()
);

create index if not exists support_messages_conversation_idx
  on support_messages (conversation_id, created_at);

-- Append-only: no UPDATE / DELETE allowed via RLS or rules. Even
-- agents can't edit a sent message (mirrors the §3.1 chain
-- discipline applied to support).
create or replace rule support_messages_no_update as
  on update to support_messages do instead nothing;
create or replace rule support_messages_no_delete as
  on delete to support_messages do instead nothing;

-- ─── Agent flag on profiles ────────────────────────────────────
-- Decouples "support agent capability" from "company-level role"
-- so any team member can be made a Care agent regardless of their
-- CEO/COO/Lead/Member role. Company admins also get agent powers
-- implicitly (checked in the policy below).
alter table profiles
  add column if not exists is_support_agent boolean not null default false;

-- ─── Trigger: stamp lifecycle timestamps on conversations ──────
-- Keeps first_message_at / last_message_at / first_response_at in
-- sync without callers having to manage them. SLA reporting reads
-- these directly.
create or replace function stamp_support_conversation_timestamps()
returns trigger
language plpgsql
as $$
declare
  v_now timestamptz := now();
begin
  -- Update last_message_at + first_message_at on every new message
  update support_conversations c
    set last_message_at = v_now,
        first_message_at = coalesce(c.first_message_at, v_now),
        -- first_response_at = first non-customer message (AI or agent)
        first_response_at = case
          when new.author_type = 'customer' then c.first_response_at
          else coalesce(c.first_response_at, v_now)
        end
  where c.id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists trg_stamp_support_conversation on support_messages;
create trigger trg_stamp_support_conversation
  after insert on support_messages
  for each row execute function stamp_support_conversation_timestamps();

-- ─── Trigger: stamp resolved_at on status change ───────────────
create or replace function stamp_support_resolved_at()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'resolved' and old.status is distinct from 'resolved' then
    new.resolved_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_stamp_support_resolved on support_conversations;
create trigger trg_stamp_support_resolved
  before update on support_conversations
  for each row execute function stamp_support_resolved_at();

-- ─── RLS ──────────────────────────────────────────────────────
-- Customer-side traffic goes through API routes that use the
-- service-role client (bypasses RLS). The widget never touches
-- the DB directly. RLS here gates AGENT access through the
-- dashboard inbox.

alter table support_customers enable row level security;
alter table support_conversations enable row level security;
alter table support_messages enable row level security;

-- support_customers — agents in the same company can read/write
drop policy if exists "support_customers - select" on support_customers;
create policy "support_customers - select" on support_customers
  for select using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.company_id = support_customers.company_id
    )
  );

drop policy if exists "support_customers - insert" on support_customers;
create policy "support_customers - insert" on support_customers
  for insert with check (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.company_id = support_customers.company_id
    )
  );

drop policy if exists "support_customers - update" on support_customers;
create policy "support_customers - update" on support_customers
  for update using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.company_id = support_customers.company_id
    )
  );

-- support_conversations — agents in the same company can read all;
-- update gated to support agents OR company-level admins
drop policy if exists "support_conversations - select" on support_conversations;
create policy "support_conversations - select" on support_conversations
  for select using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.company_id = support_conversations.company_id
    )
  );

drop policy if exists "support_conversations - update" on support_conversations;
create policy "support_conversations - update" on support_conversations
  for update using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.company_id = support_conversations.company_id
        and (p.is_support_agent or p.role in ('CEO', 'COO', 'admin'))
    )
  );

-- support_messages — readable by anyone in the company; insert by
-- support agents OR company admins (agent posting a reply or note)
drop policy if exists "support_messages - select" on support_messages;
create policy "support_messages - select" on support_messages
  for select using (
    exists (
      select 1 from support_conversations c
      join profiles p on p.id = auth.uid()
      where c.id = support_messages.conversation_id
        and c.company_id = p.company_id
    )
  );

drop policy if exists "support_messages - insert" on support_messages;
create policy "support_messages - insert" on support_messages
  for insert with check (
    exists (
      select 1 from support_conversations c
      join profiles p on p.id = auth.uid()
      where c.id = support_messages.conversation_id
        and c.company_id = p.company_id
        and (p.is_support_agent or p.role in ('CEO', 'COO', 'admin'))
    )
  );

-- ─── Make John (founding admin) a support agent by default ─────
-- One-time backfill so the founding CEO can immediately see and
-- respond to Care conversations without having to flip a flag.
-- Other agents are added via the inbox UI (Sprint 2).
update profiles set is_support_agent = true
  where role in ('CEO', 'COO', 'admin')
    and is_support_agent = false;

-- ─── Column documentation ──────────────────────────────────────

comment on table support_conversations is
  'ELOSTATE Care: a customer-support conversation thread. Tenant-
   scoped by company_id so the same schema supports ELOSTATE''s
   internal support inbox AND future white-label customers running
   their own support through our widget. Customer-side traffic uses
   session_token + API routes (service-role on server); agents
   access via RLS-scoped dashboard.';

comment on column support_conversations.session_token is
  'Customer-side bearer token. Generated at conversation creation
   and returned to the widget; the widget stores it in localStorage
   and presents it on every subsequent request so a customer can
   continue the same conversation across page loads without
   creating a full user account.';

comment on column support_conversations.ai_responding is
  'When true, the AI auto-responds to new customer messages. Flipped
   to false the moment a human agent claims the conversation, so
   the AI doesn''t race the agent for the next reply.';

comment on column profiles.is_support_agent is
  'Grants access to the Care inbox at /dashboard/care. Decoupled
   from CEO/COO/Lead/Member role so any team member can be made a
   support agent. CEO/COO/admin profile roles are implicit support
   agents in the policy checks.';
