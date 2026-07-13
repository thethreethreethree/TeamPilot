-- 0164 acceptance — CASH FLOW STATEMENT. Staging, 0116–0164 applied.
--
-- WHY THE ASSERTIONS BELOW LOOK ODD FOR A FINANCIAL TEST
-- The obvious test — "does the net change in cash tie out?" — is nearly worthless here, and it is
-- important to say why: THE NET CHANGE TIES OUT NO MATTER HOW THE SECTIONS ARE CLASSIFIED. Move a loan
-- repayment from Financing into Operating and the bottom line is identical, the statement balances, and
-- cash still reconciles to the bank. A test that only checks the total would pass a statement that lies
-- about how the company makes money — which is the only question the statement exists to answer.
--
-- So every assertion here is about SECTION ATTRIBUTION, not about the total. (The total is asserted too,
-- but as a floor, not as the point.)
--
-- Same failure shape as 0163's backwards entry: perfectly balanced, entirely wrong, undetectable by any
-- balance check. In this ledger, the errors that survive are precisely the ones that balance.

begin;

-- ── Structure: the views exist and the classification vocabulary is closed ──
do $$ begin
  if exists (select 1 from pg_views where viewname = 'fin_cash_flow')
     and exists (select 1 from pg_views where viewname = 'fin_cash_flow_summary')
     and exists (select 1 from pg_views where viewname = 'fin_cash_accounts')
  then raise notice 'CF PASS: fin_cash_accounts, fin_cash_flow and fin_cash_flow_summary all exist';
  else raise notice 'CF FAIL: a cash-flow view is missing';
  end if;

  -- The 'unclassified' bucket MUST exist in the definition. If someone "tidies" it away by folding the
  -- else-branch into 'operating', misclassified money becomes invisible and this statement starts lying
  -- with a clean bill of health. That deletion is the single most dangerous edit to this view.
  if exists (
    select 1 from pg_views
     where viewname = 'fin_cash_flow' and definition like '%unclassified%'
  ) then
    raise notice 'CF PASS: the unclassified bucket is present — unattributable movements are surfaced, not absorbed';
  else
    raise notice 'CF FAIL: no unclassified bucket — unattributable cash is being silently folded into a section';
  end if;
end $$;

rollback;

-- ══ APP-LAYER (a real company with posted entries; these are the assertions that matter) ═════════
--
-- SETUP: a bank account linked to cash GL 1000; an open period.
--
-- 1 · OPERATING.  Pay an approved bill of 500 (Dr AP 2000 / Cr Cash 1000).
--     fin_cash_flow must show -500.00 in section 'operating' (2000 is a payable → working capital).
--     Receive a customer receipt of 900 (Dr Cash / Cr AR 1100) → +900.00 'operating'.
--
-- 2 · FINANCING.  Post an equity injection: Dr Cash 1000 / Cr Equity 3000, 10,000.
--     MUST appear as +10,000.00 in 'financing', NOT 'operating'.
--     THIS IS THE ASSERTION THE WHOLE FILE EXISTS FOR. If it lands in operating, the statement claims the
--     business generated 10,000 from trading when in fact the owner put it in. The net change in cash is
--     IDENTICAL either way, the statement balances either way, and no other check in this system would
--     ever notice. A company could look cash-generative while actually being funded by its founder.
--
-- 3 · UNCLASSIFIED, NOT ABSORBED.  Post Dr Cash / Cr <an account with type='liability' and a NULL or
--     unrecognised subtype, e.g. 'suspense'>, 4,000.
--     MUST appear under 'unclassified' — NOT under operating.
--     A visible "unclassified: 4,000" is an honest prompt to classify the account. The same 4,000 hidden
--     inside operating is a lie that passes every check we have.
--
-- 4 · CASH-TO-CASH IS NOT A CASH FLOW.  Open a second bank account (cash GL 1010). Transfer 2,000 between
--     them: Dr 1010 / Cr 1000.
--     fin_cash_flow must produce NO rows for this entry (both sides are cash; there is no counter-line).
--     If it produces rows, the company's inflow AND outflow both inflate by 2,000 while nothing real
--     happened — the statement would report activity the business never had.
--
-- 5 · PROPORTIONAL SPLIT.  Pay a single bill of 1,000 whose lines are 750 to expense A and 250 to
--     expense B (Dr A 750, Dr B 250 / Cr Cash 1000).
--     The -1,000 cash movement must split -750 / -250 across those counter-lines, NOT land wholly on the
--     first one. Assert the per-account amounts, not just the section total — a wrong split is invisible
--     at section level, which is exactly the class of error this file is about.
--
-- 6 · NET CHANGE (the floor, not the point).  sum(amount) over fin_cash_flow for a period MUST equal the
--     net movement of the cash accounts in that period (sum(base_debit - base_credit) on posted lines
--     touching a cash account, EXCLUDING the cash-to-cash transfers from #4).
--     This must hold — but note it would ALSO hold with every section misclassified, which is why it is
--     the last assertion here and not the first.
--
-- 7 · INVESTING IS EMPTY *FOR THE RIGHT REASON*.  Until the fixed-asset register exists (Phase 8), no
--     account carries subtype='fixed', so 'investing' returns nothing. Confirm it is empty — and confirm
--     it is empty because no such account exists, NOT because the classification branch is broken. Create
--     an account with subtype='fixed', post Dr it / Cr Cash 3,000, and assert it lands in 'investing'.
--     That proves the branch works and is merely unused, rather than dead.
