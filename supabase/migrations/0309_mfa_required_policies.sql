-- 0309 — multi-factor sign-in, enforced in the database too (2026-11-23).
--
-- The app guards pages and every /api route in middleware (src/lib/auth/mfa.ts). But the browser holds its own access
-- token and can call Supabase's REST API directly, past our server: a password alone would mint an aal1 token that RLS
-- happily accepts. So every table that GRANTS access through RLS gets one RESTRICTIVE policy (AND-ed with the existing
-- permissive ones): if the signed token says the person turned MFA on (`app_metadata.mfa`, written only by the service
-- role), the session must have passed a code (`aal` = 'aal2'). People without MFA are unaffected.
--
-- Scope: public tables with RLS on and at least one PERMISSIVE policy (a table with none is already deny-all — e.g.
-- pilot_codes, whose zero-policy seal is a live invariant), plus storage.objects (recordings and files). Reads only the
-- JWT — no lookup per row — wrapped in (select …) so Postgres evaluates it once per statement. Re-runnable.
-- A live invariant (scripts/verify-invariants-live.mjs) fails if a future table that grants access lacks this policy.

create or replace function public.rss_mfa_ok() returns boolean
language sql stable
set search_path = ''
as $$
  select coalesce((select auth.jwt()) -> 'app_metadata' ->> 'mfa', 'false') <> 'true'
      or coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2'
$$;
comment on function public.rss_mfa_ok() is
  'True unless the caller turned on multi-factor sign-in (app_metadata.mfa) and this session has not passed a code (aal2). 0309.';
grant execute on function public.rss_mfa_ok() to authenticated, anon, service_role;

do $$
declare t record;
begin
  for t in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
    where c.relkind in ('r', 'p') and c.relrowsecurity
      and exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname and p.permissive = 'PERMISSIVE')
  loop
    execute format('drop policy if exists mfa_required on public.%I', t.relname);
    execute format(
      'create policy mfa_required on public.%I as restrictive for all to authenticated using ((select public.rss_mfa_ok())) with check ((select public.rss_mfa_ok()))',
      t.relname);
  end loop;
end $$;

drop policy if exists mfa_required on storage.objects;
create policy mfa_required on storage.objects as restrictive for all to authenticated
  using ((select public.rss_mfa_ok())) with check ((select public.rss_mfa_ok()));
