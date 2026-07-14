-- 0181 acceptance — INVOICE ↔ COGS LINK. Staging, 0116–0181 applied.
--
-- This closes the gap that 0180 left open, and the gap was the purest example of this session's recurring
-- finding: AN INCOMPLETE DOUBLE-ENTRY IS INVISIBLE TO DOUBLE-ENTRY'S OWN GUARANTEE.
--
-- An invoice that posts revenue but never posts the cost of the goods is not UNBALANCED — it is merely
-- MISSING HALF OF ITSELF. Debits equal credits. The trial balance ties to the penny. The integrity check
-- (0178) passes. And the company reports a 100% gross margin on that sale, while stock it no longer owns
-- sits on the balance sheet as an asset.

begin;

do $$ begin
  if exists (select 1 from information_schema.columns
              where table_name = 'fin_invoice_lines' and column_name = 'item_id')
  then raise notice 'COGS-LINK PASS: an invoice line can name the stock item it sold';
  else raise notice 'COGS-LINK FAIL: no link — revenue and its cost can still be separated by forgetfulness';
  end if;

  -- A line naming an item MUST state a quantity. A NULL qty would cost the sale at zero and reinstate the
  -- same bug, more subtly — the COGS entry would post, for £0.00, and look entirely legitimate.
  if exists (select 1 from pg_constraint where conname = 'fin_inv_line_item_qty_ck')
  then raise notice 'COGS-LINK PASS: an item line must state a quantity — a NULL qty cannot silently cost the sale at zero';
  else raise notice 'COGS-LINK FAIL: an item line may omit its quantity';
  end if;
end $$;

rollback;

-- ══ APP-LAYER ═══════════════════════════════════════════════════════════════════════════════
--
-- 1 · REVENUE AND COST POST TOGETHER.  ***THE ASSERTION THIS FILE EXISTS FOR.***
--     Stock: 10 units, avg cost 6.00. Invoice one line: 4 units of that item, 100.00 revenue.
--     Issue it.
--     → The invoice entry posts Dr AR 100 / Cr Revenue 100  (as before)
--     → AND a second entry posts Dr COGS 24.00 / Cr Inventory 24.00  (4 × 6.00)
--     → Stock falls to 6.
--     → Gross margin on this sale is 76.00, NOT 100.00.
--
--     THE FAILING CONDITION IS A MISSING COGS ENTRY, and it is invisible to every other check in this
--     system: the books balance, the trial balance ties, 0178's integrity check passes. The only symptom is
--     a 100% gross margin that every analytics page in the product will faithfully report.
--
-- 2 · INSUFFICIENT STOCK ABORTS THE WHOLE INVOICE.
--     Stock: 3 units. Invoice a line for 5 units. Issue it.
--     → MUST RAISE. And CRUCIALLY: the REVENUE must not post either. Re-read the invoice — it MUST still
--       be 'draft', with no posted_entry_id, and no journal entry anywhere.
--
--     This is the harder choice, taken deliberately. The softer one — post the revenue, skip the COGS,
--     warn somebody — IS the bug this migration exists to remove. An invoice you cannot cost is an invoice
--     whose margin you do not know, and posting it anyway means committing a number the system already
--     knows to be a lie.
--
-- 3 · A SERVICES INVOICE IS COMPLETELY UNAFFECTED.
--     An invoice whose lines carry NO item_id → posts exactly as it did before 0181: revenue and AR, no
--     COGS, no inventory movement, no error.
--     This must hold. The link ADDS a capability; it removes nothing. A services business must not notice
--     that this migration was ever applied.
--
-- 4 · CONCURRENCY: TWO INVOICES, ONE LAST UNIT.
--     Stock: 1 unit. Two users simultaneously issue invoices, each selling 1 of it.
--     → Exactly ONE MUST succeed. The other MUST RAISE AND ROLL BACK ENTIRELY — no revenue, no COGS.
--     fin_sell_inventory takes a row lock per item, and it is called INSIDE fin_issue_invoice's
--     transaction, so the loser aborts in full rather than posting revenue against stock it did not get.
--
-- 5 · SoD SURVIVES.  The issuer-≠-creator check (0131) MUST still fire before any inventory is touched.
--     A user cannot use the COGS path to sneak past segregation of duties.
--
-- 6 · THE BACKSTOP IS EMPTY.  fin_invoices_missing_cogs MUST return ZERO rows.
--     Any row means an invoice sold stock without costing it — carrying a 100% margin that every
--     profitability, break-even and unit-economics page is currently reading and believing.
--
-- 7 · CREDIT NOTES.  (KNOWN GAP — FLAGGED, NOT BUILT.)
--     Issuing a credit note against an invoice that moved stock does NOT currently return that stock to
--     inventory. For a services credit note this is correct. For a returned physical good it is not: the
--     revenue reverses but the goods stay expensed, understating inventory and overstating COGS.
--     This needs a founder decision (does a credit note imply a physical return?), so it is NOT silently
--     assumed. See the build report.
