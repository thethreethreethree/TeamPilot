-- 0163 — PHASE 3: complete the manual reconciliation interface — "create the missing entry on the spot".
--
-- Spec: FinancialSystem.md §4 Phase 3 — "Manual reconciliation interface for unmatched items".
-- Status before this migration: PARTIAL. A clerk could MATCH an unmatched bank line to an existing GL
-- entry (fin_match_bank_txn, 0145) or IGNORE it. What they could NOT do is the most common case in real
-- reconciliation: the bank line has no corresponding entry BECAUSE WE NEVER RECORDED IT.
--
-- THE CASE THIS CLOSES
-- A bank fee. Interest. An FX charge. A direct debit nobody booked. The bank knows about it; the ledger
-- does not. Today the clerk's only options are to match it to something it isn't, or to ignore it — and
-- ignoring it is the dangerous one, because the bank line disappears from the worklist while the ledger
-- stays wrong. The cash balance then disagrees with the bank by exactly that amount, permanently, and the
-- reconciliation "looks done". A worklist you can empty by hiding rows is not a control.
--
-- So: create the entry, post it, and match it — in one transaction, from the reconciliation screen.
--
-- THE DOUBLE ENTRY (derived from the SIGN, not from the user)
--   amount < 0 (money LEFT the bank):  Dr <chosen expense account>   Cr <the bank's cash GL account>
--   amount > 0 (money ENTERED):        Dr <the bank's cash GL account>   Cr <chosen income account>
-- The clerk picks ONE account (what it was for). The system derives the other side and the direction from
-- the bank line itself. Letting a human choose the direction is how a reconciliation entry ends up posted
-- backwards — and a backwards entry still balances, so nothing downstream catches it.
--
-- The entry posts through fin_post_system_entry — the SAME path every other subledger uses. Not a second
-- posting idiom (§A13). It therefore inherits the open-period check, the balance assertion, and the
-- gap-free entry numbering for free.
--
-- CONCURRENCY: the bank line is locked FOR UPDATE before its status is checked, so two clerks cannot both
-- create an entry for the same line and post the fee twice (§A26 — the row-lock class swept in
-- 0127/0132/0152/0153).
--
-- Idempotent (§A12). NOT VERIFIED against a live database (no DB access). BUILT, not TESTED.

create or replace function fin_reconcile_create_entry(
  p_txn_id     uuid,
  p_account_id uuid,          -- the OTHER side: what this money was for (an expense, or an income)
  p_description text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_company uuid; v_status text; v_amount numeric(19,4); v_date date; v_bank uuid;
  v_cash uuid; v_period uuid; v_acct_company uuid; v_base char(3);
  v_lines jsonb; v_entry uuid; v_desc text;
begin
  if not fin_can_enter() then
    raise exception 'Not authorized to reconcile bank transactions';
  end if;

  -- Lock the line first: two clerks must not both create an entry for the same charge (§A26).
  select t.company_id, t.status, t.amount, t.txn_date, t.bank_account_id, coalesce(p_description, t.description)
    into v_company, v_status, v_amount, v_date, v_bank, v_desc
    from fin_bank_transactions t
   where t.id = p_txn_id
     for update;

  if v_company is null or v_company <> auth_company_id() then
    raise exception 'Bank transaction not found in your company';
  end if;
  if v_status <> 'unmatched' then
    raise exception 'Only an unmatched bank line can have an entry created for it (current: %)', v_status;
  end if;
  if v_amount = 0 then
    raise exception 'A zero-amount bank line cannot produce a balanced entry';
  end if;

  -- The account the clerk chose must be ours. Without this check a clerk could post the other side of a
  -- real bank movement into ANOTHER company's chart of accounts.
  select company_id into v_acct_company from fin_accounts where id = p_account_id;
  if v_acct_company is null or v_acct_company <> v_company then
    raise exception 'Account not found in your company';
  end if;

  -- The bank's own GL cash account is the counter-side. It is not a choice.
  select gl_account_id into v_cash from fin_bank_accounts where id = v_bank;
  if v_cash is null then
    raise exception 'This bank account has no linked GL cash account — link one before reconciling';
  end if;
  if v_cash = p_account_id then
    raise exception 'The other side cannot be the bank''s own cash account — that entry would say nothing';
  end if;

  select base_currency into v_base from fin_settings where company_id = v_company;

  select id into v_period from fin_periods
   where company_id = v_company and status = 'open'
     and v_date between start_date and end_date
   order by start_date desc limit 1;
  if v_period is null then
    raise exception 'No OPEN period covers the bank date % — reopen it, or post the correction into an open period', v_date;
  end if;

  -- Direction is DERIVED from the bank line's sign, never asked of the user. A reconciliation entry
  -- posted backwards still balances, so nothing downstream would catch it.
  if v_amount < 0 then
    -- money left the bank: Dr the expense, Cr cash
    v_lines := jsonb_build_array(
      jsonb_build_object('account_id', p_account_id, 'debit', abs(v_amount), 'credit', 0,
                         'currency', v_base, 'memo', coalesce(v_desc, 'Bank reconciliation')),
      jsonb_build_object('account_id', v_cash, 'debit', 0, 'credit', abs(v_amount),
                         'currency', v_base, 'memo', 'Bank')
    );
  else
    -- money entered the bank: Dr cash, Cr the income
    v_lines := jsonb_build_array(
      jsonb_build_object('account_id', v_cash, 'debit', v_amount, 'credit', 0,
                         'currency', v_base, 'memo', 'Bank'),
      jsonb_build_object('account_id', p_account_id, 'debit', 0, 'credit', v_amount,
                         'currency', v_base, 'memo', coalesce(v_desc, 'Bank reconciliation'))
    );
  end if;

  -- Same posting path as every other subledger — inherits the open-period gate, the balance assertion,
  -- and gap-free entry numbering. Not a second idiom.
  v_entry := fin_post_system_entry(
    v_company, v_date, v_period,
    coalesce(v_desc, 'Bank reconciliation'), 'bank', v_lines
  );

  -- Match it to the line that caused it, so the bank row is now explained BY the entry it created.
  insert into fin_reconciliation_matches (company_id, bank_transaction_id, entry_id, matched_by)
    values (v_company, p_txn_id, v_entry, auth.uid());

  update fin_bank_transactions set status = 'matched' where id = p_txn_id;

  return v_entry;
end $$;
