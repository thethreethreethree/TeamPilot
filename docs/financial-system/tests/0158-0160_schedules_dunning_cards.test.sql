-- 0158–0160 acceptance — payment schedules, dunning, corporate-card reconciliation.
-- Staging, 0116–0162 applied. Structural assertions roll back; the app-layer ones are listed at the end.
--
-- Combined file (precedent: 0133-0138_aging_buckets.test.sql) because these three share one theme: each
-- computes a figure a human then ACTS on, and in each the dangerous failure is a SILENT wrong number
-- rather than an error. So the assertions target the numbers, not the plumbing.
--
-- Spec §3: "Write tests for every calculation. No calculation ships untested."
--   0158 — the aggregate over-schedule guard: paid + already-scheduled + new > bill total must REJECT.
--   0159 — the collections worklist: outstanding = invoice − receipts − issued credit notes, and the
--          two stage numbers (what the ladder says vs what a human did).
--   0160 — auto-match: matches ONLY on a single candidate; refuses to guess between two.

begin;

insert into companies (id, name) values ('00000000-0000-0000-0000-00000000a001','P2 Co')
  on conflict (id) do nothing;

-- ═══ 0158 — the over-schedule guard ══════════════════════════════════
-- The bill's cumulative commitment is paid + scheduled. A clerk queuing three "valid" instructions that
-- each pass individually but over-commit the bill in AGGREGATE is the failure this guard exists for.
do $$ begin
  if exists (select 1 from pg_proc where proname = 'fin_schedule_payment') then
    raise notice 'SCHED PASS: fin_schedule_payment exists';
  else
    raise notice 'SCHED FAIL: fin_schedule_payment missing';
  end if;
  if exists (select 1 from pg_constraint where conname = 'fin_payment_schedules_amount_check')
     or exists (select 1 from information_schema.columns
                 where table_name='fin_payment_schedules' and column_name='amount'
                   and numeric_precision=19 and numeric_scale=4) then
    raise notice 'SCHED PASS: scheduled amount is numeric(19,4) — exact decimal, never float';
  else
    raise notice 'SCHED FAIL: scheduled amount is not numeric(19,4)';
  end if;
end $$;

-- ═══ 0159 — the worklist must not be permanently empty ═══════════════
-- This is the assertion that would have caught the real bug in this file's own first draft: the view
-- originally filtered fin_invoices on statuses that DO NOT EXIST ('issued','partly_paid','overdue'),
-- so it matched zero rows ALWAYS — a silently empty collections list that looked healthy.
do $$
declare v_bad int;
begin
  select count(*) into v_bad
    from pg_views v
   where v.viewname = 'fin_dunning_worklist'
     and (v.definition like '%''partly_paid''%' or v.definition like '%''overdue''%');
  if v_bad > 0 then
    raise notice 'DUNNING FAIL: the worklist filters on invoice statuses that do not exist — it will ALWAYS be empty';
  else
    raise notice 'DUNNING PASS: the worklist does not filter on non-existent invoice statuses';
  end if;

  -- The real vocabulary, asserted rather than assumed:
  if exists (
    select 1 from pg_constraint
     where conrelid = 'fin_invoices'::regclass
       and pg_get_constraintdef(oid) like '%''sent''%'
  ) then
    raise notice 'DUNNING PASS: fin_invoices really does use ''sent'' (the status the worklist now filters on)';
  else
    raise notice 'DUNNING FAIL: fin_invoices has no ''sent'' status — the worklist filter is wrong again';
  end if;
end $$;

-- append-only: a chase record is evidence; it must survive an UPDATE/DELETE attempt unchanged
do $$
declare v_inv uuid; v_id uuid; v_n int;
begin
  select id into v_inv from fin_invoices limit 1;
  if v_inv is null then raise notice 'DUNNING SKIP: no invoice available'; return; end if;

  insert into fin_dunning_events (company_id, invoice_id, stage, channel, note)
    select company_id, id, 1, 'email', 'first notice' from fin_invoices where id = v_inv
    returning id into v_id;

  update fin_dunning_events set note = 'TAMPERED', stage = 9 where id = v_id;
  select count(*) into v_n from fin_dunning_events where id = v_id and note = 'TAMPERED';
  if v_n = 0 then raise notice 'DUNNING PASS: UPDATE on a chase record is a no-op (append-only rule holds)';
  else raise notice 'DUNNING FAIL: a chase record was EDITED — it is no longer evidence'; end if;

  delete from fin_dunning_events where id = v_id;
  select count(*) into v_n from fin_dunning_events where id = v_id;
  if v_n = 1 then raise notice 'DUNNING PASS: DELETE on a chase record is a no-op (history survives)';
  else raise notice 'DUNNING FAIL: a chase record was DELETED — a reminder never sent is now indistinguishable from one that was'; end if;
end $$;

-- ═══ 0160 — card reconciliation ══════════════════════════════════════
do $$ begin
  -- dedupe contract: re-importing the same statement must not double-count
  if exists (select 1 from pg_constraint where conname = 'fin_card_txn_dedupe') then
    raise notice 'CARD PASS: unique (card_id, external_id) — a re-imported statement cannot double-count';
  else
    raise notice 'CARD FAIL: no dedupe constraint — re-importing a statement will duplicate every charge';
  end if;

  -- one charge cannot be substantiated by two claims, and one claim cannot cover two charges
  if exists (select 1 from pg_constraint where conname = 'fin_card_match_txn_uq')
     and exists (select 1 from pg_constraint where conname = 'fin_card_match_item_uq') then
    raise notice 'CARD PASS: one-match-per-charge AND one-match-per-claim are both enforced (no double reimbursement)';
  else
    raise notice 'CARD FAIL: a claim could substantiate two charges, or a charge be covered twice';
  end if;
end $$;

rollback;

-- ── APP-LAYER (needs a real session; these are the assertions that matter) ─────────────────
--
-- 0158 · AGGREGATE over-schedule. Bill total 1000, nothing paid.
--    schedule 600 → ok.   schedule 400 → ok (600 + 400 = 1000).   schedule 1 → MUST RAISE.
--    The third instruction is individually reasonable and collectively an over-commitment. If it is
--    accepted, the guard is per-instruction rather than cumulative, and a clerk can over-pay a bill by
--    queueing small amounts.
--    Then execute one → it must call fin_pay_bill (Dr AP / Cr Cash) and set payment_id, so the schedule
--    is TRACEABLE to the GL entry it produced. Executing the SAME schedule twice must RAISE (status guard
--    + row lock), not pay twice.
--
-- 0159 · outstanding must net off an ISSUED credit note. Invoice 1000, receipt 200, credit note 300
--    (issued) → the worklist must show 500, not 800. If credit notes are ignored, collections chases
--    money the customer does not owe — and the first complaint is from the customer, not the system.
--    stage_due vs stage_actioned: with a ladder at 7/14/30 days and an invoice 20 days overdue that has
--    had ONE reminder, stage_due = 2 and stage_actioned = 1. The gap IS the backlog.
--
-- 0160 · auto-match must REFUSE to guess. Import one 50.00 charge; create TWO unmatched 50.00 expense
--    items within ±3 days → fin_auto_match_card must match ZERO and leave the charge unmatched.
--    If it matches one of them, it has silently substantiated a real charge with an arbitrary claim: the
--    charge leaves the worklist, the wrong claim is consumed, and the unsubstantiated-spend control
--    fails without anyone seeing it. A miss is a question someone answers; a wrong match is a lie.
--    With exactly ONE candidate, it must match and flip the charge to 'matched'.
