-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 0287 — who is keeping a company's reporting tree off (RSS, follow-up to 0273)
-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 0273's rss_tree_active turns the reporting tree on for a company only when EVERY Sales Coach rep ('staff', not
-- removed) has a manager. Until then managers keep the company-wide view — 0273's deliberate stand-in. But nothing told
-- an admin WHO is holding it off: one unmanaged person (even a CEO marked as a Sales Coach rep) did it silently.
--
-- rss_tree_blockers returns those people, and rss_tree_active is redefined ON it, so the Team page's list and the
-- policies' verdict are one rule and cannot drift (§2.2). Same truth table as 0273: active = at least one rep, and no
-- blockers. Service role only, like rss_tree_active. Idempotent (A12).
-- ═════════════════════════════════════════════════════════════════════════════════════════════

create or replace function public.rss_tree_blockers(company uuid) returns setof uuid
  language sql stable security definer set search_path = public as $$
  select p.id from profiles p
  where p.company_id = company and p.status <> 'removed' and p.sales_coach_role = 'staff' and p.manager_id is null
$$;
revoke all on function public.rss_tree_blockers(uuid) from public, anon, authenticated;
grant execute on function public.rss_tree_blockers(uuid) to service_role;

create or replace function public.rss_tree_active(company uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
           select 1 from profiles p
           where p.company_id = company and p.status <> 'removed' and p.sales_coach_role = 'staff'
         )
     and not exists (select 1 from public.rss_tree_blockers(company))
$$;
