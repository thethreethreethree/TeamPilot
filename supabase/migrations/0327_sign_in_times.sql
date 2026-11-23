-- 0327 — sign-in times for the team usage view, whatever the sign-in method (2026-11-23; OPEN.md usage "sign-ins via
-- Google/Microsoft or the mobile app aren't counted … email lookup is one call per person").
--
-- The usage view counted only login_attempts — the web password form's own log. A sign-in through Google, Microsoft or
-- the mobile app never reaches that form. Supabase's auth.sessions has a row for every sign-in whatever the method, but
-- a row is removed when the person signs out. So both are read and the usage code counts a sign-in recorded in both
-- (within two minutes) once (usage.ts mergeSignIns): a lower bound, never an inflated one. Measured 2026-11-23 (30
-- days): auth.sessions 5 sign-ins (3 people), login_attempts 2; auth.audit_log_entries is empty in this project.
--
-- Matched by user id inside the database (login_attempts by the account's email), so the route no longer looks up each
-- person's email. Only people of p_company; service role only. Re-runnable.

create or replace function public.rss_sign_in_times(p_company uuid, p_users uuid[], p_since timestamptz)
returns table (user_id uuid, at timestamptz, source text)
  language sql stable security definer set search_path = public, auth as $$
  select s.user_id, s.created_at, 'session'::text
  from auth.sessions s
  join public.profiles p on p.id = s.user_id and p.company_id = p_company
  where s.user_id = any (p_users) and s.created_at >= p_since
  union all
  select u.id, la.created_at, 'password'::text
  from public.login_attempts la
  join auth.users u on lower(u.email) = la.email
  join public.profiles p on p.id = u.id and p.company_id = p_company
  where u.id = any (p_users) and la.succeeded and la.created_at >= p_since
$$;

revoke all on function public.rss_sign_in_times(uuid, uuid[], timestamptz) from public, anon, authenticated;
grant execute on function public.rss_sign_in_times(uuid, uuid[], timestamptz) to service_role;
