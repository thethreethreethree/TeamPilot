-- 0221 — Schedule Management System, Phase 2: the standalone staff roster.
--
-- Founder decision (2026-08-19): the scheduling system is a STANDALONE tool. A company enters its
-- staff here directly — name, role, skills, hours — with NO dependency on an Elostate/auth account.
-- The managers/admins USING the tool are Elostate users (they are the actor_id on schedule_event);
-- the STAFF being scheduled are plain rows here. A future migration will add an optional user_id to
-- link a staff member to an Elostate account when that feature opens; it is deliberately absent now
-- (no dead column — A31).
--
-- Why a MUTABLE table, not event-sourced: 3.1's event-sourcing governs SCHEDULE STATE (who works
-- when — the record retrospective analysis reasons over), not the ROSTER of people. The roster is
-- master data, like `profiles`/`companies` (both mutable tables). Adding/editing/removing a staff
-- member is ordinary CRUD, not a schedule event. schedule_event references these ids.

create table if not exists schedule_employee (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references companies(id) on delete cascade,
  name             text not null,
  role             text,                                  -- e.g. 'nurse', 'cashier' (matches coverage min_by_role)
  employment_type  text,                                  -- e.g. 'full_time' | 'part_time' | 'contractor'
  skills           text[] not null default '{}',
  certifications   text[] not null default '{}',
  max_hours_week   numeric,                               -- labor limit; null = no cap
  min_hours_week   numeric,                               -- target floor; null = none
  status           text not null default 'active',        -- 'active' | 'inactive'
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists schedule_employee_company_idx on schedule_employee (company_id);
create index if not exists schedule_employee_company_status_idx on schedule_employee (company_id, status);

-- keep updated_at honest on edits
create or replace function schedule_employee_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists schedule_employee_touch on schedule_employee;
create trigger schedule_employee_touch
  before update on schedule_employee
  for each row execute function schedule_employee_touch_updated_at();

-- RLS: tenant-scoped. A company's members read/write their own roster. (Manager-only WRITE
-- authorization is enforced at the API layer alongside RQ6 — the same role-gate the append route
-- flags — when the Phase-5 management UI ships; the table itself is company-scoped.)
alter table schedule_employee enable row level security;

drop policy if exists "schedule_employee tenant" on schedule_employee;
create policy "schedule_employee tenant" on schedule_employee
  for all
  using (company_id = auth_company_id())
  with check (company_id = auth_company_id());
