-- 0036 — Care learning engine.
--
-- Migration 0035 gave Care the operational depth a competitive
-- support platform needs (tags, priority, snooze, customer
-- enrichment, timeline, canned responses). This migration adds the
-- layer no competitor has: the constitutional learning loop applied
-- to customer support.
--
-- The thesis: other support tools MANAGE tickets. We GROW the
-- institutional intelligence that handles them. Every conversation
-- makes the AI sharper, every resolution teaches the next agent,
-- every recurring pattern surfaces as a problem the company can
-- actually fix.
--
-- Schema additions:
--   - support_resolutions       — captured learning when a
--                                 conversation resolves (what was
--                                 the issue, what worked, what
--                                 category)
--   - support_durability_checks — scheduled re-check N days after
--                                 close: did the customer come
--                                 back with the same issue?
--   - support_ai_co_pilot_edits — captured diff when an agent
--                                 edits an AI Co-Pilot draft. The
--                                 corpus that teaches the AI to
--                                 be sharper for THIS company.
--   - support_conversations.reading_complete_at — Understanding
--                                 Gate moment for support: the read
--                                 phase is complete; reply is now
--                                 informed
--
-- Constitutional grounding:
--   §0   — Understanding precedes solving (Read Phase before reply)
--   §1.1 — Data-as-asset (resolutions captured permanently)
--   §1.6 — Close the loop (resolutions feed next conversation)
--   §3.1 — Append-only chain extended to support
--   §3.5 — Resolution durability as honest measurement
--   §3.6 — Make agent + AI learning visible
--   §A11 — Counts, not verdicts (durability rates, never grades)
--   §A18 — Outcome categories framed as patterns, not blame
--
-- A12 idempotent.

-- ─── Conversation columns: Reading Phase + outcome category ────
alter table support_conversations
  add column if not exists reading_complete_at timestamptz;

alter table support_conversations
  add column if not exists resolution_outcome_category text;

comment on column support_conversations.reading_complete_at is
  'The §0 Understanding Gate moment for support. Set when the agent
   has reviewed the Read Phase panel (customer history + similar
   conversations + open Problems). Sets the floor: replies before
   this is set count as "shot from the hip" in the readout — not a
   blocker, but a measurement honesty signal.';

comment on column support_conversations.resolution_outcome_category is
  'Free-form category captured at resolve time (e.g. "billing —
   refund applied", "shipping — replacement sent", "how-to —
   walked through setup"). Drives pattern detection: 12 of these
   in a week becomes a signal. Categories are agent-authored per
   tenant, no enforced taxonomy — patterns emerge from real
   language rather than from someone''s a priori list.';

-- ─── support_resolutions ──────────────────────────────────────
-- Captured when an agent marks a conversation resolved. The §1.1
-- data-as-asset claim applied to support: the WHAT and the WHY of
-- the resolution become reusable material for the next ticket.
create table if not exists support_resolutions (
  id                  uuid primary key default gen_random_uuid(),
  conversation_id     uuid not null references support_conversations(id) on delete cascade,
  company_id          uuid not null references companies(id) on delete cascade,
  captured_by         uuid references profiles(id) on delete set null,
  -- "What was the customer actually asking / experiencing?"
  issue_summary       text not null,
  -- "What worked? What did you do or say that resolved it?"
  what_worked         text not null,
  -- Category — free-form short phrase, surfaces in pattern detection
  category            text,
  -- Optional pointer: this resolution applies a pattern the System
  -- already knew (the agent acknowledged the precedent before
  -- replying). NULL when this is novel learning.
  precedent_resolution_id uuid references support_resolutions(id) on delete set null,
  created_at          timestamptz not null default now()
);

create index if not exists support_resolutions_company_idx
  on support_resolutions (company_id, created_at desc);

create index if not exists support_resolutions_category_idx
  on support_resolutions (company_id, category) where category is not null;

create index if not exists support_resolutions_conversation_idx
  on support_resolutions (conversation_id);

-- Append-only: once captured, the learning is part of the record.
create or replace rule support_resolutions_no_update as
  on update to support_resolutions do instead nothing;
create or replace rule support_resolutions_no_delete as
  on delete to support_resolutions do instead nothing;

comment on table support_resolutions is
  '§1.1 data-as-asset for support. Captured at conversation resolve
   time: what the issue actually was, what worked. The next agent
   reading a similar conversation gets to see this on the Read
   Phase panel. The AI Co-Pilot reads this too when drafting.
   Append-only — corrections are new captures, not edits.';

-- ─── support_durability_checks ────────────────────────────────
-- §3.5 honest measurement applied to support. When a conversation
-- resolves, we schedule a check-in N days out: did the same
-- customer come back with the same kind of issue? "Held" or
-- "Reopened" feeds the readout. Vanity CSAT is replaced by
-- something the company can actually act on.
create table if not exists support_durability_checks (
  id                  uuid primary key default gen_random_uuid(),
  conversation_id     uuid not null references support_conversations(id) on delete cascade,
  company_id          uuid not null references companies(id) on delete cascade,
  resolution_id       uuid references support_resolutions(id) on delete set null,
  scheduled_for       timestamptz not null,
  checked_at          timestamptz,
  -- Verdict captured by the checker (background job in Sprint 5,
  -- manual button until then):
  --   'held'        — customer did not return with similar issue
  --   'reopened'    — customer returned with the same issue
  --   'inconclusive' — not enough data (e.g., not active recently)
  outcome             text check (outcome in ('held', 'reopened', 'inconclusive')),
  notes               text,
  created_at          timestamptz not null default now()
);

create index if not exists support_durability_checks_due_idx
  on support_durability_checks (scheduled_for)
  where checked_at is null;

create index if not exists support_durability_checks_conversation_idx
  on support_durability_checks (conversation_id);

comment on table support_durability_checks is
  '§3.5 resolution durability scheduling. When a conversation
   resolves, schedule a check N days later (default 7) to see if
   the customer came back with the same issue. "Held" feeds the
   readout positively; "Reopened" feeds it as a signal that the
   root cause may not have been addressed. This is the honest
   alternative to one-shot CSAT surveys that nobody reads.';

-- ─── support_ai_co_pilot_edits ────────────────────────────────
-- Every time an agent invokes the AI Co-Pilot and then edits the
-- draft before sending, we capture the diff. The accumulated diffs
-- become the company-specific playbook the next AI draft reads
-- from. Static knowledge bases age fast; this is a living one
-- shaped by every interaction.
create table if not exists support_ai_co_pilot_edits (
  id                  uuid primary key default gen_random_uuid(),
  conversation_id     uuid not null references support_conversations(id) on delete cascade,
  company_id          uuid not null references companies(id) on delete cascade,
  agent_id            uuid references profiles(id) on delete set null,
  ai_draft            text not null,
  ai_reasoning        text,
  agent_sent          text not null,
  -- Lightweight signal: did the agent keep most of the draft,
  -- replace it entirely, or fall somewhere in between. Computed
  -- on insert via the trigger below.
  edit_magnitude      text check (edit_magnitude in ('minor', 'moderate', 'major', 'rewrite')),
  created_at          timestamptz not null default now()
);

create index if not exists support_ai_co_pilot_edits_company_idx
  on support_ai_co_pilot_edits (company_id, created_at desc);

create or replace rule support_ai_co_pilot_edits_no_update as
  on update to support_ai_co_pilot_edits do instead nothing;
create or replace rule support_ai_co_pilot_edits_no_delete as
  on delete to support_ai_co_pilot_edits do instead nothing;

comment on table support_ai_co_pilot_edits is
  'The AI Co-Pilot learning corpus. Every (draft, agent-sent)
   pair becomes a teaching example: where the draft was kept,
   where it was rewritten, what the agent reached for instead.
   Sprint 5 wires this into the Co-Pilot prompt so the AI gets
   sharper specifically for THIS company''s voice and customer
   base.';

-- Edit magnitude trigger — rough Levenshtein-style proxy via
-- character length ratio. Real similarity scoring lives in
-- application code (Sprint 5); this is the at-write classification.
create or replace function compute_co_pilot_edit_magnitude()
returns trigger
language plpgsql
as $$
declare
  ratio numeric;
begin
  if length(new.ai_draft) = 0 then
    new.edit_magnitude := 'rewrite';
  else
    ratio := abs(length(new.ai_draft) - length(new.agent_sent))::numeric / length(new.ai_draft);
    new.edit_magnitude := case
      when ratio < 0.1 then 'minor'
      when ratio < 0.3 then 'moderate'
      when ratio < 0.6 then 'major'
      else 'rewrite'
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_co_pilot_edit_magnitude on support_ai_co_pilot_edits;
create trigger trg_co_pilot_edit_magnitude
  before insert on support_ai_co_pilot_edits
  for each row execute function compute_co_pilot_edit_magnitude();

-- ─── Trigger: auto-schedule a durability check on resolve ─────
create or replace function schedule_support_durability_check()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'resolved' and old.status is distinct from 'resolved' then
    -- Default window: 7 days. Tenants will be able to configure
    -- per-category windows in a future migration.
    insert into support_durability_checks (
      conversation_id, company_id, scheduled_for
    ) values (
      new.id, new.company_id, now() + interval '7 days'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_schedule_durability_check on support_conversations;
create trigger trg_schedule_durability_check
  after update on support_conversations
  for each row execute function schedule_support_durability_check();

-- ─── RLS ─────────────────────────────────────────────────────

alter table support_resolutions enable row level security;
alter table support_durability_checks enable row level security;
alter table support_ai_co_pilot_edits enable row level security;

-- Resolutions: read by anyone in the company; insert by agents
drop policy if exists "support_resolutions - select" on support_resolutions;
create policy "support_resolutions - select" on support_resolutions
  for select using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.company_id = support_resolutions.company_id
    )
  );

drop policy if exists "support_resolutions - insert" on support_resolutions;
create policy "support_resolutions - insert" on support_resolutions
  for insert with check (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.company_id = support_resolutions.company_id
        and (p.is_support_agent or p.role in ('CEO', 'COO', 'admin'))
    )
  );

-- Durability checks: read by company; insert by trigger; update by
-- agents (when they manually mark held/reopened ahead of schedule)
drop policy if exists "support_durability_checks - select" on support_durability_checks;
create policy "support_durability_checks - select" on support_durability_checks
  for select using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.company_id = support_durability_checks.company_id
    )
  );

drop policy if exists "support_durability_checks - update" on support_durability_checks;
create policy "support_durability_checks - update" on support_durability_checks
  for update using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.company_id = support_durability_checks.company_id
        and (p.is_support_agent or p.role in ('CEO', 'COO', 'admin'))
    )
  );

-- AI Co-Pilot edits: read by company; insert by agents (the post-send
-- capture happens server-side from the agent message endpoint)
drop policy if exists "support_ai_co_pilot_edits - select" on support_ai_co_pilot_edits;
create policy "support_ai_co_pilot_edits - select" on support_ai_co_pilot_edits
  for select using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.company_id = support_ai_co_pilot_edits.company_id
    )
  );

drop policy if exists "support_ai_co_pilot_edits - insert" on support_ai_co_pilot_edits;
create policy "support_ai_co_pilot_edits - insert" on support_ai_co_pilot_edits
  for insert with check (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.company_id = support_ai_co_pilot_edits.company_id
        and (p.is_support_agent or p.role in ('CEO', 'COO', 'admin'))
    )
  );
