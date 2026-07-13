-- 0150 — Financial System, PHASE 7 (part 1): tax codes + liability report + Retained Earnings seed.
-- Founder-confirmed: tax-code catalog, optional auto-calc on lines, build year-end close (0151).
--
-- Tax is already booked to Tax Payable (2100, output/sales) and Tax Receivable (1200, input/
-- purchases) by the posting functions. This adds the RATE catalog + a nullable tax_code_id on lines
-- (for auto-calc in the UI + jurisdiction reporting), and a filing report derived from the source
-- lines' tax_amount grouped by the code's jurisdiction. Idempotent. Author pinned+frozen.

create table if not exists fin_tax_codes (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references companies(id) on delete cascade,
  code         text not null,
  name         text not null,
  jurisdiction text,
  rate_pct     numeric(6,3) not null check (rate_pct >= 0 and rate_pct <= 100),
  kind         text not null default 'sales' check (kind in ('sales','vat','gst')),
  direction    text not null check (direction in ('output','input')),   -- output = on sales, input = on purchases
  is_active    boolean not null default true,
  created_by   uuid default auth.uid() references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  constraint fin_tax_codes_code_uq unique (company_id, code)
);
create index if not exists fin_tax_codes_company_idx on fin_tax_codes (company_id, is_active);

-- Which tax code applied to a line (nullable; null = manually-entered tax, still valid).
alter table fin_bill_lines    add column if not exists tax_code_id uuid references fin_tax_codes(id) on delete set null;
alter table fin_invoice_lines add column if not exists tax_code_id uuid references fin_tax_codes(id) on delete set null;

-- (Year-end close targets the Retained Earnings account seeded by fin_init_company as code 3000 —
-- see 0151. An earlier revision seeded a SECOND "Retained Earnings" as 3900 here, which (a) duplicated
-- the account name and (b) was a one-time backfill absent from fin_init_company, so any company
-- initialized AFTER this migration applied would have no 3900 and year-end close would fail. Both fixed
-- by pointing the close at the existing 3000; no 3900 seed is needed.)

-- ── Tax filing report: output tax (issued invoices) − input tax (approved bills) over [from,to],
--    grouped by the code's jurisdiction. Derived from the SOURCE lines' tax_amount (so it needs no GL
--    tax tagging); lines with no tax code fall under 'Unassigned'. security_invoker → tenant-safe. ──
-- KNOWN LIMITATION (flagged 2026-07-13, awaiting a founder decision): output_tax is GROSS — it does
-- not subtract the output tax reversed by ISSUED credit notes (which Dr Taxes Payable 2100). So for a
-- period containing credited invoices this overstates the liability (the GL 2100 balance IS correct;
-- only this report is un-netted). Netting is deferred because credit-note lines carry no tax_code_id,
-- hence no jurisdiction — attributing a credit's tax to a jurisdiction (linked invoice's? proportional?
-- Unassigned?) is a design decision, not a mechanical fix. The Tax page shows a matching warning so no
-- one files from a wrong number unknowingly. Do NOT silently guess the attribution here.
create or replace function fin_tax_report(p_from date default null, p_to date default null)
returns jsonb language sql stable security invoker set search_path = public as $$
  with out_tax as (
    select coalesce(tc.jurisdiction, 'Unassigned') as jur, sum(il.tax_amount) as amt
    from fin_invoice_lines il
    join fin_invoices i on i.id = il.invoice_id
    left join fin_tax_codes tc on tc.id = il.tax_code_id
    where i.company_id = auth_company_id() and i.status in ('sent','paid') and il.tax_amount > 0
      and (p_from is null or i.invoice_date >= p_from) and (p_to is null or i.invoice_date <= p_to)
    group by coalesce(tc.jurisdiction, 'Unassigned')
  ),
  in_tax as (
    select coalesce(tc.jurisdiction, 'Unassigned') as jur, sum(bl.tax_amount) as amt
    from fin_bill_lines bl
    join fin_bills b on b.id = bl.bill_id
    left join fin_tax_codes tc on tc.id = bl.tax_code_id
    where b.company_id = auth_company_id() and b.status in ('approved','paid') and bl.tax_amount > 0
      and (p_from is null or b.bill_date >= p_from) and (p_to is null or b.bill_date <= p_to)
    group by coalesce(tc.jurisdiction, 'Unassigned')
  ),
  jur as (select jur from out_tax union select jur from in_tax)
  select jsonb_build_object(
    'rows', coalesce(jsonb_agg(jsonb_build_object(
      'jurisdiction', j.jur,
      'output_tax', coalesce(o.amt, 0),
      'input_tax',  coalesce(i.amt, 0),
      'net_tax',    coalesce(o.amt, 0) - coalesce(i.amt, 0)
    ) order by j.jur), '[]'::jsonb),
    'total_output', (select coalesce(sum(amt),0) from out_tax),
    'total_input',  (select coalesce(sum(amt),0) from in_tax),
    'total_net',    (select coalesce(sum(amt),0) from out_tax) - (select coalesce(sum(amt),0) from in_tax)
  )
  from jur j
  left join out_tax o on o.jur = j.jur
  left join in_tax  i on i.jur = j.jur;
$$;

-- ── RLS: tax codes are configure-level (they change how tax posts); author pinned+frozen. ──
alter table fin_tax_codes enable row level security;
drop policy if exists "fin_tax_codes - select" on fin_tax_codes;
create policy "fin_tax_codes - select" on fin_tax_codes
  for select using (company_id = auth_company_id() and fin_can_view());
drop policy if exists "fin_tax_codes - insert" on fin_tax_codes;
create policy "fin_tax_codes - insert" on fin_tax_codes
  for insert with check (company_id = auth_company_id() and fin_can_configure() and created_by = auth.uid());
drop policy if exists "fin_tax_codes - update" on fin_tax_codes;
create policy "fin_tax_codes - update" on fin_tax_codes
  for update using (company_id = auth_company_id() and fin_can_configure())
  with check (company_id = auth_company_id() and fin_can_configure());

drop trigger if exists fin_freeze_creator on fin_tax_codes;
create trigger fin_freeze_creator before update on fin_tax_codes for each row execute function fin_freeze_created_by();
drop trigger if exists fin_audit_trg on fin_tax_codes;
create trigger fin_audit_trg after insert or update or delete on fin_tax_codes for each row execute function fin_audit();
