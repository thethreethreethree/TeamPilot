-- 0134 — Financial System: core financial statements (READ-ONLY derivation, no new data model)
--
-- Trial Balance + Income Statement (P&L) + Balance Sheet, all computed in SQL from the existing
-- fin_account_balances view (which derives from posted lines). No tables, no writes — a pure readout
-- of the verified Phase-1 GL, like fin_dashboard_summary / fin_ar_aging_summary already are.
-- security invoker + auth_company_id() → tenant-safe.
--
-- Sign conventions: revenue/liability/equity are credit-normal (amount = credit_total − debit_total);
-- asset/expense are debit-normal (amount = debit_total − credit_total). Net income = Σrevenue −
-- Σexpense. The balance sheet ties out because Assets − Liabilities − Equity = Revenue − Expenses =
-- Net Income (the accounting equation holds since every posted entry balances), so the page shows
-- Assets vs (Liabilities + Equity + Net Income).
--
-- Idempotent (create or replace).

create or replace function fin_statements()
returns jsonb language sql stable security invoker set search_path = public as $$
  with b as (
    select code, name, type, debit_total, credit_total,
           (debit_total - credit_total) as net
    from fin_account_balances
    where company_id = auth_company_id()
  )
  select jsonb_build_object(
    'trial_balance', jsonb_build_object(
      'rows', (select coalesce(jsonb_agg(jsonb_build_object(
                 'code', code, 'name', name, 'type', type,
                 'debit', greatest(net, 0), 'credit', greatest(-net, 0)) order by code), '[]'::jsonb)
               from b where net <> 0),
      'total_debit',  (select coalesce(sum(greatest(net, 0)), 0)  from b),
      'total_credit', (select coalesce(sum(greatest(-net, 0)), 0) from b)
    ),
    'income_statement', jsonb_build_object(
      'revenue',  (select coalesce(jsonb_agg(jsonb_build_object('code',code,'name',name,'amount',credit_total-debit_total) order by code),'[]'::jsonb) from b where type='revenue' and (credit_total-debit_total) <> 0),
      'expenses', (select coalesce(jsonb_agg(jsonb_build_object('code',code,'name',name,'amount',debit_total-credit_total) order by code),'[]'::jsonb) from b where type='expense' and (debit_total-credit_total) <> 0),
      'total_revenue',  (select coalesce(sum(credit_total-debit_total),0) from b where type='revenue'),
      'total_expenses', (select coalesce(sum(debit_total-credit_total),0) from b where type='expense'),
      'net_income',     (select coalesce(sum(credit_total-debit_total),0) from b where type='revenue')
                      - (select coalesce(sum(debit_total-credit_total),0) from b where type='expense')
    ),
    'balance_sheet', jsonb_build_object(
      'assets',      (select coalesce(jsonb_agg(jsonb_build_object('code',code,'name',name,'amount',debit_total-credit_total) order by code),'[]'::jsonb) from b where type='asset' and (debit_total-credit_total) <> 0),
      'liabilities', (select coalesce(jsonb_agg(jsonb_build_object('code',code,'name',name,'amount',credit_total-debit_total) order by code),'[]'::jsonb) from b where type='liability' and (credit_total-debit_total) <> 0),
      'equity',      (select coalesce(jsonb_agg(jsonb_build_object('code',code,'name',name,'amount',credit_total-debit_total) order by code),'[]'::jsonb) from b where type='equity' and (credit_total-debit_total) <> 0),
      'total_assets',      (select coalesce(sum(debit_total-credit_total),0) from b where type='asset'),
      'total_liabilities', (select coalesce(sum(credit_total-debit_total),0) from b where type='liability'),
      'total_equity',      (select coalesce(sum(credit_total-debit_total),0) from b where type='equity'),
      'net_income',        (select coalesce(sum(credit_total-debit_total),0) from b where type='revenue')
                         - (select coalesce(sum(debit_total-credit_total),0) from b where type='expense')
    )
  );
$$;

-- GL detail for one account: posted lines with entry context (drill-down; "every figure traceable").
create or replace function fin_gl_detail(p_account_id uuid)
returns jsonb language sql stable security invoker set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'entry_no', e.entry_no, 'entry_date', e.entry_date, 'description', e.description,
    'debit', l.base_debit, 'credit', l.base_credit) order by e.entry_date, e.entry_no), '[]'::jsonb)
  from fin_journal_lines l
  join fin_journal_entries e on e.id = l.entry_id
  where l.account_id = p_account_id and e.status = 'posted'
    and l.company_id = auth_company_id();
$$;
