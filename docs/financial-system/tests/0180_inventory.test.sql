-- 0180 acceptance — INVENTORY & COGS (weighted average, perpetual). Staging, 0116–0180 applied.

begin;
do $$ begin
  -- An asset cannot hold less than nothing. A CHECK, not a convention — it makes the bug UNREPRESENTABLE.
  if exists (select 1 from pg_constraint where conname = 'fin_inv_qty_nonneg_ck')
  then raise notice 'INV PASS: stock cannot go negative (CHECK) — selling goods you do not have is unrepresentable';
  else raise notice 'INV FAIL: inventory can go negative — COGS would be computed against stock that never existed';
  end if;

  if exists (select 1 from pg_rules where tablename = 'fin_inventory_movements' and rulename = 'fin_inv_mov_no_update')
  then raise notice 'INV PASS: the movement log is append-only — a system that can rewrite it can hide a theft';
  else raise notice 'INV FAIL: movements can be rewritten';
  end if;
end $$;
rollback;

-- ══ APP-LAYER ═══════════════════════════════════════════════════════════════════════════════
--
-- 1 · WEIGHTED AVERAGE.  Receive 10 @ 5.00 → avg 5.00. Receive 10 @ 7.00 → avg MUST be 6.00.
--     Sell 5 → COGS MUST be 30.00 (5 × 6.00), and Inventory MUST fall by exactly 30.00.
--     Not 25.00 (that would be FIFO), not 35.00 (LIFO). The founder chose weighted average.
--
-- 2 · REVENUE WITHOUT COGS IS THE WHOLE DISEASE.  Post a sale.
--     → An entry MUST exist debiting COGS (5000) and crediting Inventory (1300).
--     Without it the books STILL BALANCE and the company reports a 100% gross margin on everything it
--     sells. Every profitability, break-even and unit-economics page built this session reads that margin.
--     They would all be confidently, catastrophically wrong, and the trial balance would tie to the penny.
--
-- 3 · YOU CANNOT SELL WHAT YOU DO NOT HAVE.  ***THE REFUSAL.***
--     6 on hand. Attempt to sell 10.
--     → MUST RAISE, naming the 6. It MUST NOT post, MUST NOT drive stock negative, MUST NOT backorder.
--     A negative inventory balance means COGS was computed against the average cost of stock that never
--     existed — a fabricated number, in the ledger, permanently. And the books would balance.
--
-- 4 · CONCURRENCY.  6 on hand. Fire TWO simultaneous sales of 5 each.
--     → Exactly ONE MUST succeed; the other MUST RAISE.
--     Without the row lock both read qty=6, both pass the check, both post COGS — and the warehouse is
--     short by 4 while the ledger balances perfectly. (0127/0152 precedent.)
--
-- 5 · SHRINKAGE HAS ITS OWN ACCOUNT.  Write off 3 units.
--     → MUST post Dr 5900 (Inventory Write-offs) / Cr 1300. It MUST NOT touch 5000 (COGS).
--     Stock written off is not the cost of a SALE — it is the cost of a LOSS. Buried inside COGS, theft is
--     indistinguishable from a good month of trading, and the gross margin absorbs it silently.
--
-- 6 · A WRITE-OFF WITHOUT A REASON IS REFUSED.  fin_adjust_inventory(item, -3, period, NULL) MUST RAISE.
--     The reason is not paperwork. It is the only thing standing between "damaged in transit" and "walked
--     out of the door".
--
-- 7 · SEGREGATION OF DUTIES ON ADJUSTMENTS.  A user with fin_can_enter() (can record sales) but NOT
--     fin_can_configure() attempts an adjustment → MUST RAISE.
--     Whoever can sell must not also be able to make the resulting shortfall disappear. That combination,
--     in one person, IS the fraud.
--
-- 8 · COGS IS cost_type='direct'.  Check fin_accounts where code = '5000'.
--     → cost_type MUST be 'direct'. If it lands in the indirect (FIXED) bucket, 0176's break-even treats
--     the cost of goods as a fixed cost — and break-even becomes wildly, dangerously optimistic.
--
-- 9 · THE DERIVED STATE RECONCILES.  fin_inventory_check.discrepancy MUST be 0 for every item.
--     A non-zero discrepancy means something wrote qty_on_hand directly, bypassing the locked RPCs. The
--     movement history is what actually happened.
--
-- 10 · TENANT ISOLATION. Company B cannot see or move company A's stock.
