-- 0136 — Financial System: add AR/AP outstanding to the dashboard summary
--
-- The dashboard showed cash/revenue/expenses/net but not the operational cash pipeline: what
-- customers owe you (AR outstanding) and what you owe vendors (AP outstanding). Both derived in SQL
-- from the 0135 summary views. create-or-replace of fin_dashboard_summary (0121) — additive.

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
    'ar_outstanding',    (select coalesce(sum(total - received),0) from fin_invoice_summary where company_id = (select cid from co) and status = 'sent'),
    'ap_outstanding',    (select coalesce(sum(total - paid),0) from fin_bill_summary where company_id = (select cid from co) and status = 'approved'),
    'expense_breakdown', (select coalesce(jsonb_agg(jsonb_build_object('code',code,'name',name,'amount',balance) order by balance desc) filter (where balance <> 0),'[]'::jsonb) from fin_account_balances where company_id = (select cid from co) and type = 'expense'),
    'trial_balance',     (select jsonb_build_object('debits',total_debits,'credits',total_credits,'difference',difference) from fin_trial_balance where company_id = (select cid from co))
  );
$$;
