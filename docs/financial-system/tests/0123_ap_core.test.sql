-- 0123 acceptance — AP core (vendors + bills). Staging, 0116-0123 applied. Rollback; NOTICE.
-- Structure/constraint checks are service-role-testable. The approve→GL flow (fin_approve_bill →
-- fin_post_system_entry) needs a real approver + open period and is app-layer.

begin;

insert into companies (id, name) values ('00000000-0000-0000-0000-0000000000c1','ACCEPT Co')
  on conflict (id) do nothing;
insert into fin_settings (company_id, base_currency) values ('00000000-0000-0000-0000-0000000000c1','USD')
  on conflict (company_id) do nothing;

-- Tax Receivable (1200) backfill from 0123 should exist for an initialized company. (This test
-- inserts settings directly, so simulate the backfill target.)
insert into fin_accounts (company_id, code, name, type, normal_balance)
  values ('00000000-0000-0000-0000-0000000000c1','6000','Operating Expenses','expense','debit')
  on conflict (company_id, code) do nothing;

insert into fin_vendors (id, company_id, name)
  values ('00000000-0000-0000-0000-00000000d001','00000000-0000-0000-0000-0000000000c1','Acme Supplies')
  on conflict (id) do nothing;

-- unique vendor name per company
do $$ begin
  begin
    insert into fin_vendors (company_id, name) values ('00000000-0000-0000-0000-0000000000c1','Acme Supplies');
    raise notice 'VENDOR FAIL: duplicate vendor name accepted';
  exception when unique_violation then raise notice 'VENDOR PASS: duplicate vendor name rejected'; end;
end $$;

-- bill line amount must be >= 0
do $$ declare b uuid; begin
  insert into fin_bills (id, company_id, vendor_id, bill_number, bill_date)
    values ('00000000-0000-0000-0000-00000000b001','00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-00000000d001','INV-1','2026-07-15');
  begin
    insert into fin_bill_lines (company_id, bill_id, line_no, account_id, amount)
      values ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-00000000b001',1,
              (select id from fin_accounts where company_id='00000000-0000-0000-0000-0000000000c1' and code='6000'), -5);
    raise notice 'BILL FAIL: negative bill line amount accepted';
  exception when check_violation then raise notice 'BILL PASS: negative amount rejected'; end;

  -- unique bill number per vendor
  begin
    insert into fin_bills (company_id, vendor_id, bill_number, bill_date)
      values ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-00000000d001','INV-1','2026-07-16');
    raise notice 'BILL FAIL: duplicate bill number for vendor accepted';
  exception when unique_violation then raise notice 'BILL PASS: duplicate bill number rejected'; end;
end $$;

rollback;

-- APP-LAYER (needs a real approver + open period): fin_approve_bill posts a BALANCED GL entry
-- (Dr expense lines + Dr Tax Receivable + Cr Accounts Payable = grand total), links it in
-- fin_source_postings, flips the bill to 'approved', and only fin_can_approve() may call it;
-- double-approval is blocked (draft-only). SoD is intentionally skipped (Decision 1). Drive via the
-- AP UI/API integration tests.
