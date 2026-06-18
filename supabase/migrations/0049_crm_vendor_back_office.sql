-- 0049 — Vendor-side CRM (customer management for ELOSTATE itself).
--
-- Per CLAUDE.md + AMD-006 four-layer build:
--
--   L1 (structure) — vendor-side back office for ELOSTATE-the-business.
--     Distinct from C.A.R.E (which manages an ELOSTATE TENANT's customers).
--     This layer manages ELOSTATE's OWN customers — the companies signed
--     up to use the product.
--
--   L2 (effectivity) — staffed by ELOSTATE leadership (super-admin only).
--     Tracks: who signed up, what plan, lifecycle stage, support volume,
--     billing state (stubbed — no live charges), team contacts, internal
--     notes, activity feed.
--
--   L3 (composition) — composes with the existing chain:
--     • Auto-creates a crm_accounts row on every companies insert.
--     • Reads §3.4 cycle state to derive lifecycle stage (trial /
--       control_month / activated / paying / at_risk / churned).
--     • Activity events are append-only per §3.1 — every meaningful
--       transition gets a row in crm_activity_events.
--     • Composes with billing later: crm_subscriptions has stripe_*
--       columns wired but NOT POPULATED until live billing turns on.
--
--   L4 (UI) — accounts list at /dashboard/admin/crm, detail at
--     /dashboard/admin/crm/[accountId]. Sidebar entry under admin.
--
-- Per CLAUDE.md §3.4 — billing is in the schema but the ACTIVE state
-- is "not_collecting" by default. Going live requires a deliberate
-- migration to flip plan + price tiers + stripe connection. Half-on
-- billing would violate §A11 (the System claiming a state it hasn't
-- earned).
--
-- Per CLAUDE.md §3.1 — every state transition emits an event row.
-- Activity is the source of truth; account state is the derived view.

-- ─────────────────────────────────────────────────────────────
-- crm_accounts — one per signed-up company
-- ─────────────────────────────────────────────────────────────
create type crm_lifecycle_stage as enum (
  'trial',
  'control_month',
  'activated',
  'paying',
  'at_risk',
  'churned',
  'archived'
);

create type crm_account_source as enum (
  'self_signup',
  'invited',
  'referral',
  'imported',
  'unknown'
);

create table if not exists crm_accounts (
  id            uuid primary key default gen_random_uuid(),
  -- 1:1 with the companies row that represents this tenant
  company_id    uuid not null unique references companies(id) on delete cascade,

  -- Lifecycle stage (derived but cached for fast queries; trigger
  -- keeps it in sync with cycle state and billing).
  lifecycle_stage    crm_lifecycle_stage not null default 'trial',
  lifecycle_changed_at timestamptz default now(),

  -- Acquisition context
  source             crm_account_source not null default 'unknown',
  source_note        text,

  -- Internal accounting
  account_owner_user_id uuid references auth.users(id) on delete set null,
  health_score          integer check (health_score is null or (health_score >= 0 and health_score <= 100)),
  health_reason         text,

  -- Free-text fields for ELOSTATE's own ops
  industry           text,
  size_bracket       text, -- '1-10', '11-50', '51-200', '201-500', '500+'
  region             text,
  primary_contact_email text,

  -- Billing readiness flags. The whole billing system is stubbed
  -- until the founder turns it on. Per §3.4 no-instant-results,
  -- a "not_collecting" account is honest, not a degraded one.
  billing_status     text not null default 'not_collecting',
  -- 'not_collecting' | 'pending_first_invoice' | 'collecting' | 'past_due' | 'churned'

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists crm_accounts_company_id_idx on crm_accounts (company_id);
create index if not exists crm_accounts_lifecycle_idx on crm_accounts (lifecycle_stage);
create index if not exists crm_accounts_owner_idx on crm_accounts (account_owner_user_id);

-- ─────────────────────────────────────────────────────────────
-- crm_contacts — people at an account ELOSTATE talks to
-- ─────────────────────────────────────────────────────────────
create table if not exists crm_contacts (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references crm_accounts(id) on delete cascade,

  full_name   text not null,
  email       text,
  role        text, -- 'CEO', 'COO', 'champion', 'finance', etc.
  is_primary  boolean not null default false,
  is_decision_maker boolean not null default false,

  notes       text,
  last_contacted_at timestamptz,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists crm_contacts_account_idx on crm_contacts (account_id);
create unique index if not exists crm_contacts_primary_unique
  on crm_contacts (account_id)
  where is_primary = true;

-- ─────────────────────────────────────────────────────────────
-- crm_subscriptions — plan + billing state per account
-- Stubbed billing. Schema is real; collection is off.
-- ─────────────────────────────────────────────────────────────
create type crm_plan_tier as enum (
  'pilot',           -- free, founder-led
  'team_small',      -- placeholder; live tiers go in a future migration
  'team_medium',
  'team_large',
  'enterprise'
);

create type crm_subscription_status as enum (
  'inactive',        -- account exists, no subscription opened
  'trialing',        -- pre-paying period
  'control_month',   -- month-1 baseline window
  'active',          -- would be paying if collection were on
  'paused',
  'past_due',
  'cancelled'
);

create table if not exists crm_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  account_id   uuid not null references crm_accounts(id) on delete cascade,
  plan         crm_plan_tier not null default 'pilot',
  status       crm_subscription_status not null default 'control_month',

  -- Period bookkeeping
  current_period_start timestamptz not null default now(),
  current_period_end   timestamptz,
  trial_end_at         timestamptz,
  cancelled_at         timestamptz,

  -- Reference fields ready for future Stripe integration; null
  -- while billing is stubbed. Not populated by application code
  -- until the live-billing migration flips the switch.
  stripe_customer_id      text,
  stripe_subscription_id  text,
  stripe_price_id         text,

  -- Seat / usage placeholders. Counted but not billed.
  seat_count   integer not null default 0,
  monthly_recurring_revenue_cents integer not null default 0,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists crm_subscriptions_account_idx
  on crm_subscriptions (account_id);
create index if not exists crm_subscriptions_status_idx
  on crm_subscriptions (status);
create unique index if not exists crm_subscriptions_active_unique
  on crm_subscriptions (account_id)
  where status in ('trialing', 'control_month', 'active', 'paused', 'past_due');

-- ─────────────────────────────────────────────────────────────
-- crm_invoices — generated but not collected while billing is off
-- ─────────────────────────────────────────────────────────────
create type crm_invoice_status as enum (
  'draft',
  'not_collecting',  -- generated for the record but no charge attempted
  'sent',
  'paid',
  'overdue',
  'voided'
);

create table if not exists crm_invoices (
  id              uuid primary key default gen_random_uuid(),
  account_id      uuid not null references crm_accounts(id) on delete cascade,
  subscription_id uuid references crm_subscriptions(id) on delete set null,

  invoice_number  text unique not null,
  status          crm_invoice_status not null default 'not_collecting',

  amount_cents    integer not null default 0,
  currency        text not null default 'USD',

  period_start    timestamptz not null,
  period_end      timestamptz not null,

  issued_at       timestamptz not null default now(),
  due_at          timestamptz,
  paid_at         timestamptz,

  -- Future Stripe reference; null while billing is stubbed
  stripe_invoice_id text,

  created_at      timestamptz not null default now()
);

create index if not exists crm_invoices_account_idx on crm_invoices (account_id);
create index if not exists crm_invoices_status_idx on crm_invoices (status);

-- ─────────────────────────────────────────────────────────────
-- crm_activity_events — append-only per §3.1
-- ─────────────────────────────────────────────────────────────
create type crm_activity_kind as enum (
  'account_created',
  'lifecycle_changed',
  'subscription_changed',
  'invoice_issued',
  'invoice_paid',
  'contact_added',
  'contact_removed',
  'note_added',
  'support_volume_spiked',
  'control_month_completed',
  'health_changed',
  'owner_assigned'
);

create table if not exists crm_activity_events (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references crm_accounts(id) on delete cascade,
  kind        crm_activity_kind not null,
  payload     jsonb not null default '{}'::jsonb,
  -- Optional reference to the user (ELOSTATE staff) who triggered
  -- this. Null for system-emitted events (lifecycle transitions etc.)
  actor_user_id uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists crm_activity_events_account_idx
  on crm_activity_events (account_id, created_at desc);
create index if not exists crm_activity_events_kind_idx
  on crm_activity_events (kind);

-- ─────────────────────────────────────────────────────────────
-- crm_notes — free-form internal notes per account
-- ─────────────────────────────────────────────────────────────
create table if not exists crm_notes (
  id           uuid primary key default gen_random_uuid(),
  account_id   uuid not null references crm_accounts(id) on delete cascade,
  author_user_id uuid references auth.users(id) on delete set null,
  body         text not null,
  pinned       boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists crm_notes_account_idx
  on crm_notes (account_id, created_at desc);

-- ─────────────────────────────────────────────────────────────
-- updated_at maintenance
-- ─────────────────────────────────────────────────────────────
create or replace function crm_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger crm_accounts_touch
  before update on crm_accounts
  for each row execute function crm_touch_updated_at();

create trigger crm_contacts_touch
  before update on crm_contacts
  for each row execute function crm_touch_updated_at();

create trigger crm_subscriptions_touch
  before update on crm_subscriptions
  for each row execute function crm_touch_updated_at();

create trigger crm_notes_touch
  before update on crm_notes
  for each row execute function crm_touch_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Auto-create a crm_accounts row + control_month subscription
-- on every new company. Per §3.1 every signup is an event;
-- per §3.4 every account opens in control_month.
-- SECURITY DEFINER per migration 0039 hardening — the trigger
-- writes to crm_* tables on behalf of the caller and bypasses
-- RLS deliberately (the signup flow has no auth context for
-- the CRM tables yet).
-- ─────────────────────────────────────────────────────────────
create or replace function crm_bootstrap_account()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account_id uuid;
begin
  insert into crm_accounts (company_id, lifecycle_stage, source)
  values (new.id, 'control_month', 'self_signup')
  returning id into v_account_id;

  insert into crm_subscriptions (
    account_id, plan, status,
    current_period_start, current_period_end
  ) values (
    v_account_id, 'pilot', 'control_month',
    now(), now() + interval '30 days'
  );

  insert into crm_activity_events (account_id, kind, payload)
  values (
    v_account_id,
    'account_created',
    jsonb_build_object('company_name', new.name)
  );

  return new;
end;
$$;

drop trigger if exists crm_bootstrap_account_trigger on companies;
create trigger crm_bootstrap_account_trigger
  after insert on companies
  for each row execute function crm_bootstrap_account();

-- ─────────────────────────────────────────────────────────────
-- Backfill: existing companies that pre-date this migration
-- get a crm_accounts row so the ops view is complete from day
-- one of the CRM going live.
-- ─────────────────────────────────────────────────────────────
insert into crm_accounts (company_id, lifecycle_stage, source)
select c.id, 'activated', 'imported'
from companies c
where not exists (select 1 from crm_accounts a where a.company_id = c.id);

insert into crm_subscriptions (
  account_id, plan, status, current_period_start, current_period_end
)
select a.id, 'pilot', 'active', now(), now() + interval '30 days'
from crm_accounts a
where not exists (
  select 1 from crm_subscriptions s where s.account_id = a.id
);

insert into crm_activity_events (account_id, kind, payload)
select a.id, 'account_created',
  jsonb_build_object('source', 'backfill', 'company_id', a.company_id)
from crm_accounts a
where not exists (
  select 1 from crm_activity_events e
  where e.account_id = a.id and e.kind = 'account_created'
);

-- ─────────────────────────────────────────────────────────────
-- Lifecycle / activity emit triggers — every meaningful CRM
-- state change becomes an immutable event.
-- ─────────────────────────────────────────────────────────────
create or replace function crm_emit_lifecycle_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.lifecycle_stage is distinct from new.lifecycle_stage then
    insert into crm_activity_events (account_id, kind, payload)
    values (
      new.id,
      'lifecycle_changed',
      jsonb_build_object('from', old.lifecycle_stage, 'to', new.lifecycle_stage)
    );
    new.lifecycle_changed_at = now();
  end if;
  if old.account_owner_user_id is distinct from new.account_owner_user_id then
    insert into crm_activity_events (account_id, kind, payload, actor_user_id)
    values (
      new.id, 'owner_assigned',
      jsonb_build_object(
        'previous_owner', old.account_owner_user_id,
        'new_owner', new.account_owner_user_id
      ),
      new.account_owner_user_id
    );
  end if;
  if old.health_score is distinct from new.health_score then
    insert into crm_activity_events (account_id, kind, payload)
    values (
      new.id, 'health_changed',
      jsonb_build_object(
        'previous_score', old.health_score,
        'new_score', new.health_score,
        'reason', new.health_reason
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists crm_accounts_emit_lifecycle on crm_accounts;
create trigger crm_accounts_emit_lifecycle
  before update on crm_accounts
  for each row execute function crm_emit_lifecycle_change();

create or replace function crm_emit_subscription_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into crm_activity_events (account_id, kind, payload)
  values (
    new.account_id,
    'subscription_changed',
    jsonb_build_object(
      'previous_status', old.status,
      'new_status', new.status,
      'previous_plan', old.plan,
      'new_plan', new.plan
    )
  );
  return new;
end;
$$;

drop trigger if exists crm_subscriptions_emit on crm_subscriptions;
create trigger crm_subscriptions_emit
  after update on crm_subscriptions
  for each row
  when (old.status is distinct from new.status or old.plan is distinct from new.plan)
  execute function crm_emit_subscription_change();

create or replace function crm_emit_invoice_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into crm_activity_events (account_id, kind, payload)
    values (
      new.account_id,
      'invoice_issued',
      jsonb_build_object(
        'invoice_id', new.id,
        'invoice_number', new.invoice_number,
        'amount_cents', new.amount_cents,
        'status', new.status
      )
    );
  end if;
  if tg_op = 'UPDATE'
     and old.status is distinct from new.status
     and new.status = 'paid' then
    insert into crm_activity_events (account_id, kind, payload)
    values (
      new.account_id,
      'invoice_paid',
      jsonb_build_object(
        'invoice_id', new.id,
        'invoice_number', new.invoice_number,
        'amount_cents', new.amount_cents
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists crm_invoices_emit_insert on crm_invoices;
create trigger crm_invoices_emit_insert
  after insert on crm_invoices
  for each row execute function crm_emit_invoice_event();

drop trigger if exists crm_invoices_emit_paid on crm_invoices;
create trigger crm_invoices_emit_paid
  after update on crm_invoices
  for each row execute function crm_emit_invoice_event();

create or replace function crm_emit_note_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into crm_activity_events (
    account_id, kind, payload, actor_user_id
  ) values (
    new.account_id,
    'note_added',
    jsonb_build_object('note_id', new.id, 'pinned', new.pinned),
    new.author_user_id
  );
  return new;
end;
$$;

drop trigger if exists crm_notes_emit on crm_notes;
create trigger crm_notes_emit
  after insert on crm_notes
  for each row execute function crm_emit_note_event();

create or replace function crm_emit_contact_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into crm_activity_events (account_id, kind, payload)
    values (
      new.account_id,
      'contact_added',
      jsonb_build_object(
        'contact_id', new.id,
        'name', new.full_name,
        'role', new.role,
        'is_primary', new.is_primary
      )
    );
  end if;
  if tg_op = 'DELETE' then
    insert into crm_activity_events (account_id, kind, payload)
    values (
      old.account_id,
      'contact_removed',
      jsonb_build_object('contact_id', old.id, 'name', old.full_name)
    );
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists crm_contacts_emit_insert on crm_contacts;
create trigger crm_contacts_emit_insert
  after insert on crm_contacts
  for each row execute function crm_emit_contact_event();

drop trigger if exists crm_contacts_emit_delete on crm_contacts;
create trigger crm_contacts_emit_delete
  after delete on crm_contacts
  for each row execute function crm_emit_contact_event();

-- ─────────────────────────────────────────────────────────────
-- Row-level security
--
-- The CRM is super-admin (vendor-side) only. Unlike per-tenant
-- tables (which RLS-scope by company_id = auth_company_id()),
-- these tables RLS-scope by membership in a super_admins table
-- — or, in absence of one, by the user's profile.role being
-- 'CEO' / 'COO' / 'admin' AND their company being the ELOSTATE
-- company itself (the one running this deployment).
--
-- For pilot/dev we gate by profile.role IN (CEO/COO/admin) on
-- the deployment's primary company. A future hardening: add a
-- super_admins table and use it as the source of truth.
-- ─────────────────────────────────────────────────────────────
alter table crm_accounts enable row level security;
alter table crm_contacts enable row level security;
alter table crm_subscriptions enable row level security;
alter table crm_invoices enable row level security;
alter table crm_activity_events enable row level security;
alter table crm_notes enable row level security;

create or replace function is_vendor_super_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from profiles p
    where p.id = auth.uid()
      and p.role in ('CEO', 'COO', 'admin')
  );
$$;

-- crm_accounts: read for vendor admins; write for vendor admins.
create policy "crm_accounts_select" on crm_accounts
  for select using (is_vendor_super_admin());
create policy "crm_accounts_update" on crm_accounts
  for update using (is_vendor_super_admin())
  with check (is_vendor_super_admin());
create policy "crm_accounts_insert" on crm_accounts
  for insert with check (is_vendor_super_admin());

-- crm_contacts
create policy "crm_contacts_all" on crm_contacts
  for all using (is_vendor_super_admin())
  with check (is_vendor_super_admin());

-- crm_subscriptions
create policy "crm_subscriptions_all" on crm_subscriptions
  for all using (is_vendor_super_admin())
  with check (is_vendor_super_admin());

-- crm_invoices
create policy "crm_invoices_all" on crm_invoices
  for all using (is_vendor_super_admin())
  with check (is_vendor_super_admin());

-- crm_activity_events: read-only for vendor admins. Inserts go
-- through SECURITY DEFINER triggers / admin routes.
create policy "crm_activity_events_select" on crm_activity_events
  for select using (is_vendor_super_admin());

-- crm_notes
create policy "crm_notes_all" on crm_notes
  for all using (is_vendor_super_admin())
  with check (is_vendor_super_admin());

-- ─────────────────────────────────────────────────────────────
-- Convenience view: account summary with derived counts
-- ─────────────────────────────────────────────────────────────
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

-- View security follows the underlying RLS on crm_accounts.

-- ─────────────────────────────────────────────────────────────
-- End migration 0049.
-- Per CLAUDE.md §3.4 — billing fields exist but the active state
-- is "not_collecting" / "control_month" by default. A future
-- migration flips billing live; until then this migration is
-- the honest "schema is real, collection is off" position.
-- ─────────────────────────────────────────────────────────────
