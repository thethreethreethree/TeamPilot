-- 0144 — Financial System: date-ranged statements (period reporting; still no new data model).
--
-- Adds optional (p_from, p_to) to fin_statements. Semantics are standard accounting, NOT a choice:
--   • Income Statement (P&L) — a FLOW: revenue/expense summed over entries with entry_date in
--     [p_from, p_to]. This is the selected period's earnings.
--   • Balance Sheet + Trial Balance — a STOCK / point-in-time: balances as-of p_to (all posted
--     entries with entry_date <= p_to). p_from is intentionally ignored for these (a balance sheet is
--     "as of" a date, never "between" two dates).
--   • Balance-sheet net income stays CUMULATIVE as-of p_to (Σrevenue−Σexpense through p_to), so the
--     sheet still ties out (Assets = Liabilities + Equity + Net Income). It therefore differs from the
--     Income Statement's period net income when a range is set — that is correct (period flow vs
--     cumulative position); the UI labels them distinctly.
--
-- SAFETY: with BOTH params null (the default + the current call site), every filter below reduces to
-- "any posted entry", so the result is IDENTICAL to the pre-0144 all-time behaviour. The date range is
-- purely additive/opt-in. Overloads the name (fin_statements() still resolves via the defaults).
--
-- Idempotent (create or replace + drop the old zero-arg overload).

-- Drop the pre-0144 zero-arg fin_statements(): otherwise it coexists with the new
-- fin_statements(date default, date default) and a no-arg rpc('fin_statements') call becomes
-- AMBIGUOUS (both match with zero args) → error on the live statements page. Dropping it makes the
-- no-arg call resolve unambiguously to the new function via its defaults (= all-time, unchanged).
drop function if exists fin_statements();

create or replace function fin_statements(p_from date default null, p_to date default null)
returns jsonb language sql stable security invoker set search_path = public as $$
  with lines as (
    select a.id as account_id, a.code, a.name, a.type,
           coalesce(l.base_debit, 0)  as base_debit,
           coalesce(l.base_credit, 0) as base_credit,
           e.entry_date
    from fin_accounts a
    left join fin_journal_lines   l on l.account_id = a.id
    left join fin_journal_entries e on e.id = l.entry_id and e.status = 'posted'
    where a.company_id = auth_company_id()
  ),
  -- as-of p_to (Trial Balance + Balance Sheet): posted entries dated on/before p_to.
  asof as (
    select account_id, code, name, type,
           sum(base_debit)  filter (where entry_date is not null and (p_to is null or entry_date <= p_to)) as debit_total,
           sum(base_credit) filter (where entry_date is not null and (p_to is null or entry_date <= p_to)) as credit_total
    from lines group by account_id, code, name, type
  ),
  -- over [p_from, p_to] (Income Statement): posted entries dated within the range.
  period as (
    select account_id, code, name, type,
           sum(base_debit)  filter (where entry_date is not null and (p_from is null or entry_date >= p_from) and (p_to is null or entry_date <= p_to)) as debit_total,
           sum(base_credit) filter (where entry_date is not null and (p_from is null or entry_date >= p_from) and (p_to is null or entry_date <= p_to)) as credit_total
    from lines group by account_id, code, name, type
  ),
  a as (select account_id, code, name, type,
               coalesce(debit_total,0) as debit_total, coalesce(credit_total,0) as credit_total,
               (coalesce(debit_total,0) - coalesce(credit_total,0)) as net
        from asof),
  p as (select account_id, code, name, type,
               coalesce(debit_total,0) as debit_total, coalesce(credit_total,0) as credit_total
        from period)
  select jsonb_build_object(
    'trial_balance', jsonb_build_object(
      'rows', (select coalesce(jsonb_agg(jsonb_build_object(
                 'account_id', account_id, 'code', code, 'name', name, 'type', type,
                 'debit', greatest(net, 0), 'credit', greatest(-net, 0)) order by code), '[]'::jsonb)
               from a where net <> 0),
      'total_debit',  (select coalesce(sum(greatest(net, 0)), 0)  from a),
      'total_credit', (select coalesce(sum(greatest(-net, 0)), 0) from a)
    ),
    'income_statement', jsonb_build_object(
      'revenue',  (select coalesce(jsonb_agg(jsonb_build_object('code',code,'name',name,'amount',credit_total-debit_total) order by code),'[]'::jsonb) from p where type='revenue' and (credit_total-debit_total) <> 0),
      'expenses', (select coalesce(jsonb_agg(jsonb_build_object('code',code,'name',name,'amount',debit_total-credit_total) order by code),'[]'::jsonb) from p where type='expense' and (debit_total-credit_total) <> 0),
      'total_revenue',  (select coalesce(sum(credit_total-debit_total),0) from p where type='revenue'),
      'total_expenses', (select coalesce(sum(debit_total-credit_total),0) from p where type='expense'),
      'net_income',     (select coalesce(sum(credit_total-debit_total),0) from p where type='revenue')
                      - (select coalesce(sum(debit_total-credit_total),0) from p where type='expense')
    ),
    'balance_sheet', jsonb_build_object(
      'assets',      (select coalesce(jsonb_agg(jsonb_build_object('code',code,'name',name,'amount',debit_total-credit_total) order by code),'[]'::jsonb) from a where type='asset' and (debit_total-credit_total) <> 0),
      'liabilities', (select coalesce(jsonb_agg(jsonb_build_object('code',code,'name',name,'amount',credit_total-debit_total) order by code),'[]'::jsonb) from a where type='liability' and (credit_total-debit_total) <> 0),
      'equity',      (select coalesce(jsonb_agg(jsonb_build_object('code',code,'name',name,'amount',credit_total-debit_total) order by code),'[]'::jsonb) from a where type='equity' and (credit_total-debit_total) <> 0),
      'total_assets',      (select coalesce(sum(debit_total-credit_total),0) from a where type='asset'),
      'total_liabilities', (select coalesce(sum(credit_total-debit_total),0) from a where type='liability'),
      'total_equity',      (select coalesce(sum(credit_total-debit_total),0) from a where type='equity'),
      -- cumulative net income as-of p_to (keeps the sheet tying out)
      'net_income',        (select coalesce(sum(credit_total-debit_total),0) from a where type='revenue')
                         - (select coalesce(sum(debit_total-credit_total),0) from a where type='expense')
    )
  );
$$;
