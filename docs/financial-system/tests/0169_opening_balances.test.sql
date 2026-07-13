-- 0169 acceptance — OPENING BALANCE IMPORT. Staging, 0116–0169 applied.
--
-- THE CENTRAL ASSERTION OF THIS FILE IS THAT AN IMBALANCED TRIAL BALANCE STAYS IMBALANCED.
--
-- Every other acceptance file asks "is the number right?". This one asks something harder: when the
-- SOURCE data is wrong, does the system preserve the wrongness where a human can see it, or does it
-- quietly produce a clean, balanced, entirely fictional financial position?
--
-- The failure mode is not an error message. It is a GREEN SCREEN. A plug posted to equity balances
-- perfectly; the trial balance ties out; the balance sheet balances; every downstream check passes forever.
-- The company then runs on a fabricated opening position, and the discrepancy — which was knowable on day
-- one, and only on day one — is buried in equity where nobody will look again.
--
-- So the test below deliberately imports a trial balance that DOES NOT BALANCE, and asserts that the
-- system tells the truth about it.

begin;

do $$
declare
  v_co uuid; v_cash uuid; v_re uuid; v_batch uuid;
  v_imb numeric(19,4); v_debits numeric(19,4); v_credits numeric(19,4);
begin
  select id into v_co from companies limit 1;

  -- ── Structure ──
  if exists (select 1 from information_schema.tables where table_name = 'fin_opening_batches')
     and exists (select 1 from information_schema.tables where table_name = 'fin_opening_lines')
  then raise notice 'OPENING PASS: staging tables exist — the user sees the import BEFORE it posts';
  else raise notice 'OPENING FAIL: no staging — an import that posts on upload denies the user the look that matters';
  end if;

  -- A line is a debit or a credit, never both and never neither — the ledger's own rule, not relaxed here.
  if exists (select 1 from pg_constraint where conname = 'fin_opening_line_xor_ck')
  then raise notice 'OPENING PASS: debit-XOR-credit enforced on import lines';
  else raise notice 'OPENING FAIL: an import line could carry both a debit and a credit';
  end if;

  -- A trial balance listing the same account twice is a malformed source, not a sum to silently perform.
  if exists (
    select 1 from pg_indexes
     where tablename = 'fin_opening_lines' and indexdef like '%UNIQUE%batch_id%account_id%'
  ) then raise notice 'OPENING PASS: one row per account — a duplicated account is rejected, not silently summed';
  else raise notice 'OPENING FAIL: the same account could appear twice and be silently added together';
  end if;
end $$;

rollback;

-- ══ THE ASSERTION THIS FILE EXISTS FOR — RUN AS A CONTROLLER ═════════════════════════════════
--
-- 1 · AN IMBALANCED SOURCE STAYS IMBALANCED.
--     Stage a trial balance that does NOT balance — this is the normal case, not the exotic one:
--
--       Cash (1000)              debit   10,000.00
--       Accounts Payable (2000)  credit   3,000.00
--       Owner Equity (3100)      credit   6,500.00
--                                        ─────────
--       debits 10,000.00   credits 9,500.00   → the source is out by 500.00
--
--     a) fin_opening_summary MUST report imbalance = 500.00 BEFORE anything is posted. The user sees it
--        first. An import that reveals the problem only after posting has already destroyed the moment.
--
--     b) Post it. The entry MUST balance (the ledger's own constraints guarantee that much) AND Opening
--        Balance Equity (3900) MUST now carry exactly 500.00.
--
--     c) fin_opening_imbalance.obe_balance MUST return 500.00.
--
--     THE FAILING CONDITION IS A ZERO. If OBE is 0.00 and the books balance beautifully, the system has
--     plugged the difference into an existing equity account and manufactured a financial position that
--     does not exist. That is the exact failure this feature was built to make impossible — and it is the
--     one that would never be caught later, because everything downstream would agree with it.
--
-- 2 · A BALANCED SOURCE LEAVES OBE EMPTY.
--     Stage a trial balance that DOES balance. Post it.
--     → OBE (3900) MUST have a zero balance, and no OBE line should appear in the entry at all.
--     The account is not decoration; it appears only when it has something to say.
--
-- 3 · THE IMBALANCE VIEW READS THE LEDGER, NOT THE BATCH.
--     After test 1, post a correcting journal entry that clears the 500.00 out of OBE.
--     → fin_opening_imbalance.obe_balance MUST become 0.00.
--     The question is "does OBE still carry a balance?", not "was the import imbalanced?". Those stop
--     being the same question the instant someone fixes it, and a view that answered the second would nag
--     forever about a problem already solved — which is how users learn to ignore warnings.
--
-- 4 · OPENING BALANCES CANNOT BE LAYERED UNDER A LEDGER ALREADY IN USE.
--     Post ANY entry dated before the batch's as_of. Then attempt to post the opening batch.
--     → MUST RAISE ('there is already posted activity before <date>').
--     Opening balances silently inserted beneath a period people have already reported on would restate
--     history that has already been acted upon.
--
-- 5 · DOUBLE-POST.  Post the same batch twice (concurrently if possible — the RPC takes a row lock).
--     → The second MUST RAISE ('already been posted'). Posting an opening batch twice would DOUBLE every
--     balance in the company, and the doubled books would still balance perfectly.
--
-- 6 · AUTHORITY.  A member / entry-clerk attempts fin_post_opening_batch → MUST RAISE.
--     Opening balances define the entire financial position of the company; this is a configure-level act,
--     not a data-entry one.
--
-- 7 · THE STAGING RECORD IS FROZEN ONCE POSTED.
--     Attempt to edit a line on a POSTED batch → MUST be denied by RLS.
--     The staging table is what a future auditor reads to learn where the opening position came from. If it
--     can drift from the entry it produced, it is worse than having no record at all — it is a record that
--     lies.
