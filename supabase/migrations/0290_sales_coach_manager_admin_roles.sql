-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 0290 — is_sales_coach_manager() uses the one admin-role list (0265), so a CFO counts as the app says
-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 0265 (FOUNDER RULING 2026-09-22) made admin_roles() the one list — ['CEO','CFO','COO','admin'], mirroring
-- ADMIN_ROLES in src/lib/roles.ts — and rewrote the 47 POLICIES that carried a copy. This FUNCTION (0252) carried the
-- same old copy, without CFO, and was not swept because it is not a policy. So isSalesCoachManager (TS) says a CFO is a
-- manager, every manager screen renders for them, and every RLS policy calling this function (0252-0284: pitch scores,
-- overrides, patterns, comments, shares, trackers, coaching, library, follow-through, training, trims) hands them
-- nothing — the confident-empty failure 0265 was written to end.
--
-- Also excludes removed people (status <> 'removed'), as 0272's rss_is_manager / rss_is_company_admin do; the app
-- already refuses them a session (resolveApiAuth), so this narrows only a stale token. Idempotent (A12).
-- INVARIANT 39 now fails any SQL function or policy whose latest definition writes the admin-role list out by hand.
-- ═════════════════════════════════════════════════════════════════════════════════════════════

create or replace function is_sales_coach_manager()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from profiles p
    where p.id = auth.uid()
      and p.status <> 'removed'
      and (p.role = any (admin_roles()) or p.sales_coach_role = 'admin')
  );
$$;
