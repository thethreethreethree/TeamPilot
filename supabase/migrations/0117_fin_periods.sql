-- 0117 — Financial System, Increment 2: Fiscal periods (open / close / lock)
--
-- Built to the confirmed model. Periods gate posting (an entry may only post into an OPEN period)
-- and make closed history immutable. The entry/line immutability TRIGGER that enforces
-- closed-period immutability lives with the ledger (Increment 3), because it references the
-- journal tables that don't exist yet — noted at the bottom. This increment delivers the period
-- table, the non-overlap guarantee, and the close/reopen/lock RPCs (gated to controller/cfo).
--
-- Idempotent (A12). Acceptance: docs/financial-system/tests/0117_periods.test.sql
-- (T-20 non-overlap; status transitions; manage-period authority).

create table if not exists fin_periods (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name       text not null,
  start_date date not null,
  end_date   date not null,
  status     text not null default 'open' check (status in ('open','closed','locked')),
  closed_by  uuid references auth.users(id) on delete set null,
  closed_at  timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  constraint fin_periods_dates_ck check (end_date >= start_date),
  constraint fin_periods_company_name_uq unique (company_id, name)
);

create index if not exists fin_periods_company_idx on fin_periods (company_id, start_date, end_date);

-- T-20: no two periods in the same company may overlap. daterange '[]' is inclusive on both ends;
-- the && overlap operator needs no extension. Checked on insert AND update of the date range.
create or replace function fin_periods_no_overlap()
returns trigger language plpgsql
security definer set search_path = public as $$
begin
  if exists (
    select 1 from fin_periods p
    where p.company_id = NEW.company_id
      and p.id <> NEW.id
      and daterange(p.start_date, p.end_date, '[]') && daterange(NEW.start_date, NEW.end_date, '[]')
  ) then
    raise exception 'fin_periods: date range %..% overlaps an existing period in this company',
      NEW.start_date, NEW.end_date;
  end if;
  return NEW;
end $$;

drop trigger if exists fin_periods_no_overlap_trg on fin_periods;
create trigger fin_periods_no_overlap_trg
  before insert or update of start_date, end_date, company_id on fin_periods
  for each row execute function fin_periods_no_overlap();

-- ── Status-transition RPCs (gated to controller/cfo via fin_can_manage_periods) ──
-- Allowed: open->closed (close), closed->open (reopen), closed->locked (lock).
-- NOT allowed here: locked->anything. A locked period (year-end hard lock) requires an explicit,
-- separately-authorized unlock — FLAGGED as a deliberate gap, to be built as an audited
-- fin_unlock_period (cfo + reason) in a later increment, so year-end locks aren't casually undone.

create or replace function fin_close_period(p_period_id uuid)
returns void language plpgsql
security definer set search_path = public as $$
declare v_status text; v_company uuid;
begin
  if not fin_can_manage_periods() then
    raise exception 'Not authorized to close periods';
  end if;
  select status, company_id into v_status, v_company from fin_periods where id = p_period_id;
  if v_company is null or v_company <> auth_company_id() then
    raise exception 'Period not found in your company';
  end if;
  if v_status <> 'open' then
    raise exception 'Only an OPEN period can be closed (current: %)', v_status;
  end if;
  update fin_periods
    set status = 'closed', closed_by = auth.uid(), closed_at = now()
    where id = p_period_id;
end $$;

create or replace function fin_reopen_period(p_period_id uuid)
returns void language plpgsql
security definer set search_path = public as $$
declare v_status text; v_company uuid;
begin
  if not fin_can_manage_periods() then
    raise exception 'Not authorized to reopen periods';
  end if;
  select status, company_id into v_status, v_company from fin_periods where id = p_period_id;
  if v_company is null or v_company <> auth_company_id() then
    raise exception 'Period not found in your company';
  end if;
  if v_status <> 'closed' then
    raise exception 'Only a CLOSED period can be reopened (locked periods need an explicit unlock; current: %)', v_status;
  end if;
  update fin_periods set status = 'open', closed_by = null, closed_at = null where id = p_period_id;
end $$;

create or replace function fin_lock_period(p_period_id uuid)
returns void language plpgsql
security definer set search_path = public as $$
declare v_status text; v_company uuid;
begin
  if fin_effective_role() <> 'cfo' then
    raise exception 'Only a CFO-level role can lock a period';
  end if;
  select status, company_id into v_status, v_company from fin_periods where id = p_period_id;
  if v_company is null or v_company <> auth_company_id() then
    raise exception 'Period not found in your company';
  end if;
  if v_status <> 'closed' then
    raise exception 'Only a CLOSED period can be locked (current: %)', v_status;
  end if;
  update fin_periods set status = 'locked' where id = p_period_id;
end $$;

-- ── RLS ──
alter table fin_periods enable row level security;

drop policy if exists "fin_periods - select" on fin_periods;
create policy "fin_periods - select" on fin_periods
  for select using (company_id = auth_company_id() and fin_can_view());

-- Create/rename periods requires manage-period authority. Status changes should go through the
-- RPCs above (they stamp closed_by/closed_at and enforce the transition rules), but a
-- manage-period user may also correct period metadata directly within their company.
drop policy if exists "fin_periods - write" on fin_periods;
create policy "fin_periods - write" on fin_periods
  for all using (company_id = auth_company_id() and fin_can_manage_periods())
  with check (company_id = auth_company_id() and fin_can_manage_periods());

-- FLAGGED for Increment 3 (needs the journal tables): the trigger on fin_journal_entries /
-- fin_journal_lines that REJECTS any insert/update/delete affecting an entry whose period is
-- closed or locked (T-18), and the post-RPC check that posting requires an OPEN period (T-19).
-- Those enforce the immutability this table's status field represents; they ship with the ledger.
