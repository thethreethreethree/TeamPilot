-- 0143 acceptance — credit-note outstanding ripple. Staging with 0116-0143 applied. Rollback; NOTICE.
--
-- Tests the part most likely to break AND service-role testable: fin_invoice_summary + fin_ar_aging
-- must subtract ISSUED credit notes from an invoice's outstanding (a credited invoice must not keep
-- showing as fully owed), and DRAFT credits must NOT count. The posting itself (Dr Sales Returns 4900
-- / Cr AR) + SoD + over-credit guard live in fin_issue_credit_note, which is auth-gated (fin_can_
-- approve) → exercised at the app/staging layer, not here. UUIDs are valid hex (lesson from 881c8c5).

begin;

insert into companies (id, name) values ('00000000-0000-0000-0000-0000000000c1','ACCEPT Co')
  on conflict (id) do nothing;
insert into fin_settings (company_id, base_currency) values ('00000000-0000-0000-0000-0000000000c1','USD')
  on conflict (company_id) do nothing;
insert into fin_accounts (company_id, code, name, type, normal_balance) values
  ('00000000-0000-0000-0000-0000000000c1','1100','Accounts Receivable','asset','debit'),
  ('00000000-0000-0000-0000-0000000000c1','4000','Revenue','revenue','credit'),
  ('00000000-0000-0000-0000-0000000000c1','4900','Sales Returns & Allowances','revenue','credit')
  on conflict (company_id, code) do nothing;
insert into fin_customers (id, company_id, name)
  values ('00000000-0000-0000-0000-00000000c001','00000000-0000-0000-0000-0000000000c1','Beta Co')
  on conflict (id) do nothing;

-- An ISSUED (sent) invoice with a 300 line.
insert into fin_invoices (id, company_id, customer_id, invoice_number, invoice_date, due_date, status)
  values ('00000000-0000-0000-0000-00000000f001','00000000-0000-0000-0000-0000000000c1',
          '00000000-0000-0000-0000-00000000c001','INV-CN','2026-07-01','2026-07-31','sent')
  on conflict (id) do nothing;
insert into fin_invoice_lines (company_id, invoice_id, line_no, revenue_account_id, amount, tax_amount)
  values ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-00000000f001',1,
          (select id from fin_accounts where company_id='00000000-0000-0000-0000-0000000000c1' and code='4000'),
          300, 0)
  on conflict do nothing;

-- An ISSUED credit note of 50 against that invoice, and a DRAFT credit note of 100 (must NOT count).
insert into fin_credit_notes (id, company_id, customer_id, invoice_id, credit_number, credit_date, status) values
  ('00000000-0000-0000-0000-0000000cd001','00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-00000000c001','00000000-0000-0000-0000-00000000f001','CN-1','2026-07-10','issued'),
  ('00000000-0000-0000-0000-0000000cd002','00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-00000000c001','00000000-0000-0000-0000-00000000f001','CN-2','2026-07-11','draft')
  on conflict (id) do nothing;
insert into fin_credit_note_lines (company_id, credit_note_id, line_no, amount, tax_amount) values
  ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000cd001',1,50,0),
  ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000cd002',1,100,0)
  on conflict do nothing;

do $$ declare v_total numeric; v_credited numeric; v_outstanding numeric;
begin
  select total, credited into v_total, v_credited
    from fin_invoice_summary where id = '00000000-0000-0000-0000-00000000f001';
  if v_total = 300 then raise notice 'SUMMARY PASS: invoice total = 300'; else raise notice 'SUMMARY FAIL: total = % (want 300)', v_total; end if;
  -- Only the ISSUED credit (50) counts; the DRAFT (100) must NOT.
  if v_credited = 50 then raise notice 'SUMMARY PASS: credited = 50 (issued only; draft 100 excluded)';
  else raise notice 'SUMMARY FAIL: credited = % (want 50 — draft must not count)', v_credited; end if;

  select outstanding into v_outstanding
    from fin_ar_aging where invoice_id = '00000000-0000-0000-0000-00000000f001';
  -- 300 total - 0 received - 50 issued-credit = 250.
  if v_outstanding = 250 then raise notice 'AGING PASS: outstanding = 250 (300 - 50 issued credit)';
  else raise notice 'AGING FAIL: outstanding = % (want 250)', v_outstanding; end if;
end $$;

rollback;

-- APP-LAYER (auth-gated): fin_issue_credit_note posts a BALANCED reversing entry (Dr 4900 net + Dr
-- 2100 tax / Cr 1100 AR = grand), enforces fin_can_approve + SoD (creator≠issuer) + open period +
-- over-credit (credit ≤ invoice outstanding), and flips draft→issued. Drive via the Credit Notes UI:
-- create a draft, have a SECOND finance user issue it, confirm the invoice's outstanding drops and
-- Books stay Balanced.
