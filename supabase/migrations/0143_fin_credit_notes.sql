-- 0143 — Financial System, Phase-2D: Credit Notes (founder-confirmed 2026-07-13).
--
-- Decisions (CREDIT-NOTES-DATA-MODEL.md): (1) CONTRA-REVENUE treatment — debit a new 4900 "Sales
-- Returns & Allowances" account (keeps gross revenue visible on the P&L); (2) AGAINST ONE INVOICE —
-- a credit targets a specific issued invoice and reduces its outstanding; (3) CREDIT NOTES ONLY (no
-- cash refunds yet); (+ defaults) line-based like invoices, and a credit may NOT exceed the invoice's
-- outstanding (total - received - prior credits).
--
-- A credit note reverses part of an issued invoice (which posted Dr AR / Cr Revenue / Cr Tax Payable):
--   Dr 4900 Sales Returns (each line) + Dr 2100 Taxes Payable (reverse output tax) / Cr 1100 AR (grand).
-- Append-only: corrections via another credit note or a reversing entry, never by editing an issued one.
--
-- Applies this session's authz lessons up front: created_by pinned (RLS + default) AND frozen on UPDATE
-- (0142), SoD (creator <> issuer), capability-gated, draft-locked, company_id in every with-check.
-- Idempotent (A12).

-- ── Contra-revenue account (type='revenue', credit-normal; it accumulates DEBITS from credits, so its
--    balance goes negative and nets DOWN total revenue — the correct contra behaviour without a
--    dedicated contra flag). Backfill for already-initialized companies; the RPC also resolve-or-creates
--    it, so a company that initialized before 0143 is covered either way. ──
insert into fin_accounts (company_id, code, name, type, normal_balance, is_system)
select s.company_id, '4900', 'Sales Returns & Allowances', 'revenue', 'credit', true
from fin_settings s
where not exists (select 1 from fin_accounts a where a.company_id = s.company_id and a.code = '4900');

create table if not exists fin_credit_notes (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies(id) on delete cascade,
  customer_id   uuid not null references fin_customers(id) on delete restrict,
  invoice_id    uuid not null references fin_invoices(id) on delete restrict,
  credit_number text not null,
  credit_date   date not null,
  reason        text,
  memo          text,
  status        text not null default 'draft' check (status in ('draft','issued')),
  posted_entry_id uuid references fin_journal_entries(id) on delete restrict,
  created_by    uuid default auth.uid() references auth.users(id) on delete set null,
  issued_by     uuid references auth.users(id) on delete set null,
  issued_at     timestamptz,
  created_at    timestamptz not null default now(),
  constraint fin_credit_notes_number_uq unique (company_id, credit_number)
);
create index if not exists fin_credit_notes_invoice_idx on fin_credit_notes (invoice_id) where status = 'issued';
create index if not exists fin_credit_notes_company_status_idx on fin_credit_notes (company_id, status);

create table if not exists fin_credit_note_lines (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references companies(id) on delete cascade,
  credit_note_id uuid not null references fin_credit_notes(id) on delete cascade,
  line_no        int not null,
  description    text,
  amount         numeric(19,4) not null check (amount >= 0),
  tax_amount     numeric(19,4) not null default 0 check (tax_amount >= 0)
);
create index if not exists fin_credit_note_lines_note_idx on fin_credit_note_lines (credit_note_id);

-- Issue a credit note → post the reversing GL entry, reduce the invoice's outstanding, mark issued.
create or replace function fin_issue_credit_note(p_credit_note_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_company uuid; v_status text; v_date date; v_creator uuid; v_invoice uuid;
  v_ccy char(3); v_period uuid; v_ar uuid; v_taxpay uuid; v_returns uuid;
  v_lines jsonb; v_tax numeric(19,4); v_grand numeric(19,4);
  v_inv_total numeric(19,4); v_received numeric(19,4); v_prior numeric(19,4); v_outstanding numeric(19,4);
  v_inv_status text; v_entry uuid;
begin
  if not fin_can_approve() then raise exception 'Not authorized to issue credit notes'; end if;
  select company_id, status, credit_date, created_by, invoice_id
    into v_company, v_status, v_date, v_creator, v_invoice
    from fin_credit_notes where id = p_credit_note_id;
  if v_company is null or v_company <> auth_company_id() then raise exception 'Credit note not found in your company'; end if;
  if v_status <> 'draft' then raise exception 'Only a draft credit note can be issued (current: %)', v_status; end if;
  -- Segregation of duties: the person who entered it cannot issue it.
  if v_creator = auth.uid() then raise exception 'Segregation of duties: you cannot issue a credit note you created'; end if;

  -- The invoice must be issued (has a receivable to reduce).
  select status, currency into v_inv_status, v_ccy from fin_invoices where id = v_invoice;
  if v_inv_status is null then raise exception 'Linked invoice not found'; end if;
  if v_inv_status <> 'sent' then raise exception 'Credit notes apply to an issued (sent) invoice with an open balance (invoice is %)', v_inv_status; end if;

  select id into v_period from fin_periods
    where company_id = v_company and status = 'open' and v_date between start_date and end_date
    order by start_date desc limit 1;
  if v_period is null then raise exception 'No OPEN period covers the credit date %', v_date; end if;

  -- Over-credit guard: the new credit cannot exceed the invoice's current outstanding.
  v_inv_total := (select coalesce(sum(amount + tax_amount),0) from fin_invoice_lines where invoice_id = v_invoice);
  v_received  := (select coalesce(sum(amount),0) from fin_receipts where invoice_id = v_invoice);
  v_prior     := (select coalesce(sum(cl.amount + cl.tax_amount),0)
                    from fin_credit_note_lines cl join fin_credit_notes cn on cn.id = cl.credit_note_id
                    where cn.invoice_id = v_invoice and cn.status = 'issued');
  v_outstanding := v_inv_total - v_received - v_prior;

  select coalesce(sum(amount + tax_amount),0), coalesce(sum(tax_amount),0)
    into v_grand, v_tax
    from fin_credit_note_lines where credit_note_id = p_credit_note_id;
  if v_grand <= 0 then raise exception 'Credit note has no lines / zero amount'; end if;
  if v_grand > v_outstanding then
    raise exception 'Credit (%.2f) exceeds the invoice outstanding (%.2f)', v_grand, v_outstanding;
  end if;

  -- Resolve-or-create the contra-revenue + control accounts.
  v_ar     := fin_account_by_code(v_company, '1100');
  v_taxpay := fin_account_by_code(v_company, '2100');
  v_returns := fin_account_by_code(v_company, '4900');
  if v_returns is null then
    insert into fin_accounts (company_id, code, name, type, normal_balance, is_system)
      values (v_company, '4900', 'Sales Returns & Allowances', 'revenue', 'credit', true)
      returning id into v_returns;
  end if;
  if v_ar is null then raise exception 'Accounts Receivable (1100) missing — initialize finance'; end if;

  -- Dr 4900 Sales Returns for the net line amount (reduces revenue).
  v_lines := jsonb_build_array(jsonb_build_object(
    'account_id', v_returns, 'debit', (v_grand - v_tax), 'credit', 0, 'currency', v_ccy, 'memo', 'Sales returns/allowance'));
  -- Dr Tax Payable to reverse the output tax originally charged.
  if v_tax > 0 then
    if v_taxpay is null then raise exception 'Taxes Payable (2100) missing'; end if;
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'account_id', v_taxpay, 'debit', v_tax, 'credit', 0, 'currency', v_ccy, 'memo', 'Reverse output tax'));
  end if;
  -- Cr Accounts Receivable for the grand total (reduces what the customer owes).
  v_lines := v_lines || jsonb_build_array(jsonb_build_object(
    'account_id', v_ar, 'debit', 0, 'credit', v_grand, 'currency', v_ccy, 'memo', 'Accounts Receivable'));

  v_entry := fin_post_system_entry(v_company, v_date, v_period,
    'Credit note ' || (select credit_number from fin_credit_notes where id = p_credit_note_id), 'ar', v_lines);
  insert into fin_source_postings (company_id, source_type, source_id, entry_id, kind)
    values (v_company, 'ar_credit_note', p_credit_note_id, v_entry, 'issue');
  update fin_credit_notes set status = 'issued', issued_by = auth.uid(), issued_at = now(),
    posted_entry_id = v_entry where id = p_credit_note_id;
  return v_entry;
end $$;

-- ── The outstanding ripple: subtract ISSUED credits from the invoice's outstanding everywhere it's
--    derived, or a credited invoice keeps showing as fully owed. ──
create or replace view fin_invoice_summary with (security_invoker = true) as
select
  i.id, i.company_id, i.customer_id, i.invoice_number, i.invoice_date, i.due_date, i.currency, i.status,
  (select coalesce(sum(l.amount + l.tax_amount), 0) from fin_invoice_lines l where l.invoice_id = i.id) as total,
  (select coalesce(sum(r.amount), 0) from fin_receipts r where r.invoice_id = i.id) as received,
  (select coalesce(sum(cl.amount + cl.tax_amount), 0)
     from fin_credit_note_lines cl join fin_credit_notes cn on cn.id = cl.credit_note_id
     where cn.invoice_id = i.id and cn.status = 'issued') as credited
from fin_invoices i;

create or replace view fin_ar_aging with (security_invoker = true) as
select
  i.company_id,
  i.id            as invoice_id,
  i.invoice_number,
  i.customer_id,
  c.name          as customer_name,
  i.invoice_date,
  i.due_date,
  (select coalesce(sum(l.amount + l.tax_amount),0) from fin_invoice_lines l where l.invoice_id = i.id)
    - (select coalesce(sum(r.amount),0) from fin_receipts r where r.invoice_id = i.id)
    - (select coalesce(sum(cl.amount + cl.tax_amount),0)
         from fin_credit_note_lines cl join fin_credit_notes cn on cn.id = cl.credit_note_id
         where cn.invoice_id = i.id and cn.status = 'issued') as outstanding,
  case when i.due_date is null then null else (current_date - i.due_date) end as days_overdue
from fin_invoices i
join fin_customers c on c.id = i.customer_id
where i.status = 'sent';

-- Summary view for list surfaces (total derived in SQL, mirrors fin_invoice_summary).
create or replace view fin_credit_note_summary with (security_invoker = true) as
select cn.id, cn.company_id, cn.customer_id, cn.invoice_id, cn.credit_number, cn.credit_date,
       cn.status, cn.reason,
       (select coalesce(sum(l.amount + l.tax_amount),0) from fin_credit_note_lines l where l.credit_note_id = cn.id) as total
from fin_credit_notes cn;

-- ── RLS (draft-lock + created_by pin, this session's pattern) ──
alter table fin_credit_notes      enable row level security;
alter table fin_credit_note_lines enable row level security;

drop policy if exists "fin_credit_notes - select" on fin_credit_notes;
create policy "fin_credit_notes - select" on fin_credit_notes
  for select using (company_id = auth_company_id() and fin_can_view());
drop policy if exists "fin_credit_notes - insert" on fin_credit_notes;
create policy "fin_credit_notes - insert" on fin_credit_notes
  for insert with check (company_id = auth_company_id() and fin_can_enter() and status = 'draft' and created_by = auth.uid());
drop policy if exists "fin_credit_notes - update draft" on fin_credit_notes;
create policy "fin_credit_notes - update draft" on fin_credit_notes
  for update using (company_id = auth_company_id() and fin_can_enter() and status = 'draft')
  with check (company_id = auth_company_id() and fin_can_enter() and status = 'draft');
drop policy if exists "fin_credit_notes - delete draft" on fin_credit_notes;
create policy "fin_credit_notes - delete draft" on fin_credit_notes
  for delete using (company_id = auth_company_id() and fin_can_enter() and status = 'draft');

drop policy if exists "fin_credit_note_lines - select" on fin_credit_note_lines;
create policy "fin_credit_note_lines - select" on fin_credit_note_lines
  for select using (company_id = auth_company_id() and fin_can_view());
drop policy if exists "fin_credit_note_lines - write draft" on fin_credit_note_lines;
create policy "fin_credit_note_lines - write draft" on fin_credit_note_lines
  for all
  using (company_id = auth_company_id() and fin_can_enter()
         and exists (select 1 from fin_credit_notes n where n.id = credit_note_id and n.status = 'draft'))
  with check (company_id = auth_company_id() and fin_can_enter()
         and exists (select 1 from fin_credit_notes n where n.id = credit_note_id and n.status = 'draft'));

-- created_by freeze (0142 lesson: INSERT pin is not enough — freeze re-attribution on UPDATE too).
drop trigger if exists fin_freeze_creator on fin_credit_notes;
create trigger fin_freeze_creator before update on fin_credit_notes
  for each row execute function fin_freeze_created_by();

-- Audit trail.
drop trigger if exists fin_audit_trg on fin_credit_notes;
create trigger fin_audit_trg after insert or update or delete on fin_credit_notes for each row execute function fin_audit();
drop trigger if exists fin_audit_trg on fin_credit_note_lines;
create trigger fin_audit_trg after insert or update or delete on fin_credit_note_lines for each row execute function fin_audit();
