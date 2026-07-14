-- 0177 acceptance — NET PROFIT BY SEGMENT + IDLE RESOURCES. Staging, 0116–0177 applied.

begin;
do $$ begin
  if (select count(*) from pg_views where viewname in
       ('fin_net_profit_by_customer','fin_net_profit_by_cost_center','fin_idle_resources',
        'fin_overhead_by_cost_center','fin_fully_depreciated_assets')) = 5
  then raise notice 'SEG PASS: all five views exist';
  else raise notice 'SEG FAIL: a view is missing';
  end if;
end $$;
rollback;

-- ══ APP-LAYER ═══════════════════════════════════════════════════════════════════════════════
--
-- 1 · THE SUBSIDISED CUSTOMER.  ***THE FINDING THIS FEATURE EXISTS TO PRODUCE.***
--     Customer A: revenue 100,000, direct cost 70,000 → contribution +30,000 (looks profitable).
--     Company overhead 200,000; A's share of direct cost is 50% → allocated_overhead 100,000.
--     → net_profit MUST be −70,000.
--
--     On every other page in this product, Customer A is a good customer. Here they are the reason the
--     bank balance is falling. This is usually a LARGE customer — large customers consume the most
--     overhead while negotiating the best prices, so contribution margin flatters them the most.
--
-- 2 · NET IS NULL WHEN OVERHEAD IS UNKNOWN — never the contribution margin.
--     A month with overhead but no direct cost to allocate it by (total_direct = 0).
--     → net_profit MUST be NULL, not the gross figure.
--     Falling back to contribution under a heading that says "Net" would report a customer as profitable at
--     the exact moment we could not work out what serving them cost. Same refusal as 0173 and 0176.
--
-- 3 · ONE DRIVER, ONE TRUTH.  Overhead allocated to projects (0173) and to cost centres (0177) MUST use
--     the SAME driver — share of direct cost. Two drivers would produce two different "truths" about the
--     same overhead pool, and the two pages would disagree with each other while both looked right.
--
-- 4 · IDLE = A FACT, NOT A VERDICT.  A cost centre with 40,000 of cost and 0 revenue.
--     → It MUST appear in fin_idle_resources with cost_consumed = 40,000.
--     → NOTHING in the schema or the copy may call it "waste". R&D consumes and produces nothing for two
--       years; so does a new market; so does the finance department. A system that labelled those as waste
--       would be confidently wrong about the most important money a company spends, and a founder who
--       trusted it would cut precisely the wrong things.
--     The value is not the verdict. It is that nobody had noticed the 40,000 at all.
--
-- 5 · A PROFITABLE PROJECT IS NOT IDLE.  Any project with revenue > 0 MUST NOT appear, no matter how much
--     it cost. Cost alone is not idleness.
--
-- 6 · FULLY DEPRECIATED ≠ WASTE.  An asset with accumulated depreciation = cost − salvage, not disposed.
--     → It appears in fin_fully_depreciated_assets. This is INFORMATIONAL: a paid-off machine still running
--     is the best asset a company owns. The only question it raises is whether the thing still exists.
--
-- 7 · TENANT ISOLATION. Company B sees only company B (security_invoker — the 2026-07-14 fix).
