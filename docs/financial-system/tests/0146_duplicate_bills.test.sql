-- 0146 acceptance — duplicate-bill detection view. Staging with 0116-0146 applied. Rollback; NOTICE.
-- Service-role testable (a plain view). Seeds two same-vendor same-amount bills 3 days apart (a
-- candidate pair) + one same-vendor different-amount bill (not flagged) + one far-apart bill (not
-- flagged), and asserts the view returns exactly the one expected pair. UUIDs valid hex.

begin;

insert into companies (id, name) values ('00000000-0000-0000-0000-0000000000c1','ACCEPT Co')
  on conflict (id) do nothing;
insert into fin_settings (company_id, base_currency) values ('00000000-0000-0000-0000-0000000000c1','USD')
  on conflict (company_id) do nothing;
insert into fin_accounts (company_id, code, name, type, normal_balance)
  values ('00000000-0000-0000-0000-0000000000c1','6000','Operating Expenses','expense','debit')
  on conflict (company_id, code) do nothing;
insert into fin_vendors (id, company_id, name)
  values ('00000000-0000-0000-0000-00000000d001','00000000-0000-0000-0000-0000000000c1','Acme')
  on conflict (id) do nothing;

-- A & B: same vendor, same total (100), 3 days apart → a candidate pair.
-- C: same vendor, different total (200) → not a match. D: same total as A/B but 30 days apart → not a match.
insert into fin_bills (id, company_id, vendor_id, bill_number, bill_date, status) values
  ('00000000-0000-0000-0000-0000000000ba','00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-00000000d001','DUP-A','2026-07-10','draft'),
  ('00000000-0000-0000-0000-0000000000bb','00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-00000000d001','DUP-B','2026-07-13','draft'),
  ('00000000-0000-0000-0000-0000000000bc','00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-00000000d001','DIFF-C','2026-07-11','draft'),
  ('00000000-0000-0000-0000-0000000000bd','00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-00000000d001','FAR-D','2026-08-20','draft')
  on conflict (id) do nothing;
insert into fin_bill_lines (company_id, bill_id, line_no, account_id, amount, tax_amount)
  select '00000000-0000-0000-0000-0000000000c1', b.id, 1,
         (select id from fin_accounts where company_id='00000000-0000-0000-0000-0000000000c1' and code='6000'),
         case when b.bill_number = 'DIFF-C' then 200 else 100 end, 0
  from fin_bills b where b.bill_number in ('DUP-A','DUP-B','DIFF-C','FAR-D')
  on conflict do nothing;

do $$ declare v_n int; v_days int;
begin
  select count(*) into v_n from fin_duplicate_bill_candidates where company_id='00000000-0000-0000-0000-0000000000c1';
  if v_n = 1 then raise notice 'DUP PASS: exactly 1 candidate pair (A↔B); C different-amount + D far-apart excluded';
  else raise notice 'DUP FAIL: % candidate pairs (want 1)', v_n; end if;

  select days_apart into v_days from fin_duplicate_bill_candidates where company_id='00000000-0000-0000-0000-0000000000c1' limit 1;
  if v_days = 3 then raise notice 'DUP PASS: the pair is 3 days apart';
  else raise notice 'DUP FAIL: days_apart = % (want 3)', v_days; end if;
end $$;

rollback;
