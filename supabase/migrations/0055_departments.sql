-- 0055 — Departments table + per-user assignment.
--
-- Constitutional source (§0.1 precondition, per AMD-005):
--   • CLAUDE.md §3.1 — events are the source of truth; the
--     entity rows are derived display surfaces. Departments do
--     NOT emit events because they are slowly-changing dimension
--     data (org chart), not chain events. Per-user assignment
--     CHANGES DO emit events (an assignment is a meaningful
--     act that future audits care about).
--   • ThinkerThinker A6 — the Effective-Task Triad. Departments
--     are the structural surface for "what does this work
--     belong to" — the classification gate's pillar 1. Without
--     a real org chart the gate is theater.
--   • ThinkerThinker A12 — every CREATE has IF NOT EXISTS,
--     every DROP has IF EXISTS, every constraint operation
--     tolerates partial state. This migration is replayable
--     against a clean DB, a partially-applied DB, or a fully-
--     applied DB.
--
-- What this enables (Phase 0 of Asset System v1):
--   • Files → m2m → departments (next migration: 0056)
--   • Admin UI at /dashboard/settings/departments (Phase 1)
--   • The classification gate (§3.2 applied to assets)

-- ─── (1) departments table ───────────────────────────────────
create table if not exists departments (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  name        text not null,
  -- Optional. Helps the System suggest classification (A11
  -- mirror — the System counts; user decides). Higher-quality
  -- descriptions → higher-quality suggestions.
  description text,
  -- Soft archive per §3.1. NEVER delete a department; archive
  -- preserves the historical attribution of every file ever
  -- tagged to it.
  archived_at timestamptz,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- Names are unique-per-company among ACTIVE departments only.
-- Archived rows can share names with new active ones without
-- conflict — a company can revive a function-area years later
-- without ghost-row collisions.
create unique index if not exists departments_company_name_active_uniq
  on departments (company_id, lower(name))
  where archived_at is null;

create index if not exists departments_company_idx
  on departments (company_id, archived_at);

-- ─── (2) per-user assignment (m2m) ───────────────────────────
-- A profile can belong to multiple departments. A department
-- has many profiles. Assignment is a chain event (assignor +
-- timestamp recorded as event); the join row is the derived
-- current state.
create table if not exists profile_departments (
  profile_id    uuid not null references profiles(id) on delete cascade,
  department_id uuid not null references departments(id) on delete cascade,
  assigned_by   uuid references auth.users(id) on delete set null,
  assigned_at   timestamptz not null default now(),
  primary key (profile_id, department_id)
);

create index if not exists profile_departments_dept_idx
  on profile_departments (department_id);

-- ─── (3) RLS ─────────────────────────────────────────────────
alter table departments enable row level security;
alter table profile_departments enable row level security;

-- Read: any active member of the company sees their company's
-- departments. Cross-company isolation enforced by company_id.
drop policy if exists departments_select on departments;
create policy departments_select on departments
  for select
  using (
    company_id in (
      select company_id from profiles where id = auth.uid()
    )
  );

-- Write: admins (CEO/COO/admin) only. Per the founder's red-pen
-- — department creation is admin-managed, not anyone-creates.
-- Other roles get no INSERT/UPDATE/DELETE.
drop policy if exists departments_insert_admin on departments;
create policy departments_insert_admin on departments
  for insert
  with check (
    exists (
      select 1 from profiles
      where id = auth.uid()
        and company_id = departments.company_id
        and role in ('CEO', 'COO', 'admin')
    )
  );

drop policy if exists departments_update_admin on departments;
create policy departments_update_admin on departments
  for update
  using (
    exists (
      select 1 from profiles
      where id = auth.uid()
        and company_id = departments.company_id
        and role in ('CEO', 'COO', 'admin')
    )
  );

-- profile_departments — read: any company member can see who
-- belongs to which department within their company. Write:
-- admins only (assignment is an org-chart act).
drop policy if exists profile_departments_select on profile_departments;
create policy profile_departments_select on profile_departments
  for select
  using (
    profile_id in (
      select id from profiles
      where company_id in (
        select company_id from profiles where id = auth.uid()
      )
    )
  );

drop policy if exists profile_departments_insert_admin on profile_departments;
create policy profile_departments_insert_admin on profile_departments
  for insert
  with check (
    exists (
      select 1 from profiles me
      join profiles target on target.id = profile_departments.profile_id
      where me.id = auth.uid()
        and me.company_id = target.company_id
        and me.role in ('CEO', 'COO', 'admin')
    )
  );

drop policy if exists profile_departments_delete_admin on profile_departments;
create policy profile_departments_delete_admin on profile_departments
  for delete
  using (
    exists (
      select 1 from profiles me
      join profiles target on target.id = profile_departments.profile_id
      where me.id = auth.uid()
        and me.company_id = target.company_id
        and me.role in ('CEO', 'COO', 'admin')
    )
  );

-- ─── (4) Append-only trigger on departments ─────────────────
-- Per §3.1 the company_id, created_by, and created_at are
-- immutable. Renames are allowed (name + description can
-- change); the org chart evolves. Archive uses archived_at,
-- not row deletion.
create or replace function preserve_department_immutable_cols()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.company_id := old.company_id;
  new.created_by := old.created_by;
  new.created_at := old.created_at;
  return new;
end;
$$;

drop trigger if exists departments_preserve_immutable on departments;
create trigger departments_preserve_immutable
  before update on departments
  for each row execute function preserve_department_immutable_cols();

-- ─── (5) Comments (DDL self-documentation) ──────────────────
comment on table departments is
  'Org-chart unit within a company. Pillar 1 of the §A6 asset
   classification triad — every classified file belongs to ≥1
   department (m2m via file_departments). Admin-managed:
   creation, rename, archive are all admins-only per founder
   red-pen 2026-06-19. Per §3.1 we soft-archive (archived_at);
   never delete a department because historical file
   classifications would lose their referent.';

comment on column departments.description is
  'Optional. Used by the AI classification suggester to read
   department semantics — "Engineering" vs "Customer Success"
   diverge in classifier signal when descriptions are present.
   A11 mirror — the System counts; user decides; better
   descriptions = higher-quality counts.';

comment on table profile_departments is
  'Many-to-many: a profile can belong to multiple departments,
   a department has many profiles. Admin-managed. The
   assigned_at column is the chain event timestamp; full audit
   history of assignments belongs in events (a future
   migration can emit org.department.assigned events on
   insert if §4 readout shows it matters).';

-- ─── End migration 0055. ────────────────────────────────────
