-- 0206 — Sales Coach quota target (KPI Layer-1 Quota Attainment). Founder-confirmed 2026-07-30: quota is a
-- MONTHLY DEALS-WON target per rep, company-wide (the same standard for every rep in the company).
--
-- Quota attainment = deals won this calendar month ÷ target × 100. NULL = not set (the metric reads
-- "building — set a target" until a manager configures it, so nothing is fabricated). Additive + safe.
-- A company admin / sales-coach admin sets it (same authz as the other company-level settings).

alter table if exists public.companies
  add column if not exists sales_coach_monthly_deal_target integer
    check (sales_coach_monthly_deal_target is null or sales_coach_monthly_deal_target > 0);

comment on column public.companies.sales_coach_monthly_deal_target is
  'Sales Coach KPI: monthly deals-won target per rep (company-wide). NULL = not set → Quota Attainment reads "building". Set by a manager in Sales Coach settings.';
