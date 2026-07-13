-- 0161 acceptance — MILEAGE / PER-DIEM derivation. Staging, 0116–0161 applied.
--
-- This file exists because spec §3 says: "Write tests for every calculation. No calculation ships
-- untested." 0161 introduces the first DERIVED money in the expense subledger:
--
--     amount = round(rate * quantity, 4)
--
-- and the whole control depends on that number being computed by the DATABASE from the COMPANY's rate,
-- not accepted from the claimant. So the assertions below are not about plumbing — they are about whether
-- an employee can influence what their own claim is worth.
--
-- What must hold:
--   1. A mileage line's amount is DERIVED and OVERWRITES whatever the client submitted.
--   2. The rate used is the one effective on the EXPENSE DATE, not the newest rate (history is not
--      revalued by a later rate change — spec §3: records are append-only).
--   3. Per-diem behaves identically, resolved per jurisdiction.
--   4. A receipt line is NOT touched (it states its own amount).
--   5. Claiming mileage with no configured rate FAILS loudly rather than silently valuing at zero.
--   6. The kind/quantity constraint holds: a derived kind requires a positive quantity; a receipt must
--      not carry one.
--   7. Money is exact decimal — numeric(19,4), never float.

begin;

insert into companies (id, name) values ('00000000-0000-0000-0000-0000000000e1','MILEAGE Co')
  on conflict (id) do nothing;

-- ── 6. constraint: derived kinds need a quantity; receipts must not have one ──
do $$
declare v_rep uuid; v_acct uuid;
begin
  select id into v_acct from fin_accounts
   where company_id = '00000000-0000-0000-0000-0000000000e1' limit 1;
  if v_acct is null then raise notice 'MILEAGE SKIP: company not initialized (no COA)'; return; end if;

  insert into fin_expense_reports (company_id, title, status)
    values ('00000000-0000-0000-0000-0000000000e1','T','draft') returning id into v_rep;

  begin
    insert into fin_expense_items (company_id, report_id, line_no, account_id, kind, quantity, amount)
      values ('00000000-0000-0000-0000-0000000000e1', v_rep, 1, v_acct, 'mileage', null, 10);
    raise notice 'MILEAGE FAIL: mileage line accepted with NO quantity';
  exception when check_violation then
    raise notice 'MILEAGE PASS: a derived (mileage) line requires a quantity';
  end;

  begin
    insert into fin_expense_items (company_id, report_id, line_no, account_id, kind, quantity, amount)
      values ('00000000-0000-0000-0000-0000000000e1', v_rep, 2, v_acct, 'receipt', 5, 10);
    raise notice 'MILEAGE FAIL: receipt line accepted WITH a quantity';
  exception when check_violation then
    raise notice 'MILEAGE PASS: a receipt line may not carry a quantity (it states its own amount)';
  end;
end $$;

-- ── 5. no configured rate → loud failure, never a silent zero ──
do $$
declare v_rep uuid; v_acct uuid;
begin
  select id into v_acct from fin_accounts
   where company_id = '00000000-0000-0000-0000-0000000000e1' limit 1;
  if v_acct is null then return; end if;
  select id into v_rep from fin_expense_reports
   where company_id = '00000000-0000-0000-0000-0000000000e1' limit 1;

  begin
    insert into fin_expense_items (company_id, report_id, line_no, account_id, kind, quantity, expense_date, amount)
      values ('00000000-0000-0000-0000-0000000000e1', v_rep, 3, v_acct, 'mileage', 100, '2026-06-01', 0);
    raise notice 'MILEAGE FAIL: mileage claimed with NO rate configured — silently valued (this is the bug this test exists for)';
  exception when others then
    raise notice 'MILEAGE PASS: mileage with no configured rate is REJECTED, not silently zero-valued';
  end;
end $$;

-- ── 1,2,7. derivation + effective-dating: the OLD rate values an OLD claim ──
do $$
declare v_rep uuid; v_acct uuid; v_amt numeric(19,4);
begin
  select id into v_acct from fin_accounts
   where company_id = '00000000-0000-0000-0000-0000000000e1' limit 1;
  if v_acct is null then return; end if;
  select id into v_rep from fin_expense_reports
   where company_id = '00000000-0000-0000-0000-0000000000e1' limit 1;

  -- two rates: 0.30/km from Jan, raised to 0.50/km from July
  insert into fin_mileage_rates (company_id, effective_from, rate_per_unit, unit)
    values ('00000000-0000-0000-0000-0000000000e1','2026-01-01', 0.3000, 'km'),
           ('00000000-0000-0000-0000-0000000000e1','2026-07-01', 0.5000, 'km')
    on conflict do nothing;

  -- A JUNE claim of 180 km. Client submits a deliberately WRONG amount (9999) to prove it is ignored.
  -- Correct: 180 * 0.30 = 54.0000 at the JUNE rate — NOT 90.00 at the July rate.
  insert into fin_expense_items (company_id, report_id, line_no, account_id, kind, quantity, expense_date, amount)
    values ('00000000-0000-0000-0000-0000000000e1', v_rep, 10, v_acct, 'mileage', 180, '2026-06-15', 9999)
    returning amount into v_amt;

  if v_amt = 54.0000 then
    raise notice 'MILEAGE PASS: amount DERIVED as 54.0000 (180 x 0.30) — client-submitted 9999 ignored, and the JUNE rate used, not July''s';
  else
    raise notice 'MILEAGE FAIL: expected 54.0000, got % (either the client amount survived, or a later rate revalued history)', v_amt;
  end if;

  -- A JULY claim of the same 180 km must value at the NEW rate: 180 * 0.50 = 90.0000
  insert into fin_expense_items (company_id, report_id, line_no, account_id, kind, quantity, expense_date, amount)
    values ('00000000-0000-0000-0000-0000000000e1', v_rep, 11, v_acct, 'mileage', 180, '2026-07-15', 0)
    returning amount into v_amt;

  if v_amt = 90.0000 then
    raise notice 'MILEAGE PASS: the July claim uses the July rate (90.0000) — effective-dating resolves forward too';
  else
    raise notice 'MILEAGE FAIL: expected 90.0000, got %', v_amt;
  end if;
end $$;

-- ── 3. per-diem, per jurisdiction ──
do $$
declare v_rep uuid; v_acct uuid; v_amt numeric(19,4);
begin
  select id into v_acct from fin_accounts
   where company_id = '00000000-0000-0000-0000-0000000000e1' limit 1;
  if v_acct is null then return; end if;
  select id into v_rep from fin_expense_reports
   where company_id = '00000000-0000-0000-0000-0000000000e1' limit 1;

  insert into fin_per_diem_rates (company_id, effective_from, jurisdiction, daily_rate)
    values ('00000000-0000-0000-0000-0000000000e1','2026-01-01','default', 45.0000),
           ('00000000-0000-0000-0000-0000000000e1','2026-01-01','US',      75.0000)
    on conflict do nothing;

  insert into fin_expense_items (company_id, report_id, line_no, account_id, kind, quantity, jurisdiction, expense_date, amount)
    values ('00000000-0000-0000-0000-0000000000e1', v_rep, 20, v_acct, 'per_diem', 3, 'US', '2026-06-01', 1)
    returning amount into v_amt;

  if v_amt = 225.0000 then
    raise notice 'MILEAGE PASS: per-diem derived per JURISDICTION (3 days x 75.00 US = 225.0000)';
  else
    raise notice 'MILEAGE FAIL: expected 225.0000 for 3 US days, got %', v_amt;
  end if;
end $$;

-- ── 4. a receipt line is left alone ──
do $$
declare v_rep uuid; v_acct uuid; v_amt numeric(19,4);
begin
  select id into v_acct from fin_accounts
   where company_id = '00000000-0000-0000-0000-0000000000e1' limit 1;
  if v_acct is null then return; end if;
  select id into v_rep from fin_expense_reports
   where company_id = '00000000-0000-0000-0000-0000000000e1' limit 1;

  insert into fin_expense_items (company_id, report_id, line_no, account_id, kind, expense_date, amount)
    values ('00000000-0000-0000-0000-0000000000e1', v_rep, 30, v_acct, 'receipt', '2026-06-01', 42.3000)
    returning amount into v_amt;

  if v_amt = 42.3000 then
    raise notice 'MILEAGE PASS: a receipt line keeps its stated amount (42.3000) — derivation does not touch it';
  else
    raise notice 'MILEAGE FAIL: receipt amount was altered to %', v_amt;
  end if;
end $$;

rollback;

-- ── §A23 (app-layer, run as a plain employee) ────────────────────────────────
--   As a user WITHOUT fin_can_configure() (i.e. not controller/CFO), attempt:
--     insert into fin_mileage_rates (company_id, effective_from, rate_per_unit, unit)
--       values (auth_company_id(), current_date, 99.0000, 'km');
--   → MUST be denied by RLS. If an employee can insert a rate, they can set what their own mileage is
--     worth, and the entire derivation control is theatre. This is the same self-raisable-ceiling class
--     as 0157's approval_limit, and it is the single most important assertion in this file.
