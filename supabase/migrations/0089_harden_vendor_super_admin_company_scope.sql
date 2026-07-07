-- 0089_harden_vendor_super_admin_company_scope.sql
--
-- SECURITY (audit 2026-07-07, CRITICAL) — scope is_vendor_super_admin() to the
-- VENDOR company, closing a cross-tenant authorization hole.
--
-- The 0049 function gates every crm_* RLS policy (the vendor's cross-customer
-- back-office: all companies, their contact PII, subscriptions, MRR, invoices).
-- Its own comment (0049:565-570) says access should require role IN
-- (CEO/COO/admin) "AND their company being the ELOSTATE company itself" — but
-- the SQL only ever checked the role:
--
--     select exists (select 1 from profiles p
--        where p.id = auth.uid() and p.role in ('CEO','COO','admin'));
--
-- So ANY customer company's admin satisfied it. Combined with the API routes
-- (which used the service-role client — bypassing this RLS — and gated only on
-- the same per-company isAdmin), any customer admin could read + mutate the
-- entire vendor CRM. The primary fix is at the route layer (requireVendorAdmin
-- gates on company === vendor company); THIS migration closes the same gap in
-- the DB's own defense-in-depth layer so any FUTURE user-client access to crm_*
-- is also correctly restricted.
--
-- The vendor company id is hardcoded to match the application constant
-- (care/config.ts ELOSTATE_COMPANY_ID / vendorAuth.getVendorCompanyId). If a
-- deployment overrides its home company via CARE_DEFAULT_TENANT_ID, update the
-- literal below to that company's id (the route layer already respects the env;
-- this literal is the DB-side mirror).
--
-- Idempotent (create or replace). Forward-only, strictly TIGHTENS access — it
-- can only remove authorization, never grant it — so there is no data-exposure
-- risk in applying it, and a mis-set id fails CLOSED (locks out, does not open).

create or replace function is_vendor_super_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from profiles p
    where p.id = auth.uid()
      and p.role in ('CEO', 'COO', 'admin')
      -- The missing predicate: the caller's company must BE the vendor company.
      and p.company_id = 'c3e7f389-3df6-48c8-876b-0cd4baf5c2a7'::uuid
  );
$$;
