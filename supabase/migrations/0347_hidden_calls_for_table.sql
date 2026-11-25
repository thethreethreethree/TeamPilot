-- 0347 — rss_hidden_calls_for returns a named column, so a paged read can order it (review sweep 2026-11-26).
-- 0345 returned `setof uuid`; the service-role route pages it with OFFSET, and an unordered set paged by offset can
-- repeat or skip rows between pages. As a table with a `session_id` column the route orders by it, a unique key here
-- (the function returns distinct ids). Same verdict per call (rss_call_hidden_for). Changing a return type needs a drop.
drop function if exists public.rss_hidden_calls_for(uuid, uuid);
create function public.rss_hidden_calls_for(p_company uuid, p_viewer uuid) returns table (session_id uuid)
  language sql stable security definer set search_path = public as $$
  select distinct h.session_id from call_hides h
  where h.company_id = p_company
    and not exists (select 1 from call_unhides u where u.hide_id = h.id)
    and rss_call_hidden_for(h.session_id, p_viewer)
$$;
revoke all on function public.rss_hidden_calls_for(uuid, uuid) from public, anon, authenticated;
grant execute on function public.rss_hidden_calls_for(uuid, uuid) to service_role;
