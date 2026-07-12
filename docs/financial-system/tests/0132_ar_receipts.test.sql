-- 0132 acceptance — AR receipts. Staging, 0116-0132 applied. Rollback; NOTICE.
begin;
insert into companies (id, name) values ('00000000-0000-0000-0000-0000000000c1','ACCEPT Co') on conflict (id) do nothing;
do $$ begin
  begin insert into fin_receipts (company_id, amount, receipt_date) values ('00000000-0000-0000-0000-0000000000c1', 0, '2026-07-15');
    raise notice 'RCPT FAIL: zero receipt accepted';
  exception when check_violation then raise notice 'RCPT PASS: non-positive receipt rejected'; end;
end $$;
rollback;
-- APP-LAYER: fin_record_receipt posts Dr Cash / Cr AR, locks the invoice (over-receipt race),
-- blocks over-receipt, marks the invoice 'paid' when fully covered (partial stays 'sent'), rejects
-- foreign-currency settlement. Only fin_can_approve() may record.
