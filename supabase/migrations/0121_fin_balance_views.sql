-- 0121 — Financial System: derived-balance views (the "traceable derived figure" promise)
--
-- Balances are NEVER stored — they are derived here by summing POSTED lines. security_invoker=true
-- so the views run with the QUERYING user's RLS (only their company, and only if they hold finance
-- view access) — no cross-tenant leak. These back the Finance dashboard + the trial balance report.
--
-- Idempotent (create or replace view). Acceptance: exercised by the 0116-0120 smoke test's
-- trial-balance/derived-balance assertions (T-11, T-12).

-- Per-account balance over posted lines, signed for presentation by the account's normal balance.
create or replace view fin_account_balances with (security_invoker = true) as
select
  a.company_id,
  a.id   as account_id,
  a.code,
  a.name,
  a.type,
  a.normal_balance,
  coalesce(sum(l.base_debit)  filter (where e.status = 'posted'), 0) as debit_total,
  coalesce(sum(l.base_credit) filter (where e.status = 'posted'), 0) as credit_total,
  case when a.normal_balance = 'debit'
    then coalesce(sum(l.base_debit)  filter (where e.status = 'posted'), 0)
       - coalesce(sum(l.base_credit) filter (where e.status = 'posted'), 0)
    else coalesce(sum(l.base_credit) filter (where e.status = 'posted'), 0)
       - coalesce(sum(l.base_debit)  filter (where e.status = 'posted'), 0)
  end as balance
from fin_accounts a
left join fin_journal_lines   l on l.account_id = a.id
left join fin_journal_entries e on e.id = l.entry_id
group by a.company_id, a.id, a.code, a.name, a.type, a.normal_balance;

-- Company trial balance: total debits vs total credits across posted lines. difference MUST be 0
-- (the accounting equation). A non-zero difference is a data-integrity alarm, surfaced honestly.
create or replace view fin_trial_balance with (security_invoker = true) as
select
  company_id,
  coalesce(sum(debit_total), 0)  as total_debits,
  coalesce(sum(credit_total), 0) as total_credits,
  coalesce(sum(debit_total), 0) - coalesce(sum(credit_total), 0) as difference
from fin_account_balances
group by company_id;

-- Dashboard summary — ALL money aggregation in SQL (decision #3: never JS money math). Returns a
-- single jsonb the Finance surface renders. security invoker + the security_invoker views mean RLS
-- applies: a caller with no finance access (or another company) sees nothing → zeros, never a leak.
-- "Cash on hand" = balance of asset accounts named cash/bank (a heuristic until an is_cash flag /
-- bank-account model lands in Phase 3 — noted, not hidden).
create or replace function fin_dashboard_summary()
returns jsonb language sql stable security invoker set search_path = public as $$
  with co as (select auth_company_id() as cid)
  select jsonb_build_object(
    'base_currency',     (select base_currency from fin_settings where company_id = (select cid from co)),
    'has_data',          exists(select 1 from fin_journal_entries where company_id = (select cid from co) and status = 'posted'),
    'cash_on_hand',      (select coalesce(sum(balance),0) from fin_account_balances where company_id = (select cid from co) and type = 'asset' and (name ilike '%cash%' or name ilike '%bank%')),
    'total_assets',      (select coalesce(sum(balance),0) from fin_account_balances where company_id = (select cid from co) and type = 'asset'),
    'total_liabilities', (select coalesce(sum(balance),0) from fin_account_balances where company_id = (select cid from co) and type = 'liability'),
    'total_equity',      (select coalesce(sum(balance),0) from fin_account_balances where company_id = (select cid from co) and type = 'equity'),
    'total_revenue',     (select coalesce(sum(balance),0) from fin_account_balances where company_id = (select cid from co) and type = 'revenue'),
    'total_expenses',    (select coalesce(sum(balance),0) from fin_account_balances where company_id = (select cid from co) and type = 'expense'),
    'net_income',        (select coalesce(sum(case when type = 'revenue' then balance else -balance end),0) from fin_account_balances where company_id = (select cid from co) and type in ('revenue','expense')),
    'expense_breakdown', (select coalesce(jsonb_agg(jsonb_build_object('code',code,'name',name,'amount',balance) order by balance desc) filter (where balance <> 0),'[]'::jsonb) from fin_account_balances where company_id = (select cid from co) and type = 'expense'),
    'trial_balance',     (select jsonb_build_object('debits',total_debits,'credits',total_credits,'difference',difference) from fin_trial_balance where company_id = (select cid from co))
  );
$$;
