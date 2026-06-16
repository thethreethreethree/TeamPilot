-- 0042 — Agent presence + routing foundation.
--
-- Phase 5 commit 1 of the post-CAT-001 rebuild. Adds the schema
-- for agent presence, per-channel capacity, and conversation
-- routing metadata. Constitutional sources:
--   - §A6 Pillar 2 — transparent presence (agent's own status,
--     visible to themselves and aggregate to leader)
--   - §A8 — voice through the constitutional reframe. Statuses
--     are invitations to availability, not productivity scores.
--   - §A10 — agent self-view of presence has feature parity with
--     the leader view of the same agent's presence. No shadow
--     read.
--   - §A11 — counts: how many conversations is the agent
--     currently carrying, not "performance score".
--   - §A18 — labels are descriptive ('online' / 'away' /
--     'offline'), never evaluative ('top responder' / 'idle').
--   - §A4 — resolution-history-aware routing is an explicit
--     uncertainty deferred to the §4 readout. The routing
--     function this migration enables is the simple shape:
--     match channels + capacity + presence. The data layer
--     for resolution-history-aware routing already exists
--     (support_resolutions captured by agent) — Phase 5 v2 can
--     compose without schema change.
--   - §A12 — every column add is idempotent.
--
-- What this migration enables
-- ───────────────────────────
-- Phase 5 commit 2 implements the routing function over this
-- schema:
--   1. New conversation arrives (any channel)
--   2. Routing function finds agents where:
--        - state.status = 'online'
--        - channel in state.channels
--        - currently assigned conversation count < state.max_concurrent
--   3. Picks one (round-robin / least-loaded for v1) and assigns
--   4. Records the routing decision on support_conversations
--      (routed_at, routing_method, routed_to_agent_id)
--
-- What this migration does NOT add
-- ────────────────────────────────
--   - Custom agent statuses beyond online/away/offline. §A4 —
--     ship the simple shape, evolve once data shows a need.
--   - Custom queue routing rules (Zendesk-style group/brand
--     queue routing). Deferred to the next routing phase once
--     resolution-history-aware routing lands.
--   - Skills-based routing. Same deferral reasoning.

-- ─── care_agent_state — presence + capacity ──────────────────
create table if not exists care_agent_state (
  agent_id        uuid primary key references profiles(id) on delete cascade,
  company_id      uuid not null references companies(id) on delete cascade,
  -- Agent-controlled. Defaults to 'offline' so a profile gaining
  -- is_support_agent doesn't auto-route to them until they
  -- explicitly come online.
  status          text not null default 'offline'
                  check (status in ('online', 'away', 'offline')),
  -- App-managed. Heartbeat updated on agent activity (page load,
  -- send message, claim, etc). Used to expire stale 'online'
  -- statuses after N minutes of inactivity.
  last_seen_at    timestamptz not null default now(),
  -- Admin-controlled. Org-level decision on how many concurrent
  -- conversations one agent should carry.
  max_concurrent  int not null default 5 check (max_concurrent >= 0),
  -- Admin-controlled. Which channels this agent receives routed
  -- conversations on. Empty array = no auto-routing (agent
  -- still works conversations via manual claim).
  channels        text[] not null default array[
                    'web_widget'::text,
                    'embedded_widget'::text,
                    'email'::text
                  ],
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists care_agent_state_company_status_idx
  on care_agent_state (company_id, status)
  where status in ('online', 'away');

-- Auto-touch updated_at
create or replace function touch_care_agent_state_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_touch_care_agent_state on care_agent_state;
create trigger trg_touch_care_agent_state
  before update on care_agent_state
  for each row execute function touch_care_agent_state_updated_at();

-- ─── support_conversations — routing metadata ────────────────
alter table support_conversations
  add column if not exists routed_at timestamptz,
  add column if not exists routing_method text
    check (routing_method in (
      'auto_least_loaded',  -- routing function picked an agent
      'manual_claim',       -- agent claimed via inbox
      'manual_assign',      -- admin assigned explicitly
      'escalated',          -- AI handed off (existing flow)
      'unrouted'            -- no eligible agent at create time
    ));

create index if not exists support_conversations_routing_idx
  on support_conversations (routing_method, routed_at desc)
  where routing_method is not null;

-- ─── Backfill: create care_agent_state for existing support  ─
-- agents in each company. Default status='offline' per the
-- principle above — agents come online when they're ready.
insert into care_agent_state (agent_id, company_id)
select p.id, p.company_id
from profiles p
where p.company_id is not null
  and (
    p.is_support_agent
    or p.role in ('CEO', 'COO', 'admin')
  )
  and not exists (
    select 1 from care_agent_state s where s.agent_id = p.id
  );

-- ─── RLS ──────────────────────────────────────────────────────
alter table care_agent_state enable row level security;

-- Agent reads own state. Company admins read team state.
drop policy if exists "care_agent_state - select" on care_agent_state;
create policy "care_agent_state - select" on care_agent_state
  for select using (
    agent_id = auth.uid()
    or exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.company_id = care_agent_state.company_id
        and p.role in ('CEO', 'COO', 'admin')
    )
  );

-- Agent updates own status + last_seen_at. Admins update
-- max_concurrent + channels. We split this into two policies
-- because status / last_seen_at are agent-controlled while
-- capacity / channels are admin-controlled, but Postgres RLS
-- on update applies at the row level (not column level). The
-- column-level discipline is enforced at the API layer; RLS
-- here gates row access.
drop policy if exists "care_agent_state - self update" on care_agent_state;
create policy "care_agent_state - self update" on care_agent_state
  for update using (agent_id = auth.uid());

drop policy if exists "care_agent_state - admin update" on care_agent_state;
create policy "care_agent_state - admin update" on care_agent_state
  for update using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.company_id = care_agent_state.company_id
        and p.role in ('CEO', 'COO', 'admin')
    )
  );

-- Admins create/delete rows when onboarding/offboarding agents.
-- The backfill above handles existing agents; this policy
-- handles future additions.
drop policy if exists "care_agent_state - admin insert" on care_agent_state;
create policy "care_agent_state - admin insert" on care_agent_state
  for insert with check (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.company_id = care_agent_state.company_id
        and p.role in ('CEO', 'COO', 'admin')
    )
  );

-- ─── Comments ─────────────────────────────────────────────────
comment on table care_agent_state is
  'Agent presence + routing settings. One row per support agent
   per company. status is agent-controlled (online / away /
   offline); max_concurrent + channels are admin-controlled
   (org-level capacity decision). Per §A18 the labels are
   descriptive (status names), never evaluative. Per §A6 Pillar 2
   presence is transparent — agent reads their own state +
   leader reads aggregate (no asymmetric reads per §A10).';

comment on column care_agent_state.status is
  'Agent-controlled. Defaults to offline so a new support agent
   doesn''t auto-route until they explicitly come online. Per
   §A18 the three values are descriptive — online (taking
   conversations), away (briefly off), offline (signed out).
   No "top responder" / "idle" evaluative labels.';

comment on column care_agent_state.max_concurrent is
  'Admin-controlled per agent. The routing function won''t
   assign more than this many concurrent open conversations to
   one agent. Per §A6 Pillar 2 the agent sees this same value
   on their own self-view — no shadow read.';

comment on column care_agent_state.channels is
  'Admin-controlled per agent. The routing function only
   considers this agent for conversations on channels in this
   list. Empty array = manual-only (agent works conversations
   via inbox claim, never gets auto-routed).';

comment on column support_conversations.routed_at is
  'When the conversation was assigned to an agent — auto-routed
   at create, manually claimed from inbox, or admin-assigned.
   NULL until the conversation has an agent.';

comment on column support_conversations.routing_method is
  'How the assignment happened. auto_least_loaded = routing
   function picked. manual_claim = agent clicked Claim in
   inbox. manual_assign = admin assigned explicitly. escalated
   = AI handed off (existing flow). unrouted = no eligible
   agent was online at create time (waits in unassigned queue).';
