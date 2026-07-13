-- 0166 acceptance — FIXED ASSETS: depreciation + disposal. Staging, 0116–0166 applied.
--
-- Depreciation is the most dangerous arithmetic in this ledger, and not because it is hard. It is
-- dangerous because BOTH of its failure modes produce perfectly balanced entries:
--
--   • depreciating one month too long   → net book value falls BELOW salvage. The balance sheet now
--     claims the asset is worth less than you could scrap it for. Every total ties out.
--   • posting a slice twice (a re-run)  → the expense doubles and accumulated depreciation outruns
--     reality. Every total ties out.
--
-- Neither is caught by the balance assertion, the trial balance, or the reconciliation. Nothing in this
-- system would ever flag them. So they are asserted HERE, or they are not asserted at all.
--
-- Worse: the salvage failure is invisible until the FINAL month of an asset's useful life — years after
-- the code shipped, long after anyone is watching for it.

begin;

-- ── Structure: the two guards exist ──
do $$ begin
  -- The unique is what makes a re-run safe. Without it, a retried monthly job double-posts.
  if exists (select 1 from pg_constraint where conname = 'fin_depr_asset_period_uq')
  then raise notice 'ASSET PASS: unique (asset_id, period_id) — a re-run cannot post a second slice';
  else raise notice 'ASSET FAIL: no (asset, period) unique — a retried depreciation job WILL double-post';
  end if;

  -- You cannot depreciate below scrap value, so salvage must be strictly below cost at the outset.
  if exists (select 1 from pg_constraint where conname = 'fin_asset_salvage_lt_cost_ck')
  then raise notice 'ASSET PASS: salvage < cost enforced';
  else raise notice 'ASSET FAIL: an asset could be created with salvage >= cost';
  end if;

  -- Append-only: a posted slice is history.
  if exists (select 1 from pg_rules where tablename = 'fin_depreciation_entries' and rulename = 'fin_depr_no_delete')
  then raise notice 'ASSET PASS: posted depreciation cannot be deleted';
  else raise notice 'ASSET FAIL: a depreciation slice could be deleted — accumulated depreciation would silently understate, and the ledger would still balance';
  end if;
end $$;

rollback;

-- ══ APP-LAYER (open periods; a real session) ═════════════════════════════════════════════════
--
-- ASSET UNDER TEST: cost 10,000.00 · salvage 1,000.00 · useful life 12 months.
--   depreciable base = 9,000.00 → monthly slice = 750.0000
--
-- A · THE ARITHMETIC.  Run depreciation for month 1.
--     amount MUST be 750.0000 exactly, and the entry MUST be Dr 6500 Depreciation Expense 750 /
--     Cr 1900 Accumulated Depreciation 750.
--     Check the DIRECTION, not just the balance: Cr Expense / Dr Accumulated would balance perfectly and
--     would report depreciation as INCOME while increasing the asset's carrying value. Nothing downstream
--     would catch it (see 0163/0164 — this ledger's real defects always balance).
--
-- B · IDEMPOTENCY.  Run depreciation for the SAME (asset, period) again.
--     It MUST return the SAME entry_id and post NOTHING new.
--     fin_depreciation_entries MUST still hold exactly ONE row for that period, and Depreciation Expense
--     MUST still total 750 — not 1,500.
--     This is the assertion that protects a monthly cron that retries after a timeout. If it fails, every
--     failed-then-retried run silently doubles that month's expense.
--
-- C · THE SALVAGE FLOOR — the assertion this file exists for.
--     Run depreciation for months 1..12. After month 12:
--         accumulated_depreciation = 9,000.00   (12 × 750)
--         net_book_value           = 1,000.00   (= salvage, exactly)
--     Now run month 13. It MUST RAISE ("fully depreciated"), NOT post another 750.
--     If it posts, NBV becomes 250.00 — the books now claim a machine you could sell for 1,000 is worth
--     250. The entry balances. The trial balance ties. The auditor finds it years later.
--
-- D · THE CLAMPED FINAL SLICE.  Repeat with an awkward life: cost 10,000 · salvage 1,000 · life 7 months.
--     monthly = round(9,000 / 7, 4) = 1,285.7143
--     Months 1..6 post 1,285.7143 each = 7,714.2858.
--     Month 7 MUST post 1,285.7142 — the REMAINDER (9,000 − 7,714.2858) — not a full 1,285.7143.
--     Assert accumulated_depreciation lands on exactly 9,000.0000 and NBV on exactly 1,000.0000.
--     A full final slice would overshoot by 0.0001 and put NBV below salvage. That fraction of a cent is
--     the whole point: the rule is not "close enough", it is "never below salvage".
--
-- E · CLOSED PERIOD.  Attempt to run depreciation into a CLOSED period → MUST RAISE. Depreciation must
--     never be the thing that reaches back into a signed-off month.
--
-- F · DISPOSAL — ALL FOUR LEGS.  Asset cost 10,000, accumulated 9,000 (NBV 1,000). Dispose for 1,500.
--     The entry MUST contain:
--         Dr Cash                       1,500      (proceeds)
--         Dr Accumulated Depreciation   9,000      (remove it)
--         Cr Fixed Asset (at cost)     10,000      (remove the asset)
--         Cr Gain on Disposal             500      (1,500 proceeds − 1,000 NBV)
--     Assert ALL FOUR. Omitting the accumulated-depreciation reversal is the classic error: the entry can
--     still be made to balance, and it leaves a phantom 9,000 contra-asset on the balance sheet FOREVER,
--     quietly understating total assets for the life of the company.
--
-- G · DISPOSAL AT A LOSS.  Same asset, disposed for 400 → Dr Loss on Disposal 600 (400 − 1,000).
--     The gain/loss account takes a DEBIT here. If the sign is inverted, a 600 loss is reported as a 600
--     gain — a 1,200 swing in profit, from an entry that balances perfectly.
--
-- H · DISPOSED ASSETS STOP DEPRECIATING.  After disposal, fin_run_depreciation MUST RAISE. A disposed
--     asset that keeps depreciating creates expense for a thing the company no longer owns.
