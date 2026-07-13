-- 0171 — PHASE 6: CUSTOM REPORT BUILDER (saved, shareable views of the ledger).
--
-- ── THE DESIGN DECISION THIS FEATURE IS ────────────────────────────────────────────────────────
--
-- "Let users build their own reports" has an obvious implementation: store the query they build, run it
-- when they open the report. It is obvious, it is flexible, and it is how a finance system grows an
-- arbitrary-SQL execution path pointed directly at the general ledger.
--
-- The danger is not only injection. It is that a stored query BYPASSES ROW-LEVEL SECURITY reasoning: RLS
-- protects TABLES, but a report engine that assembles SQL from user input and runs it — especially through
-- a SECURITY DEFINER function, which is the natural way to make a report engine work — runs it with the
-- DEFINER's authority, not the reader's. One report saved by one user, opened by another, and the ledger
-- of another tenant is one crafted string away.
--
-- So THERE IS NO STORED SQL HERE. A report definition is a set of CHOICES from a fixed vocabulary:
--   • which measure (debit / credit / net movement / closing balance)
--   • grouped by which dimension (account, account type, cost centre, project, month, vendor, customer)
--   • filtered to a date range, and optionally to one account type
--
-- Every one of those is a CHECK-constrained enum, validated by the database, not a string interpolated
-- into a query. The reporting function contains all the SQL there will ever be, written once, by us, with
-- auth_company_id() hard-wired into its WHERE clause. A user cannot express a query we did not write.
--
-- This is a genuine capability cost: someone will eventually want a report we cannot express, and they will
-- have to ask us. That is the correct trade. The alternative is a feature whose worst case is a
-- cross-tenant ledger dump, and no amount of flexibility is worth that.
--
-- Idempotent (§A12). NOT VERIFIED against a live database. BUILT, not TESTED.

create table if not exists fin_report_definitions (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  name        text not null,

  -- THE ENTIRE VOCABULARY. Not a query — a choice from a closed set, enforced by the database.
  measure     text not null default 'net'
    check (measure in ('debit','credit','net','closing_balance')),
  group_by    text not null default 'account'
    check (group_by in ('account','account_type','cost_center','project','month','vendor','customer')),
  account_type text
    check (account_type is null or account_type in ('asset','liability','equity','revenue','expense')),

  -- A relative window, so a saved report stays useful. An absolute range would silently go stale: the
  -- "this quarter" report someone saved in Q1 would still be showing Q1 in Q4, and it would look current.
  period     text not null default 'this_month'
    check (period in ('this_month','last_month','this_quarter','last_quarter','this_year','last_year','all_time')),

  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  constraint fin_report_name_uq unique (company_id, name)
);

-- ─── The only SQL a report will ever run. Written once, by us. ────────
-- auth_company_id() is hard-wired into the WHERE clause. It is not a parameter, so no caller — not the
-- API, not a crafted request — can substitute another tenant's id.
create or replace function fin_run_report(p_id uuid)
returns table (label text, amount numeric(19,4))
language plpgsql stable security definer set search_path = public as $$
declare
  d fin_report_definitions;
  v_from date; v_to date; v_co uuid;
begin
  v_co := auth_company_id();

  select * into d from fin_report_definitions where id = p_id and company_id = v_co;
  if d.id is null then
    raise exception 'Report not found in your company';
  end if;
  if not fin_can_view() then
    raise exception 'Not authorized to view finance reports';
  end if;

  -- Resolve the relative window at RUN time, not at save time.
  select case d.period
           when 'this_month'   then date_trunc('month', current_date)
           when 'last_month'   then date_trunc('month', current_date) - interval '1 month'
           when 'this_quarter' then date_trunc('quarter', current_date)
           when 'last_quarter' then date_trunc('quarter', current_date) - interval '3 months'
           when 'this_year'    then date_trunc('year', current_date)
           when 'last_year'    then date_trunc('year', current_date) - interval '1 year'
           else date '1900-01-01'
         end::date
    into v_from;

  select case d.period
           when 'last_month'   then (date_trunc('month', current_date) - interval '1 day')::date
           when 'last_quarter' then (date_trunc('quarter', current_date) - interval '1 day')::date
           when 'last_year'    then (date_trunc('year', current_date) - interval '1 day')::date
           else current_date
         end
    into v_to;

  -- closing_balance ignores the window's start: a balance is cumulative from the beginning of the ledger.
  -- Applying a date range to it would produce a "balance" that is really a movement — a number that looks
  -- like a balance sheet figure and is not one.
  if d.measure = 'closing_balance' then
    v_from := date '1900-01-01';
  end if;

  return query
  select
    case d.group_by
      when 'account'      then a.code || ' ' || a.name
      when 'account_type' then a.type
      when 'cost_center'  then coalesce(cc.name, 'Unassigned')
      when 'project'      then coalesce(pr.name, 'Unassigned')
      when 'month'        then to_char(e.entry_date, 'YYYY-MM')
      when 'vendor'       then coalesce(vn.name, 'None')
      when 'customer'     then coalesce(cu.name, 'None')
    end::text as label,
    case d.measure
      when 'debit'  then sum(l.base_debit)
      when 'credit' then sum(l.base_credit)
      -- 'net' and 'closing_balance' are both signed by the account's NORMAL side. Without this, expenses
      -- and revenue would carry opposite signs in the same column and a reader would silently compare them
      -- as if they were like quantities.
      else sum(
        case when a.normal_balance = 'debit'
             then l.base_debit  - l.base_credit
             else l.base_credit - l.base_debit
        end)
    end::numeric(19,4) as amount
  from fin_journal_lines l
  join fin_journal_entries e on e.id = l.entry_id
  join fin_accounts a        on a.id = l.account_id
  left join fin_cost_centers cc on cc.id = l.cost_center_id
  left join fin_projects     pr on pr.id = l.project_id
  -- Vendor/customer are reached through fin_source_postings (0122) — the entry does NOT carry a bill or
  -- invoice id of its own. Joining a column that does not exist is exactly the class of error that only
  -- surfaces at apply time, so these joins were written against the schema, not from memory.
  left join fin_source_postings sp_b on sp_b.entry_id = e.id and sp_b.source_type = 'ap_bill'
  left join fin_bills           b    on b.id  = sp_b.source_id
  left join fin_vendors         vn   on vn.id = b.vendor_id
  left join fin_source_postings sp_i on sp_i.entry_id = e.id and sp_i.source_type = 'ar_invoice'
  left join fin_invoices        iv   on iv.id = sp_i.source_id
  left join fin_customers       cu   on cu.id = iv.customer_id
  where l.company_id = v_co                 -- HARD-WIRED. Not a parameter. Not substitutable.
    and e.status     = 'posted'
    and e.entry_date between v_from and v_to
    and (d.account_type is null or a.type = d.account_type)
  group by 1
  having sum(l.base_debit) <> 0 or sum(l.base_credit) <> 0
  order by 2 desc;
end $$;

-- ─── RLS ──────────────────────────────────────────────────────────────
alter table fin_report_definitions enable row level security;

drop policy if exists "fin_reports - select" on fin_report_definitions;
create policy "fin_reports - select" on fin_report_definitions
  for select using (company_id = auth_company_id() and fin_can_view());

drop policy if exists "fin_reports - insert" on fin_report_definitions;
create policy "fin_reports - insert" on fin_report_definitions
  for insert with check (
    company_id = auth_company_id() and fin_can_view() and created_by = auth.uid()   -- §A23: pin the author
  );

-- A saved report is shared. Anyone who can view finance may build one; only the AUTHOR or a controller may
-- change or delete it — otherwise one user could silently redefine the report another user relies on and
-- reads every month, and the numbers would change with no visible cause.
drop policy if exists "fin_reports - update" on fin_report_definitions;
create policy "fin_reports - update" on fin_report_definitions
  for update using (
    company_id = auth_company_id() and (created_by = auth.uid() or fin_can_configure())
  ) with check (
    company_id = auth_company_id() and (created_by = auth.uid() or fin_can_configure())
  );

drop policy if exists "fin_reports - delete" on fin_report_definitions;
create policy "fin_reports - delete" on fin_report_definitions
  for delete using (
    company_id = auth_company_id() and (created_by = auth.uid() or fin_can_configure())
  );

-- §A23: freeze the tenant and the author on update.
create or replace function fin_report_freeze() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.company_id := old.company_id;
  new.created_by := old.created_by;
  return new;
end $$;
drop trigger if exists fin_report_freeze_trg on fin_report_definitions;
create trigger fin_report_freeze_trg before update on fin_report_definitions
  for each row execute function fin_report_freeze();
