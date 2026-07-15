-- 0185 — fin_dashboard_summary.ar_outstanding must net issued CREDIT NOTES.
--
-- Diagnosis (§2 diagnose-before-patch; §1.5 holistic — a new feature that missed a derived consumer)
-- ─────────────────────────────────────────────────────────────────────────────────────────────────
-- Credit notes (0143) reduce what a customer owes: issuing one credits AR (GL) and 0143 added a
-- `credited` column to fin_invoice_summary precisely so outstanding = total − received − credited.
-- 0143 correctly updated fin_ar_aging AND the fin_kpis ar_outstanding to subtract issued credit
-- notes. But it MISSED this function: fin_dashboard_summary (0121/0136) still computes
--     ar_outstanding = sum(total − received)   -- ignores the `credited` column
-- So the Command Center finance dashboard OVERSTATES "AR outstanding" by the sum of issued credit
-- notes. The GL AR balance is correctly reduced by the credit note (0143 Cr AR), so the dashboard
-- figure no longer ties to the GL — an accounting-integrity gap: a credited invoice keeps showing
-- as fully owed on the headline number leadership reads.
--
-- Evidence it's the outlier (verified this session): fin_ar_aging (0143:156-160), fin_kpis
-- (0165:74-79), and the invoice list (fin_invoice_summary exposes `credited`) all net credit notes;
-- only this function does not. AP is unaffected — there is no vendor credit-note feature
-- (fin_bill_summary has no `credited` column), so ap_outstanding = total − paid stays correct.
--
-- Fix (§A26 — mirror the authoritative formula the other AR views already use)
-- ─────────────────────────────────────────────────────────────────────────────
-- create-or-replace the function (0136 is applied; its file is immutable). ONLY the ar_outstanding
-- expression changes: sum(total − received) → sum(total − received − credited). Every other key is
-- reproduced byte-for-byte from 0136. `credited` is present since 0143 (applied), so this is safe.
-- UNAPPLIED — founder applies; after applying, the dashboard AR ties to the GL AR balance again.

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
    -- FIX: net issued credit notes (the `credited` column 0143 added) so this ties to GL AR.
    'ar_outstanding',    (select coalesce(sum(total - received - credited),0) from fin_invoice_summary where company_id = (select cid from co) and status = 'sent'),
    'ap_outstanding',    (select coalesce(sum(total - paid),0) from fin_bill_summary where company_id = (select cid from co) and status = 'approved'),
    'expense_breakdown', (select coalesce(jsonb_agg(jsonb_build_object('code',code,'name',name,'amount',balance) order by balance desc) filter (where balance <> 0),'[]'::jsonb) from fin_account_balances where company_id = (select cid from co) and type = 'expense'),
    'trial_balance',     (select jsonb_build_object('debits',total_debits,'credits',total_credits,'difference',difference) from fin_trial_balance where company_id = (select cid from co))
  );
$$;
