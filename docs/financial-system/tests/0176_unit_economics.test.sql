-- 0176 acceptance — UNIT ECONOMICS & BREAK-EVEN. Staging, 0116–0176 applied.
--
-- THE ASSERTION THIS FILE EXISTS FOR IS TEST 2, AND IT IS ABOUT A NUMBER THE SYSTEM MUST REFUSE TO PRINT.

begin;

do $$ begin
  if exists (select 1 from information_schema.columns
              where table_name = 'fin_break_even' and column_name = 'undefined_because')
  then raise notice 'BE PASS: an undefined break-even carries its REASON in words, not an empty cell';
  else raise notice 'BE FAIL: the surface has no way to explain WHY there is no break-even, and will render a blank';
  end if;
end $$;

rollback;

-- ══ APP-LAYER ═══════════════════════════════════════════════════════════════════════════════
--
-- 1 · A HEALTHY MONTH COMPUTES.
--     Revenue 100,000 · variable (direct) cost 40,000 · fixed (indirect) cost 30,000.
--     → contribution = 60,000; contribution_ratio = 0.60; break_even_revenue = 50,000.00
--       (30,000 ÷ 0.60). Above 50,000 of revenue the company is in profit.
--
-- 2 · A NEGATIVE CONTRIBUTION MARGIN HAS NO BREAK-EVEN.  ***THE ASSERTION THIS FILE EXISTS FOR.***
--     Revenue 100,000 · variable cost 120,000 (each sale costs more to deliver than it earns) ·
--     fixed cost 30,000.
--
--     → break_even_revenue MUST be NULL.
--     → undefined_because MUST say, in words, that no volume breaks even and that selling more increases
--       the loss.
--
--     THE FAILING CONDITION IS A NUMBER. The textbook formula divides anyway:
--         ratio = (100,000 − 120,000) / 100,000 = −0.20
--         break-even = 30,000 / −0.20 = −150,000   → rendered as 150,000, or as "£150,000 to break even"
--     A founder reads that as a target and goes selling. Every sale they make MAKES THE LOSS BIGGER. The
--     system will have instructed them to accelerate toward the wall — and it will have looked like
--     ordinary financial advice, with a plausible figure attached.
--
--     This is the most dangerous number in the entire financial system, because it is wrong in the
--     direction of ACTION. It does not merely mislead; it INSTRUCTS.
--
-- 3 · ZERO REVENUE IS NOT ZERO RATIO.
--     Revenue 0 · fixed cost 30,000.
--     → contribution_ratio MUST be NULL (not 0), and break_even_revenue MUST be NULL.
--     A ratio of "nothing per nothing" is undefined, not zero — and a 0 ratio propagates into a division
--     by zero, or into an infinite break-even quietly rendered as a finite one.
--
-- 4 · A PROJECT THAT LOSES MONEY ON EVERY SALE IS FLAGGED.
--     Project A: revenue 50,000, direct cost 60,000.
--     → loses_money_per_sale MUST be true.
--     This project is INVISIBLE on a revenue-ranked list — and it will often sit near the TOP of one,
--     because a service sold below cost tends to sell extremely well. Revenue ranking would present the
--     company's worst project as its best.
--
-- 5 · THE FIXED/VARIABLE SPLIT FOLLOWS cost_type, AND ONLY cost_type.
--     Move an account from cost_type='direct' to 'indirect'.
--     → It MUST move from variable_cost to fixed_cost, and the break-even MUST change accordingly.
--     The model is not hidden: the user can see and change the assumption that drives the answer. A model
--     whose assumptions you cannot argue with is one you should not trust.
--
-- 6 · ONLY POSTED ENTRIES. A draft bill MUST NOT move the break-even. Otherwise anyone with entry rights
--     could change the company's headline target with no approval.
--
-- 7 · TENANT ISOLATION. As company B, select from fin_break_even → only company B's months.
--     (security_invoker — the 2026-07-14 cross-tenant view fix.)
