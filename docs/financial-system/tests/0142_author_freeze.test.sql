-- 0142 acceptance — created_by immutability trigger (the SoD-bypass UPDATE-freeze). Staging with
-- 0116-0142 applied. Rollback; RAISE NOTICE PASS/FAIL.
--
-- Tests the fin_freeze_created_by trigger, which is service-role testable (it fires on ANY update
-- regardless of auth). It's the completeness half of 0142: the RLS INSERT pin stops a spoofed
-- created_by at insert, and this trigger stops the re-attribution-via-UPDATE that would otherwise
-- reopen the SoD bypass (insert clean → UPDATE created_by = victim → self-approve). The RLS INSERT
-- pin itself is auth-gated (needs a simulated finance user) → covered at the app/staging layer.
--
-- Two victims of the freeze are exercised here: a subledger doc (fin_bills) and the ledger
-- (fin_journal_entries). The other two tables (fin_invoices, fin_purchase_orders) use the identical
-- trigger/function, so they inherit the same guarantee.

begin;

insert into companies (id, name) values ('00000000-0000-0000-0000-0000000000c1','ACCEPT Co')
  on conflict (id) do nothing;
insert into fin_settings (company_id, base_currency) values ('00000000-0000-0000-0000-0000000000c1','USD')
  on conflict (company_id) do nothing;
insert into fin_accounts (company_id, code, name, type, normal_balance) values
  ('00000000-0000-0000-0000-0000000000c1','1000','Cash','asset','debit'),
  ('00000000-0000-0000-0000-0000000000c1','6000','Operating Expenses','expense','debit')
  on conflict (company_id, code) do nothing;
insert into fin_vendors (id, company_id, name)
  values ('00000000-0000-0000-0000-00000000d001','00000000-0000-0000-0000-0000000000c1','Acme')
  on conflict (id) do nothing;
insert into fin_periods (id, company_id, name, start_date, end_date, status)
  values ('00000000-0000-0000-0000-000000000f01','00000000-0000-0000-0000-0000000000c1','2026','2026-01-01','2026-12-31','open')
  on conflict (id) do nothing;

-- Two distinct actors: the real creator, and the "victim" an attacker would try to re-attribute to.
-- (Direct service-role insert here bypasses the RLS INSERT pin, which is fine — we're testing the
-- trigger, and this simulates a row that already exists with a known creator.)
insert into fin_bills (id, company_id, vendor_id, bill_number, bill_date, status, created_by)
  values ('00000000-0000-0000-0000-00000000b101','00000000-0000-0000-0000-0000000000c1',
          '00000000-0000-0000-0000-00000000d001','FR-1','2026-07-15','draft',
          '00000000-0000-0000-0000-0000000ac701')  -- creator = actor 701
  on conflict (id) do nothing;

do $$ begin
  -- (1) The attack: reassign created_by on a draft bill → MUST be rejected by the freeze trigger.
  begin
    update fin_bills set created_by = '00000000-0000-0000-0000-0000000ac799'  -- victim 799
      where id = '00000000-0000-0000-0000-00000000b101';
    raise notice 'BILL FAIL: created_by was reassigned (SoD-bypass freeze NOT working)';
  exception when others then
    raise notice 'BILL PASS: created_by reassignment rejected (%).', sqlerrm;
  end;

  -- (2) A legitimate edit that does NOT touch created_by → MUST still succeed.
  begin
    update fin_bills set memo = 'edited memo, same creator'
      where id = '00000000-0000-0000-0000-00000000b101';
    raise notice 'BILL PASS: a normal edit (memo) still succeeds — freeze only blocks created_by';
  exception when others then
    raise notice 'BILL FAIL: a legitimate non-author edit was blocked (%).', sqlerrm;
  end;
end $$;

-- Ledger: same guarantee on fin_journal_entries (manual-post SoD: fin_post_entry checks
-- approved_by <> created_by).
insert into fin_journal_entries (id, company_id, entry_date, period_id, description, status, created_by)
  values ('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-0000000000c1','2026-07-15',
          '00000000-0000-0000-0000-000000000f01','freeze test','draft',
          '00000000-0000-0000-0000-0000000ac701')
  on conflict (id) do nothing;

do $$ begin
  begin
    update fin_journal_entries set created_by = '00000000-0000-0000-0000-0000000ac799'
      where id = '00000000-0000-0000-0000-0000000000e1';
    raise notice 'ENTRY FAIL: journal-entry created_by reassigned (freeze NOT working)';
  exception when others then
    raise notice 'ENTRY PASS: journal-entry created_by reassignment rejected (%).', sqlerrm;
  end;
end $$;

rollback;

-- NOT covered here (auth-gated → app/staging): the RLS INSERT pin `created_by = auth.uid()`. To test
-- it, insert via a user-scoped client whose JWT sub is a seeded finance user and confirm an insert
-- with a foreign created_by is rejected by RLS.
