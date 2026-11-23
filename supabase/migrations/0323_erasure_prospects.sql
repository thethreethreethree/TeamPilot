-- 0323 — legal erasure reaches pipeline prospects not linked to an erased call (2026-11-23; CLAUDE.md §3.1.1, AMD-014;
-- OPEN.md "a pipeline prospect never linked to a call keeps its name/organization after the customer is erased").
--
-- 0316 renames a prospect only when one of the erased CALLS is linked to it. A prospect added from the pipeline and
-- never linked keeps the customer's name and organization. Two functions, called only by the same erasure route for the
-- same request (after the day plans, 0322, before rss_erase_sessions):
--   · rss_erasure_prospect_matches — prospects whose current name or organization contains the identifier (the same
--     pattern as day plans, rss_erasure_text_pattern). Prospects are the company's pipeline (managers read them), so the
--     admin sees the name to confirm it is the right customer.
--   · rss_erase_prospects — exactly 0316's prospect step: the name and organization events are deleted and the prospect
--     is renamed "(erased on request)"; the Tasks its to-dos created are blanked. Stage, amount and dates stay (§3.1.1(3)).
--     With no calls and no plans, it records the request's completion. Service role only. Re-runnable.

create or replace function public.rss_erasure_prospect_matches(p_company uuid, p_kind text, p_value text)
returns table (prospect_id uuid, rep_id uuid, name text, organization text)
  language plpgsql stable security definer set search_path = public as $$
declare
  pat text := public.rss_erasure_text_pattern(p_kind, p_value);
begin
  return query
    select p.id, p.rep_id, p.name, p.organization
    from remote_prospects_current p
    where p.company_id = p_company
      and (coalesce(p.name, '') ~* pat or coalesce(p.organization, '') ~* pat)
    order by p.created_at desc
    limit 200;
end $$;

create or replace function public.rss_erase_prospects(p_company uuid, p_request uuid, p_prospects uuid[], p_kind text, p_value text, p_by uuid, p_complete boolean)
returns integer
  language plpgsql security definer set search_path = public as $$
declare
  pat text := public.rss_erasure_text_pattern(p_kind, p_value);
  ids uuid[];
  task_ids uuid[];
begin
  if not exists (select 1 from erasure_requests q where q.id = p_request and q.company_id = p_company) then
    raise exception 'RSS erasure: request not found for this company';
  end if;
  if exists (select 1 from erasure_completions e where e.request_id = p_request) then
    raise exception 'RSS erasure: this request has already been carried out';
  end if;
  -- Only prospects that still match: an id the search did not return is never touched.
  select coalesce(array_agg(p.id), '{}') into ids
    from remote_prospects_current p
   where p.company_id = p_company and p.id = any (coalesce(p_prospects, '{}'))
     and (coalesce(p.name, '') ~* pat or coalesce(p.organization, '') ~* pat);
  select coalesce(array_agg(t.task_id), '{}') into task_ids from remote_prospect_tasks t where t.prospect_id = any (ids);
  perform set_config('rss.erasure', 'on', true);
  update tasks set title = 'To-do (details erased on request)', description = null where id = any (task_ids);
  delete from remote_prospect_events where prospect_id = any (ids) and kind in ('name', 'organization');
  insert into remote_prospect_events (prospect_id, company_id, kind, value, actor_id)
    select p, p_company, 'name', jsonb_build_object('text', '(erased on request)'), p_by from unnest(ids) p;
  if p_complete then
    insert into erasure_completions (request_id, company_id, sessions_erased, erased_by) values (p_request, p_company, 0, p_by);
  end if;
  perform set_config('rss.erasure', 'off', true);
  return cardinality(ids);
end $$;

revoke all on function public.rss_erasure_prospect_matches(uuid, text, text) from public, anon, authenticated;
revoke all on function public.rss_erase_prospects(uuid, uuid, uuid[], text, text, uuid, boolean) from public, anon, authenticated;
grant execute on function public.rss_erasure_prospect_matches(uuid, text, text) to service_role;
grant execute on function public.rss_erase_prospects(uuid, uuid, uuid[], text, text, uuid, boolean) to service_role;
