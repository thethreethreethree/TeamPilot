-- 0167 acceptance — PAYROLL posting. Staging, 0116–0167 applied.
--
-- Payroll is the largest single entry most companies post, and it has two failure modes that this ledger
-- cannot catch on its own:
--
--   • EMPLOYER TAX FOLDED INTO GROSS. The entry still balances. Salary expense is right. But the true
--     cost of an employee is understated by exactly the employer's contribution — and every downstream
--     number built on cost (unit economics, cost-per-project, profitability by cost centre) is then
--     quietly wrong. Nothing flags it, because nothing is out of balance.
--
--   • A RUN POSTED TWICE. An entire month of salary expense doubles. The entry balances perfectly.
--
-- Both are asserted here, because nowhere else in the system would notice.

begin;

insert into companies (id, name) values ('00000000-0000-0000-0000-0000000000b1','PAYROLL Co')
  on conflict (id) do nothing;

-- ── THE IDENTITY: gross must equal net + withholdings ──
-- Without it the posted entry cannot balance, and the failure would surface to an accountant as an
-- opaque "entry does not balance" from the ledger — true, useless, and aimed at the wrong reader.
do $$ begin
  begin
    insert into fin_payroll_runs (company_id, period_start, period_end, pay_date, gross, net_pay, withholdings)
      values ('00000000-0000-0000-0000-0000000000b1','2026-07-01','2026-07-31','2026-07-31',
              10000, 7500, 1000);   -- 7500 + 1000 = 8500 ≠ 10000
    raise notice 'PAYROLL FAIL: a run where gross <> net + withholdings was ACCEPTED — the posted entry cannot balance';
  exception when check_violation then
    raise notice 'PAYROLL PASS: gross must equal net + withholdings — rejected at the source, with a message an accountant can act on';
  end;

  -- The correct shape is accepted.
  begin
    insert into fin_payroll_runs (company_id, period_start, period_end, pay_date, gross, net_pay, withholdings, employer_tax)
      values ('00000000-0000-0000-0000-0000000000b1','2026-07-01','2026-07-31','2026-07-31',
              10000, 7500, 2500, 1200);
    raise notice 'PAYROLL PASS: a run that adds up (10000 = 7500 + 2500) is accepted';
  exception when others then
    raise notice 'PAYROLL FAIL: a correct run was rejected';
  end;
end $$;

-- ── The dedupe that stops a re-import posting payroll twice ──
do $$ begin
  if exists (select 1 from pg_constraint where conname = 'fin_payroll_external_uq')
  then raise notice 'PAYROLL PASS: unique (company, provider, external_id) — re-importing a provider run cannot post it twice';
  else raise notice 'PAYROLL FAIL: re-importing the same provider run would DOUBLE a month of salary expense, and the entry would balance';
  end if;
end $$;

rollback;

-- ══ APP-LAYER (an open period, an approver session) ══════════════════════════════════════════
--
-- RUN UNDER TEST: gross 10,000 · withholdings 2,500 · net 7,500 · employer_tax 1,200 · benefits 300
--
-- A · THE POSTED ENTRY — assert every leg, not just the balance.
--       Dr 6000 Salary Expense          10,000
--       Dr 6100 Employer Tax Expense     1,500   (employer_tax 1,200 + benefits 300)
--       Cr 2300 Net Pay Payable          7,500
--       Cr 2400 Withholdings Payable     2,500
--       Cr 2500 Employer Tax Payable     1,500
--     Debits 11,500 = Credits 11,500.
--
-- B · EMPLOYER TAX IS *ON TOP OF* GROSS — the assertion this file exists for.
--     Salary Expense MUST be 10,000 and Employer Tax Expense MUST be 1,500. TOTAL payroll cost = 11,500.
--     If an implementation folds employer tax INTO gross, Salary Expense becomes 11,500 and Employer Tax
--     Expense 0. The entry STILL BALANCES. The trial balance still ties. But the true cost of employing
--     someone is now indistinguishable from their salary — and every unit-economics, cost-per-project and
--     cost-centre-profitability figure built on top is silently wrong, in the direction that flatters the
--     business. Nothing in this system would ever flag it.
--
-- C · NO DOUBLE POST.  Post the run, then post it AGAIN → MUST RAISE ("already posted").
--     Run two concurrent posts of the same run in two sessions: the row lock must serialize them so the
--     second sees 'posted' and raises. If both succeed, an entire month of salary expense is doubled —
--     and both entries balance perfectly.
--
-- D · RE-IMPORT.  Insert a second run with the SAME (provider, external_id) → MUST be rejected by the
--     unique. A provider webhook that fires twice is not a hypothetical.
--
-- E · CLOSED PERIOD.  Posting payroll into a CLOSED period MUST RAISE. Payroll must never be the thing
--     that reaches back into a signed-off month.
--
-- F · THE ACCOUNTANT'S ERROR MESSAGE.  Force gross <> net + withholdings through a direct update that
--     bypasses the CHECK (or construct the run before the constraint), then call fin_post_payroll_run.
--     The raise MUST name the three figures — "gross (10,000) must equal net pay (7,500) + withholdings
--     (2,000)" — not merely "entry does not balance". The reader is an accountant looking at a payroll
--     run; an error that only a database engineer can decode is a failure of the feature, not of the user.
--
-- G · ZERO EMPLOYER TAX.  A run with employer_tax = 0 and benefits = 0 posts only three legs (no 6100 /
--     2500 lines) and still balances. A jurisdiction with no employer contribution is normal, not an edge
--     case, and must not produce two zero-value lines.
