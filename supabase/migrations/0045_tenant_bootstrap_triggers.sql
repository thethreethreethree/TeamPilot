-- 0045 — New-tenant bootstrap triggers.
--
-- Background: when a new company signs up, two C.A.R.E support
-- resources need to exist before the dashboard is functional:
--
--   1. care_tenant_config — embed token, AI personality slot,
--      widget appearance, plan/quota. Without this, the customer
--      widget can't load (no embed token to validate) and the
--      tenant settings UI 404s.
--   2. care_agent_state — presence/capacity row per agent. Without
--      this, the agent doesn't show in the routing pool and the
--      agent inbox / co-pilot can't fetch their state.
--
-- Up to now, these tables were populated by ONE-TIME BACKFILLS in
-- the migrations that created them (0038, 0042). That worked for
-- the original ELOSTATE tenant but means: any company that signs
-- up AFTER those migrations ran has NO C.A.R.E config row, and
-- C.A.R.E is structurally non-functional for them.
--
-- Per AMD-006 §1.5.1 layer 1 (structure efficiency): new-tenant
-- bootstrap belongs in a trigger, not a backfill. A backfill is a
-- one-time event; a trigger is a structural invariant. The
-- invariant we need:
--
--   ∀ company c → ∃ care_tenant_config row with c.id
--   ∀ profile p where p is agent → ∃ care_agent_state row with p.id
--
-- This migration installs the trigger pair that maintains both
-- invariants going forward. A defensive backfill at the bottom
-- closes the loop for any existing companies that happen to have
-- slipped through (shouldn't be any in prod, but cheap insurance).
--
-- ─── SECURITY DEFINER ────────────────────────────────────────
-- Both trigger functions are SECURITY DEFINER, per the lesson
-- captured in 0039: when a SYSTEM-emitted INSERT runs inside the
-- triggering user's auth context, RLS on the target table can
-- silently reject the write and roll back the whole transaction.
-- The trigger functions are SECURITY DEFINER so they run with
-- schema-owner privileges, same pattern as
-- emit_support_conversation_event (0039) and
-- emit_support_tag_event (0039).
--
-- A12 idempotent.

-- ─── 1. Auto-create care_tenant_config on new company ──────
create or replace function emit_care_tenant_config_for_new_company()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Defaults match the existing care_tenant_config column
  -- defaults (embed_token auto-generated; widget appearance and
  -- AI tone defaults; plan='pilot'). allowed_origins starts
  -- empty so the widget can't be embedded until the tenant
  -- explicitly authorizes an origin in settings — fail-safe.
  -- company_display_name pulled from the company name so the
  -- widget already has a sensible label.
  insert into care_tenant_config (company_id, company_display_name)
  values (new.id, new.name)
  on conflict (company_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_care_tenant_config_on_new_company on companies;
create trigger trg_care_tenant_config_on_new_company
  after insert on companies
  for each row execute function emit_care_tenant_config_for_new_company();

-- ─── 2. Auto-create care_agent_state on new agent profile ──
-- Fires on profile insert and on profile update — the latter is
-- load-bearing because the typical flow is:
--   1. handle_new_user trigger creates a placeholder profile
--      with company_id=NULL and role=NULL
--   2. Onboarding wizard UPDATEs the profile to set company_id +
--      role='admin'
-- The trigger on UPDATE catches step 2; the INSERT branch
-- catches direct profile inserts (e.g., test fixtures, future
-- invitation flows).
create or replace function emit_care_agent_state_for_new_agent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only act when the profile is a C.A.R.E participant:
  --   - support_agent flag is true, OR
  --   - role is one that has agent-equivalent access (CEO, COO,
  --     admin per the agent route gate in /api/care/agent/*)
  -- AND the profile has a company_id (not the placeholder state).
  if new.company_id is not null
     and (
       coalesce(new.is_support_agent, false)
       or new.role in ('CEO', 'COO', 'admin')
     )
  then
    -- INSERT-or-ignore so re-triggering on subsequent profile
    -- updates doesn't churn the row.
    insert into care_agent_state (agent_id, company_id)
    values (new.id, new.company_id)
    on conflict (agent_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_care_agent_state_on_new_agent_ins on profiles;
create trigger trg_care_agent_state_on_new_agent_ins
  after insert on profiles
  for each row execute function emit_care_agent_state_for_new_agent();

drop trigger if exists trg_care_agent_state_on_new_agent_upd on profiles;
create trigger trg_care_agent_state_on_new_agent_upd
  after update on profiles
  for each row execute function emit_care_agent_state_for_new_agent();

-- ─── 3. Defensive backfill (cheap insurance) ──────────────────
-- If any company sneaked into production between the original
-- 0038 / 0042 backfills and this migration without getting a
-- C.A.R.E config row, fix it now.
insert into care_tenant_config (company_id, company_display_name)
select c.id, c.name
from companies c
where not exists (
  select 1 from care_tenant_config t where t.company_id = c.id
)
on conflict (company_id) do nothing;

-- Same for care_agent_state — any agent-eligible profile without
-- a state row.
insert into care_agent_state (agent_id, company_id)
select p.id, p.company_id
from profiles p
where p.company_id is not null
  and (
    coalesce(p.is_support_agent, false)
    or p.role in ('CEO', 'COO', 'admin')
  )
  and not exists (
    select 1 from care_agent_state s where s.agent_id = p.id
  )
on conflict (agent_id) do nothing;
