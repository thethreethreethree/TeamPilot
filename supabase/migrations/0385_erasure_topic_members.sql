-- 0385 — legal erasure reaches topic-group members (2026-11-27; OPEN.md 2026-11-23 "legal erasure does not reach
-- topic-group members"). Re-runnable.
--
-- A Market topic group (0319) lists topic wordings taken from the company's calls. A wording that appears ONLY on the
-- calls being erased is stored text derived from that customer, which §3.1.1(2) says erasure removes; the founder's
-- erasure rule for retyped text (0366, picker 2026-11-26) is "blank the text", so it becomes '[erased]' and the group
-- keeps its other members (and its name, unless every member is erased). Which members qualify is decided by the erasure
-- route with Market's own topic matching (market.ts topicKey — §2.2: one matcher, not a SQL copy) over the company's
-- calls, before rss_erase_sessions deletes the erased calls' events. Called only by that route, for the same request,
-- before rss_erase_sessions (it never completes the request). market_topic_groups' update rule yields to erasure with
-- 0285's exact pattern; delete stays refused.

create or replace rule market_topic_groups_no_update as on update to public.market_topic_groups
  where coalesce(current_setting('rss.erasure', true), '') <> 'on' do instead nothing;

create or replace function public.rss_erase_topic_members(p_company uuid, p_request uuid, p_groups uuid[], p_members text[])
returns integer
  language plpgsql security definer set search_path = public as $$
declare
  n integer;
begin
  if not exists (select 1 from erasure_requests q where q.id = p_request and q.company_id = p_company) then
    raise exception 'RSS erasure: request not found for this company';
  end if;
  if exists (select 1 from erasure_completions e where e.request_id = p_request) then
    raise exception 'RSS erasure: this request has already been carried out';
  end if;
  perform set_config('rss.erasure', 'on', true);
  update market_topic_groups g
     set members = (select array_agg(case when u.m = any (p_members) then '[erased]' else u.m end order by u.ord)
                      from unnest(g.members) with ordinality u(m, ord)),
         name = case when g.members <@ (coalesce(p_members, '{}') || array['[erased]']) then '[erased]' else g.name end
   where g.company_id = p_company and g.id = any (coalesce(p_groups, '{}')) and g.members && coalesce(p_members, '{}');
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.rss_erase_topic_members(uuid, uuid, uuid[], text[]) from public, anon, authenticated;
grant execute on function public.rss_erase_topic_members(uuid, uuid, uuid[], text[]) to service_role;
