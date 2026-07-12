-- 0140 — Financial System, Phase-2D: Recurring bills (rent, subscriptions, utilities)
--
-- A template that generates a DRAFT bill on a schedule. Generation creates a normal draft bill
-- (→ approve→GL→pay), so no accounting nuance. Manual "generate now" + a batch runner for a cron
-- (dormant until wired, like the app's other crons). Draft-lock not needed (templates aren't
-- posted docs); enter-level manages them.
--
-- Idempotent (A12). Audit-tracked.

create table if not exists fin_recurring_bills (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  vendor_id   uuid not null references fin_vendors(id) on delete restrict,
  description text not null,
  account_id  uuid not null references fin_accounts(id) on delete restrict,
  amount      numeric(19,4) not null check (amount >= 0),
  tax_amount  numeric(19,4) not null default 0 check (tax_amount >= 0),
  frequency   text not null check (frequency in ('weekly','monthly','quarterly','annual')),
  next_date   date not null,
  is_active   boolean not null default true,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists fin_recurring_company_idx on fin_recurring_bills (company_id, is_active, next_date);

-- Generate one bill from a template + advance next_date by the frequency. Returns the draft bill id.
create or replace function fin_generate_recurring_bill(p_template_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_company uuid; v_vendor uuid; v_desc text; v_acct uuid; v_amount numeric(19,4);
  v_tax numeric(19,4); v_freq text; v_date date; v_bill uuid; v_num text;
begin
  if not fin_can_enter() then raise exception 'Not authorized to generate recurring bills'; end if;
  select company_id, vendor_id, description, account_id, amount, tax_amount, frequency, next_date
    into v_company, v_vendor, v_desc, v_acct, v_amount, v_tax, v_freq, v_date
    from fin_recurring_bills where id = p_template_id and is_active;
  if v_company is null or v_company <> auth_company_id() then raise exception 'Recurring template not found in your company'; end if;

  v_num := 'REC-' || to_char(v_date, 'YYYYMMDD') || '-' || substr(p_template_id::text, 1, 4);
  insert into fin_bills (company_id, vendor_id, bill_number, bill_date, status, memo, created_by)
    values (v_company, v_vendor, v_num, v_date, 'draft', 'Recurring: ' || v_desc, auth.uid())
    returning id into v_bill;
  insert into fin_bill_lines (company_id, bill_id, line_no, account_id, description, amount, tax_amount)
    values (v_company, v_bill, 1, v_acct, v_desc, v_amount, v_tax);

  update fin_recurring_bills set next_date = case v_freq
    when 'weekly'    then next_date + interval '1 week'
    when 'monthly'   then next_date + interval '1 month'
    when 'quarterly' then next_date + interval '3 months'
    when 'annual'    then next_date + interval '1 year'
  end::date where id = p_template_id;

  return v_bill;  -- a DRAFT bill — approve it via the normal AP flow
end $$;

-- Batch runner for a scheduled job (dormant until wired to a cron with the finance service context).
-- Generates one bill per active template whose next_date has arrived. Returns the count generated.
create or replace function fin_run_due_recurring()
returns int language plpgsql security definer set search_path = public as $$
declare v_t record; v_n int := 0;
begin
  for v_t in
    select id from fin_recurring_bills
    where company_id = auth_company_id() and is_active and next_date <= current_date
  loop
    perform fin_generate_recurring_bill(v_t.id);
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

alter table fin_recurring_bills enable row level security;
drop policy if exists "fin_recurring - select" on fin_recurring_bills;
create policy "fin_recurring - select" on fin_recurring_bills for select using (company_id = auth_company_id() and fin_can_view());
drop policy if exists "fin_recurring - write" on fin_recurring_bills;
create policy "fin_recurring - write" on fin_recurring_bills for all using (company_id = auth_company_id() and fin_can_enter()) with check (company_id = auth_company_id() and fin_can_enter());

drop trigger if exists fin_audit_trg on fin_recurring_bills;
create trigger fin_audit_trg after insert or update or delete on fin_recurring_bills for each row execute function fin_audit();
