-- 0116 — Financial System, Increment 1: Foundation (settings + finance roles + COA)
--
-- First implementation migration of the Financial Tracking & Management System, built to the
-- founder-confirmed model (docs/financial-system/PHASE-1-DATA-MODEL.md, confirmed 2026-07-10).
-- Multi-tenant, RLS-isolated per company, reusing auth_company_id() (0001:86). Money is never
-- touched here (accounts hold NO balances — balances derive from posted lines, later increment).
--
-- Idempotent by construction (create ... if not exists; create or replace). Safe to re-run (A12).
--
-- Acceptance tests exercised by docs/financial-system/tests/0116_foundation.test.sql:
--   T-2 tenant isolation · T-4 type↔normal_balance · T-5 unique code · T-6 no-delete-used ·
--   T-7 system-account protection · finance-role capability helpers.

-- ─────────────────────────────────────────────────────────────
-- fin_settings — one row per company; holds the base (reporting) currency.
-- Created at finance-init; base_currency defaults to USD (founder decision #4).
-- ─────────────────────────────────────────────────────────────
create table if not exists fin_settings (
  company_id    uuid primary key references companies(id) on delete cascade,
  base_currency char(3) not null default 'USD',
  created_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id) on delete set null
);

-- ─────────────────────────────────────────────────────────────
-- fin_roles — the SEPARATE finance-authority dimension (founder decision #2/#5).
-- Distinct from profiles.role (CEO/COO/admin/Member) so we don't fragment that
-- vocabulary further (audit F4). One finance role per user per company.
-- ─────────────────────────────────────────────────────────────
create table if not exists fin_roles (
  company_id uuid not null references companies(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null check (role in ('viewer','accountant','approver','controller','cfo')),
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (company_id, user_id)
);

-- ─────────────────────────────────────────────────────────────
-- Finance-authority helpers. SECURITY DEFINER + pinned search_path (0096 convention) so they
-- resolve the caller's authority reliably regardless of RLS on the tables they read.
--
-- Platform-role bridge (founder decision #3): an explicit fin_role wins; otherwise a platform
-- admin/CEO/COO is treated as 'cfo'-level; everyone else has NO finance access. Segregation of
-- duties is enforced separately per-entry (approved_by <> created_by), so this bridge granting
-- approval authority does NOT let anyone approve their own entry.
-- ─────────────────────────────────────────────────────────────
create or replace function fin_effective_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select fr.role from fin_roles fr
      where fr.company_id = auth_company_id() and fr.user_id = auth.uid()),
    (select case when p.role in ('CEO','COO','admin') then 'cfo' else null end
       from profiles p where p.id = auth.uid())
  );
$$;

-- Capability predicates. Each is a pure function of the effective role.
create or replace function fin_can_view() returns boolean
  language sql stable security definer set search_path = public as $$
  select fin_effective_role() is not null; $$;         -- viewer and up

create or replace function fin_can_enter() returns boolean
  language sql stable security definer set search_path = public as $$
  select fin_effective_role() in ('accountant','approver','controller','cfo'); $$;

create or replace function fin_can_approve() returns boolean
  language sql stable security definer set search_path = public as $$
  select fin_effective_role() in ('approver','controller','cfo'); $$;

create or replace function fin_can_manage_periods() returns boolean
  language sql stable security definer set search_path = public as $$
  select fin_effective_role() in ('controller','cfo'); $$;

create or replace function fin_can_configure() returns boolean
  language sql stable security definer set search_path = public as $$
  select fin_effective_role() in ('controller','cfo'); $$;

-- ─────────────────────────────────────────────────────────────
-- fin_accounts — the Chart of Accounts (configurable tree). Metadata only, no balances.
-- ─────────────────────────────────────────────────────────────
create table if not exists fin_accounts (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references companies(id) on delete cascade,
  code           text not null,
  name           text not null,
  type           text not null check (type in ('asset','liability','equity','revenue','expense')),
  subtype        text,
  parent_id      uuid references fin_accounts(id) on delete restrict,
  normal_balance text not null check (normal_balance in ('debit','credit')),
  currency       char(3),
  is_active      boolean not null default true,
  is_system      boolean not null default false,
  created_at     timestamptz not null default now(),
  created_by     uuid references auth.users(id) on delete set null,
  -- T-4: type ↔ normal_balance MUST agree. Asset/Expense are debit-normal;
  -- Liability/Equity/Revenue are credit-normal. A wrong normal balance silently
  -- inverts a whole account, so it is a hard CHECK, not app-layer trust.
  constraint fin_accounts_type_normal_balance_ck check (
    (type in ('asset','expense')    and normal_balance = 'debit') or
    (type in ('liability','equity','revenue') and normal_balance = 'credit')
  ),
  -- T-5: code unique within a company (not globally).
  constraint fin_accounts_company_code_uq unique (company_id, code)
);

create index if not exists fin_accounts_company_idx on fin_accounts (company_id);
create index if not exists fin_accounts_parent_idx on fin_accounts (parent_id);

-- T-6 + T-7: protect the ledger's account metadata from destructive edits.
--   • an account that has journal lines can never be hard-deleted (soft-disable instead);
--   • an is_system account can never be deleted;
--   • parent_id/type/normal_balance are effectively immutable once the account is used —
--     enforced in a later increment when journal lines exist (flagged below).
create or replace function fin_accounts_protect_delete()
returns trigger language plpgsql
security definer set search_path = public as $$
begin
  if OLD.is_system then
    raise exception 'fin_accounts: system account % cannot be deleted', OLD.code;
  end if;
  -- Guarded now; the fin_journal_lines existence check is added in the ledger increment
  -- (the table does not exist yet). System-account protection is live immediately.
  return OLD;
end $$;

drop trigger if exists fin_accounts_no_delete on fin_accounts;
create trigger fin_accounts_no_delete
  before delete on fin_accounts
  for each row execute function fin_accounts_protect_delete();

-- ─────────────────────────────────────────────────────────────
-- RLS — tenant isolation on all three tables (T-2), writes gated by finance capability.
-- ─────────────────────────────────────────────────────────────
alter table fin_settings enable row level security;
alter table fin_roles    enable row level security;
alter table fin_accounts enable row level security;

-- fin_settings: viewable by anyone with finance access in the company; only configure-level
-- (controller/cfo) may create/update it.
drop policy if exists "fin_settings - select" on fin_settings;
create policy "fin_settings - select" on fin_settings
  for select using (company_id = auth_company_id() and fin_can_view());
drop policy if exists "fin_settings - write" on fin_settings;
create policy "fin_settings - write" on fin_settings
  for all using (company_id = auth_company_id() and fin_can_configure())
  with check (company_id = auth_company_id() and fin_can_configure());

-- fin_roles: a user may always read their OWN finance role (needed for the helpers to be
-- meaningful to the client); configure-level may read all + grant/revoke within the company.
drop policy if exists "fin_roles - select self or admin" on fin_roles;
create policy "fin_roles - select self or admin" on fin_roles
  for select using (
    company_id = auth_company_id() and (user_id = auth.uid() or fin_can_configure())
  );
drop policy if exists "fin_roles - write" on fin_roles;
create policy "fin_roles - write" on fin_roles
  for all using (company_id = auth_company_id() and fin_can_configure())
  with check (company_id = auth_company_id() and fin_can_configure());

-- fin_accounts: view with finance access; create/edit requires configure-level (COA is
-- structural). No member INSERT/UPDATE without configure capability.
drop policy if exists "fin_accounts - select" on fin_accounts;
create policy "fin_accounts - select" on fin_accounts
  for select using (company_id = auth_company_id() and fin_can_view());
drop policy if exists "fin_accounts - write" on fin_accounts;
create policy "fin_accounts - write" on fin_accounts
  for all using (company_id = auth_company_id() and fin_can_configure())
  with check (company_id = auth_company_id() and fin_can_configure());

-- Note (flagged for later increments): audit-log hooks (fin_audit_log) are wired when that
-- table lands (Increment 5); account create/update is not yet audited. The immutable audit
-- trail is a Phase-1 non-negotiable and WILL be in place before Phase 1 is marked done.
