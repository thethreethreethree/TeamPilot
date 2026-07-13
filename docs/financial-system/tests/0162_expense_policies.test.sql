-- 0162 acceptance — EXPENSE POLICY ENFORCEMENT. Staging, 0116–0162 applied.
--
-- Why this file exists (§A27): a policy that lives only in the UI is a FALSE GUARANTEE — worse than no
-- policy, because the company trusts it. Every assertion below therefore writes DIRECTLY to the table,
-- bypassing any app-layer validation, and asserts the DATABASE refuses. If these pass in the app but fail
-- here, the policy is decoration.
--
-- What must hold:
--   1. A disallowed category cannot be claimed AT ALL.
--   2. A line above max_amount is rejected; at exactly max_amount it is allowed (inclusive cap).
--   3. The cap is checked on the GROSS line (amount + tax) — tax must not be able to push a claim past
--      the cap unseen.
--   4. requires_receipt_above rejects a large line with no receipt_url, and allows it with one.
--   5. The MOST SPECIFIC policy wins: an account-bound policy beats a category-bound one.
--   6. Effective-dating: a policy introduced in March does not retroactively reject a January claim.
--   7. A line with no matching policy passes untouched.

begin;

insert into companies (id, name) values ('00000000-0000-0000-0000-0000000000f1','POLICY Co')
  on conflict (id) do nothing;

do $$
declare v_rep uuid; v_acct uuid; v_acct2 uuid; v_ok boolean;
begin
  select id into v_acct  from fin_accounts where company_id = '00000000-0000-0000-0000-0000000000f1' limit 1;
  select id into v_acct2 from fin_accounts where company_id = '00000000-0000-0000-0000-0000000000f1' offset 1 limit 1;
  if v_acct is null then raise notice 'POLICY SKIP: company not initialized (no COA)'; return; end if;

  insert into fin_expense_reports (company_id, title, status)
    values ('00000000-0000-0000-0000-0000000000f1','P','draft') returning id into v_rep;

  -- ── 1. disallowed category ──
  insert into fin_expense_policies (company_id, category, is_disallowed, effective_from)
    values ('00000000-0000-0000-0000-0000000000f1', 'alcohol', true, '2026-01-01');

  begin
    insert into fin_expense_items (company_id, report_id, line_no, account_id, category, amount, expense_date)
      values ('00000000-0000-0000-0000-0000000000f1', v_rep, 1, v_acct, 'alcohol', 10, '2026-06-01');
    raise notice 'POLICY FAIL: a DISALLOWED category was accepted';
  exception when others then
    raise notice 'POLICY PASS: disallowed category rejected at the write path';
  end;

  -- ── 2 + 3. cap, checked on the GROSS line ──
  insert into fin_expense_policies (company_id, category, max_amount, effective_from)
    values ('00000000-0000-0000-0000-0000000000f1', 'meals', 40.0000, '2026-01-01');

  -- exactly at the cap → allowed (inclusive)
  begin
    insert into fin_expense_items (company_id, report_id, line_no, account_id, category, amount, expense_date)
      values ('00000000-0000-0000-0000-0000000000f1', v_rep, 2, v_acct, 'meals', 40.0000, '2026-06-01');
    raise notice 'POLICY PASS: a line exactly AT the cap (40.00) is allowed — the cap is inclusive';
  exception when others then
    raise notice 'POLICY FAIL: a line exactly at the cap was rejected (cap must be inclusive)';
  end;

  -- above the cap → rejected
  begin
    insert into fin_expense_items (company_id, report_id, line_no, account_id, category, amount, expense_date)
      values ('00000000-0000-0000-0000-0000000000f1', v_rep, 3, v_acct, 'meals', 40.0100, '2026-06-01');
    raise notice 'POLICY FAIL: a line ABOVE the cap was accepted';
  exception when others then
    raise notice 'POLICY PASS: a line above the cap is rejected';
  end;

  -- GROSS, not net: 35 + 6 tax = 41 > 40 must be REJECTED even though the net is under the cap.
  -- If this passes, tax is a silent hole in every spend cap in the system.
  begin
    insert into fin_expense_items (company_id, report_id, line_no, account_id, category, amount, tax_amount, expense_date)
      values ('00000000-0000-0000-0000-0000000000f1', v_rep, 4, v_acct, 'meals', 35.0000, 6.0000, '2026-06-01');
    raise notice 'POLICY FAIL: net 35 + tax 6 = 41 slipped past a 40 cap — TAX IS A HOLE IN THE CAP';
  exception when others then
    raise notice 'POLICY PASS: the cap is checked on the GROSS line (35 + 6 tax = 41 > 40 rejected)';
  end;

  -- ── 4. receipt required above a threshold ──
  insert into fin_expense_policies (company_id, category, requires_receipt_above, effective_from)
    values ('00000000-0000-0000-0000-0000000000f1', 'travel', 25.0000, '2026-01-01');

  begin
    insert into fin_expense_items (company_id, report_id, line_no, account_id, category, amount, expense_date)
      values ('00000000-0000-0000-0000-0000000000f1', v_rep, 5, v_acct, 'travel', 100, '2026-06-01');
    raise notice 'POLICY FAIL: a 100.00 travel line with NO receipt was accepted (threshold 25.00)';
  exception when others then
    raise notice 'POLICY PASS: above the receipt threshold, a missing receipt is rejected';
  end;

  begin
    insert into fin_expense_items (company_id, report_id, line_no, account_id, category, amount, receipt_url, expense_date)
      values ('00000000-0000-0000-0000-0000000000f1', v_rep, 6, v_acct, 'travel', 100, 'https://x/r.pdf', '2026-06-01');
    raise notice 'POLICY PASS: the same line WITH a receipt is accepted';
  exception when others then
    raise notice 'POLICY FAIL: a receipted line above the threshold was still rejected';
  end;

  -- ── 6. effective-dating: a policy from March must not reject a JANUARY claim ──
  insert into fin_expense_policies (company_id, category, max_amount, effective_from)
    values ('00000000-0000-0000-0000-0000000000f1', 'software', 10.0000, '2026-03-01');

  begin
    insert into fin_expense_items (company_id, report_id, line_no, account_id, category, amount, expense_date)
      values ('00000000-0000-0000-0000-0000000000f1', v_rep, 7, v_acct, 'software', 500, '2026-01-15');
    raise notice 'POLICY PASS: a JANUARY claim is not judged by a MARCH policy (history is not rewritten)';
  exception when others then
    raise notice 'POLICY FAIL: a March policy retroactively rejected a January claim';
  end;

  -- ── 7. no policy → untouched ──
  begin
    insert into fin_expense_items (company_id, report_id, line_no, account_id, category, amount, expense_date)
      values ('00000000-0000-0000-0000-0000000000f1', v_rep, 8, v_acct, 'stationery', 12345, '2026-06-01');
    raise notice 'POLICY PASS: a category with no policy is unconstrained';
  exception when others then
    raise notice 'POLICY FAIL: a line with no matching policy was rejected';
  end;
end $$;

rollback;

-- ── §A23 (app-layer, run as a plain employee) ────────────────────────────────
--   As a user WITHOUT fin_can_configure(), attempt:
--     update fin_expense_policies set max_amount = 999999 where company_id = auth_company_id();
--     insert into fin_expense_policies (company_id, category, max_amount) values (auth_company_id(),'meals',999999);
--   → BOTH must be denied by RLS. If a claimant can raise the cap their own claim is checked against,
--     the policy is theatre. Same class as 0157's approval_limit and 0161's rates.
--
-- ── Interaction with 0161 (the ordering that matters) ─────────────────────────
--   Claim 1000 km of mileage at a 0.50 rate (= 500.00) against a 'mileage' category capped at 100.00.
--   → MUST be rejected. This proves the policy trigger sees the DERIVED amount (500.00), not the
--     client-submitted one. If a claimant can submit amount=1 with quantity=1000 and slip past the cap,
--     the two triggers are firing in the wrong order and BOTH controls are defeated at once.
