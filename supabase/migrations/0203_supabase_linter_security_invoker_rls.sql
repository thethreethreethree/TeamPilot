-- 0203 — Supabase linter remediation (founder-surfaced 2026-07-30). Two ERROR-level findings:
--
-- (A) SECURITY DEFINER VIEWS (14 finance views). A view without `security_invoker` enforces the VIEW
--     OWNER's permissions + RLS, not the querying user's — so a per-company reporting view queried through
--     the user client could return OTHER tenants' rows, bypassing the underlying tables' RLS. Cross-tenant
--     leak risk (the exact class the finance RLS exists to prevent).
--
--     These views' CURRENT migration definitions DO set `with (security_invoker = true)` — but the LIVE
--     prod views don't have it (the option was retrofitted into the files after the originals were already
--     applied; CREATE OR REPLACE on an existing view does not re-run for an applied migration). So set it
--     EXPLICITLY + idempotently here on the live objects. security_invoker=true is what the definitions
--     already intend, so this changes behavior only in the correct direction (own-company scoping); the
--     dashboard queries these per-company through the user client, and any system/cron reader uses the
--     service role which bypasses RLS regardless.
--
-- (B) _agent_migrations (the automated-migration ledger) is in the public schema without RLS. Enable RLS
--     deny-all (no policies) — only the service-role / owner db-apply connection touches it (it bypasses
--     RLS), and the app never queries it. Same RLS-sealed pattern as pilot_codes (0197).

do $$
declare v text;
begin
  foreach v in array array[
    'fin_dunning_worklist','fin_payments_due','fin_card_positions','fin_cash_accounts',
    'fin_cash_flow','fin_cash_flow_summary','fin_kpis','fin_asset_register',
    'fin_opening_summary','fin_opening_imbalance','fin_1099_payments','fin_1099_worksheet',
    'fin_report_schedules_due','fin_report_delivery_failures'
  ] loop
    if exists (select 1 from pg_views where schemaname = 'public' and viewname = v) then
      execute format('alter view public.%I set (security_invoker = on)', v);
    end if;
  end loop;
end $$;

alter table if exists public._agent_migrations enable row level security;
