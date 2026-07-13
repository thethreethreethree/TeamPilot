-- 0163 acceptance — create the missing GL entry from the reconciliation screen.
-- Staging, 0116–0163 applied.
--
-- WHY THIS FILE IS MORE IMPORTANT THAN ITS SIZE SUGGESTS
-- Every other guard in this ledger is a BALANCE guard. A reconciliation entry posted BACKWARDS is
-- perfectly balanced — the deferred balance assertion passes, the trial balance ties out, and the income
-- statement reports a bank fee as INCOME. Nothing downstream catches it. Ever.
--
-- So the assertion that matters here is not "does it post" but "does it post in the RIGHT DIRECTION",
-- and it is asserted from the SIGN of the bank line, which is the only fact that can decide it.
--
-- What must hold:
--   1. amount < 0 (money LEFT the bank) → Dr the chosen expense account, Cr the bank's cash account.
--   2. amount > 0 (money ENTERED)       → Dr the bank's cash account, Cr the chosen income account.
--   3. The posted entry BALANCES (inherited from fin_post_system_entry, asserted anyway — a regression
--      here would be silent).
--   4. The bank line ends 'matched' and is linked to the entry it created (traceability, spec §3).
--   5. A second call on the same line is REFUSED (no double-posting a bank fee).
--   6. The chosen account must belong to the caller's company (no posting the other side into another
--      tenant's chart of accounts).
--   7. The counter-side may not be the bank's own cash account (that entry would say nothing).
--   8. A zero-amount line is refused (it cannot produce a balanced entry).
--   9. No OPEN period covering the bank date → refused, not silently posted into a closed month.

begin;

-- ── 5,7,8 — the structural refusals (service-role testable) ───────────
do $$ begin
  if exists (select 1 from pg_proc where proname = 'fin_reconcile_create_entry') then
    raise notice 'RECON PASS: fin_reconcile_create_entry exists';
  else
    raise notice 'RECON FAIL: fin_reconcile_create_entry missing — the escape hatch is still open';
  end if;

  -- the one-match-per-bank-line unique is what makes the double-post structurally impossible
  if exists (select 1 from pg_constraint where conname = 'fin_recon_txn_uq') then
    raise notice 'RECON PASS: unique (bank_transaction_id) — one bank line cannot be explained twice';
  else
    raise notice 'RECON FAIL: a bank line could be matched twice — the fee could be posted twice';
  end if;
end $$;

rollback;

-- ══ APP-LAYER (a real session + an open period; these are the assertions that matter) ═════════
--
-- SETUP: a bank account linked to cash GL 1000; an OPEN period covering the txn date; an expense
-- account (say 6xxx "Bank charges") and an income account (say 4xxx).
--
-- 1 · DIRECTION, money OUT.  Import a bank line of -25.00 (a fee) on a date inside the open period.
--     Call fin_reconcile_create_entry(txn, <6xxx bank charges>, 'Monthly fee').
--     The posted entry MUST be:
--         Dr 6xxx Bank charges   25.00
--         Cr 1000 Cash           25.00
--     If it posts Cr 6xxx / Dr 1000, the fee has been booked as INCOME and cash has been INCREASED by
--     money that actually left. The entry still balances, so NOTHING else in the system will ever flag
--     it. This is the single assertion this migration exists for.
--
-- 2 · DIRECTION, money IN.  Import a bank line of +10.00 (interest).
--     Call fin_reconcile_create_entry(txn, <4xxx interest income>).
--     The posted entry MUST be:
--         Dr 1000 Cash            10.00
--         Cr 4xxx Interest income 10.00
--
-- 3 · BALANCE.  For both, sum(debit) = sum(credit) on the resulting entry. (It is inherited from
--     fin_post_system_entry, but assert it — a regression here would be silent, which is the whole
--     theme of this file.)
--
-- 4 · TRACEABILITY.  After each call:
--       fin_bank_transactions.status = 'matched'
--       a fin_reconciliation_matches row links that txn to the returned entry_id
--     So the bank line is now explained BY the entry it created, and the entry is reachable from the
--     line. A figure with no path back to its source is not traceable (spec §3).
--
-- 5 · NO DOUBLE POST.  Call fin_reconcile_create_entry AGAIN on the SAME txn → MUST RAISE ("only an
--     unmatched bank line…"). If it succeeds, the bank fee is now in the ledger twice and cash is
--     understated by 25.00. Also run two calls CONCURRENTLY (two sessions): the row lock must serialize
--     them so the second sees 'matched' and raises — not both pass the status check.
--
-- 6 · CROSS-TENANT.  Call it with an account_id belonging to ANOTHER company → MUST RAISE ("Account not
--     found in your company"). Without this, a clerk posts the other side of a real bank movement into a
--     different tenant's chart of accounts.
--
-- 7 · SELF-REFERENCE.  Pass the bank's OWN cash GL account as p_account_id → MUST RAISE. Dr Cash / Cr
--     Cash balances perfectly and means nothing; it would silently "explain" the line while leaving the
--     books unchanged — the worst possible outcome, because the worklist would go quiet.
--
-- 8 · ZERO.  A 0.00 bank line → MUST RAISE (no balanced entry is possible).
--
-- 9 · CLOSED PERIOD.  A bank line dated inside a CLOSED period → MUST RAISE with the open-period message.
--     A reconciliation must never be the thing that reaches back into a signed-off month.
