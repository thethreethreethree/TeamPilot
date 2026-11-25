-- 0345 — hide by phrase (F33.8), fixes from the 26 Nov review.
--
-- 1. rss_hidden_calls_for_me() scanned every company's hides on every signed-in read (and asked rss_call_hidden_for
--    for each). The answer can only ever be the caller's own company's calls, so it is now filtered to
--    auth_company_id() first — same result, cost per company instead of per platform.
-- 2. Dispute events (subject 'pitch:<pitch id>', the rep's note in the payload) about a hidden call were still
--    readable through events' company-wide rule; rss_hidden_subjects_for_me() now also returns 'pitch:<id>' for the
--    hidden calls' pitches. The events policy (0341) reads this set, so it needs no change.
-- 3. rss_hidden_calls_for(p_company, p_viewer): the same set for a service-role route acting for a named viewer, in
--    ONE call (hiddenInCompanyFrom made one RPC per hidden call). The verdict per call is still rss_call_hidden_for.

create or replace function public.rss_hidden_calls_for_me() returns setof uuid
  language sql stable security definer set search_path = public as $$
  select distinct h.session_id from call_hides h
  where h.company_id = auth_company_id()
    and not exists (select 1 from call_unhides u where u.hide_id = h.id)
    and rss_call_hidden_for(h.session_id, auth.uid())
$$;

create or replace function public.rss_hidden_subjects_for_me() returns setof text
  language sql stable security definer set search_path = public as $$
  select 'sales_session:' || s::text from public.rss_hidden_calls_for_me() s
  union all
  select 'pitch:' || p::text from public.rss_hidden_pitches_for_me() p
$$;

create or replace function public.rss_hidden_calls_for(p_company uuid, p_viewer uuid) returns setof uuid
  language sql stable security definer set search_path = public as $$
  select distinct h.session_id from call_hides h
  where h.company_id = p_company
    and not exists (select 1 from call_unhides u where u.hide_id = h.id)
    and rss_call_hidden_for(h.session_id, p_viewer)
$$;
revoke all on function public.rss_hidden_calls_for(uuid, uuid) from public, anon, authenticated;
grant execute on function public.rss_hidden_calls_for(uuid, uuid) to service_role;
