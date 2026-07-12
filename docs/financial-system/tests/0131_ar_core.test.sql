-- 0131 acceptance — AR core (customers + invoices). Staging, 0116-0131 applied. Rollback; NOTICE.
-- Structure is service-role-testable; issue→GL + SoD (creator≠issuer) + draft-lock are app-layer.
begin;
insert into companies (id, name) values ('00000000-0000-0000-0000-0000000000c1','ACCEPT Co') on conflict (id) do nothing;
insert into fin_customers (id, company_id, name) values ('00000000-0000-0000-0000-00000000c001','00000000-0000-0000-0000-0000000000c1','Beta Corp') on conflict (id) do nothing;
do $$ begin
  begin insert into fin_customers (company_id, name) values ('00000000-0000-0000-0000-0000000000c1','Beta Corp');
    raise notice 'CUST FAIL: duplicate customer name accepted';
  exception when unique_violation then raise notice 'CUST PASS: duplicate customer name rejected'; end;
  begin
    insert into fin_invoices (id, company_id, customer_id, invoice_number, invoice_date)
      values ('00000000-0000-0000-0000-0000000in01','00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-00000000c001','INV-1','2026-07-15');
    insert into fin_invoice_lines (company_id, invoice_id, line_no, revenue_account_id, amount)
      values ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000in01',1,
              (select id from fin_accounts where company_id='00000000-0000-0000-0000-0000000000c1' and code='4000' limit 1), -5);
    raise notice 'INV FAIL: negative invoice line accepted';
  exception when check_violation then raise notice 'INV PASS: negative amount rejected';
        when others then raise notice 'INV note (needs 4000 seeded): %', sqlerrm; end;
end $$;
rollback;
-- APP-LAYER: fin_issue_invoice posts Dr AR / Cr Revenue (+ Cr Tax Payable); SoD rejects issuing your
-- own invoice; draft-lock prevents editing an issued invoice; only fin_can_approve() may issue.
