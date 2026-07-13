-- 0170 acceptance — CONTRACTOR / 1099. Staging, 0116–0170 applied.
--
-- This is the only number in the entire financial system that a THIRD PARTY will audit us against. The
-- contractor receives it and compares it to their own bank records. A tax authority receives it too.
-- Every other report in this system is read by people who want to believe it.
--
-- THE CENTRAL ASSERTION: the 1099 reports CASH PAID in the calendar year — never bills accrued.

begin;

do $$ begin
  if exists (select 1 from information_schema.columns
              where table_name = 'fin_vendors' and column_name = 'is_1099')
  then raise notice '1099 PASS: eligibility is DECLARED on the vendor, not inferred — we cannot guess a legal relationship';
  else raise notice '1099 FAIL: no eligibility flag';
  end if;

  if exists (select 1 from information_schema.views where table_name = 'fin_1099_worksheet')
  then raise notice '1099 PASS: worksheet view exists';
  else raise notice '1099 FAIL: no worksheet';
  end if;
end $$;

rollback;

-- ══ APP-LAYER — THE ASSERTIONS THAT MATTER ══════════════════════════════════════════════════
--
-- 1 · CASH BASIS, NOT ACCRUAL.  ***THE ASSERTION THIS FILE EXISTS FOR.***
--     Mark a vendor is_1099 with a TIN. Then:
--       • Enter and APPROVE a bill for 5,000.00 dated 20-Dec-2026. DO NOT PAY IT.
--       • Pay a DIFFERENT 1,000.00 bill on 05-Jan-2027.
--
--     → fin_1099_worksheet for tax_year 2026 MUST show 0 for this vendor (or no row at all).
--     → tax_year 2027 MUST show 1,000.00.
--
--     THE FAILING CONDITION IS 5,000.00 IN 2026. That figure would be wrong on a government form — and it
--     would BALANCE, tie to the GL, and match the P&L exactly, which is precisely what would make it look
--     correct to everyone who checked it internally. The only party who would ever catch it is the
--     contractor, holding a bank statement that says otherwise.
--
-- 2 · UNPOSTED PAYMENTS DO NOT COUNT.  Create a payment whose entry is draft/void.
--     → It MUST NOT appear. Money that did not move was not paid.
--
-- 3 · CURRENCY IS NOT MIXED.  Pay one 1099 vendor 1,000 USD and 1,000 EUR (base = USD, rate 1.10).
--     → total_paid MUST be 2,100.00 (1,000 + 1,100), NOT 2,000.00.
--     Summing fin_payments.amount directly would add two different units together and print the result on
--     a tax form. The amount is taken from the ledger's server-computed base_credit instead.
--
-- 4 · THE THRESHOLD DOES NOT HIDE ANYONE.  Pay a 1099 vendor 400.00 in the year.
--     → They MUST still appear in fin_1099_worksheet, with meets_threshold = false.
--     A worksheet that silently omitted sub-threshold contractors would give a filer no way to notice that
--     a contractor they PAID is missing — and no way to catch a payment posted to the wrong vendor.
--
-- 5 · A MISSING TIN IS A BLOCKER, SURFACED IN ADVANCE — not a January discovery.
--     Mark a vendor is_1099, pay them 5,000.00, leave tax_id NULL.
--     → fin_1099_worksheet.missing_tax_id MUST be true.
--     → fin_1099_readiness(<year>) MUST return them with the problem stated in words.
--     A filing tool that reported this contractor as "ready" would surface the gap in late January, when
--     the contractor is unreachable and the deadline is days away. The readiness check returns the
--     BLOCKERS, never a bare boolean — "not ready" with no reason is a dead end at the worst moment of the
--     financial year.
--
-- 6 · NON-1099 VENDORS ARE ABSENT.  Pay an ordinary supplier 50,000.00.
--     → They MUST NOT appear anywhere in the 1099 views. Over-reporting is not the safe direction: it
--     files a form about someone who should not have received one.
--
-- 7 · CALENDAR YEAR, NOT FISCAL YEAR.  If the company's fiscal year ends 30-June, the 1099 still groups by
--     JANUARY–DECEMBER. The tax authority does not care what our fiscal calendar is.
