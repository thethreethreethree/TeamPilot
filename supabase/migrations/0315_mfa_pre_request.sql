-- 0315 — multi-factor sign-in reaches owner-rights database functions too (2026-11-23; closes the MFA build's R2 /
-- docs/residuals/OPEN.md "128 SECURITY DEFINER functions callable by authenticated are outside the database rule").
--
-- 0309 put a RESTRICTIVE mfa_required policy on every table, but a SECURITY DEFINER function runs as its owner, so RLS —
-- and that policy — does not apply inside it. Production (read 2026-11-23): 128 such functions executable by
-- `authenticated`; 46 are trigger functions (not callable), 14 are policy helpers; the other 68 are callable over the
-- REST API — 60 of them finance (fin_pay_bill, fin_post_entry, fin_close_period, …). A password alone could call them.
--
-- Rather than edit 68 bodies, PostgREST's pre-request hook runs ONE function before every API request. It refuses a
-- call to /rpc/* when the signed token says the person turned codes on and this session has not passed one — the same
-- rss_mfa_ok() as 0309, so the two can't drift (§2.2). Tables keep 0309's policy (0 rows, no error), so a held session
-- still renders the code screen. Anyone without codes, signed-out visitors and the service role are unaffected
-- (rss_mfa_ok() is true for them).
--
-- The hook also sets a harmless response header (x-rss-guard: 1), so it can be PROVEN running from outside — a live
-- invariant (scripts/verify-invariants-live.mjs) checks the role setting, and an HTTP check reads the header.
-- Re-runnable.

create or replace function public.rss_pre_request() returns void
  language plpgsql volatile
  set search_path = ''
as $$
begin
  perform set_config('response.headers', '[{"x-rss-guard": "1"}]', true);
  -- Only a signed-in user's call to a function is judged. anon and the service role never evaluate the rule, so no
  -- permission or claim oddity there can ever refuse a request (the hook runs before EVERY API request).
  if coalesce(current_setting('request.path', true), '') like '/rpc/%'
     and current_user = 'authenticated'
     and not public.rss_mfa_ok() then
    raise exception 'Enter the code from your authenticator app to continue.'
      using errcode = '42501', hint = 'mfa_required';
  end if;
end $$;
comment on function public.rss_pre_request() is
  'PostgREST pre-request hook (0315): refuses /rpc/* for a session that must pass a sign-in code first (rss_mfa_ok).';
revoke all on function public.rss_pre_request() from public;
grant execute on function public.rss_pre_request() to anon, authenticated, service_role;

alter role authenticator set pgrst.db_pre_request to 'public.rss_pre_request';
notify pgrst, 'reload config';
