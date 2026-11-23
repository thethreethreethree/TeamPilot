-- 0322 — legal erasure reaches reps' day plans (2026-11-23; CLAUDE.md §3.1.1, AMD-014; OPEN.md "a rep's daily brain
-- dump (remote_day_plans) may name a customer but has no call key, so erasure can't find it").
--
-- A day plan ("Call Betty Ross at 3, she wants the bundle") can name a customer and is tied to no call, so
-- rss_erase_sessions (call-keyed) never reached it. Two functions, called only by the same erasure route, for the same
-- erasure request, before rss_erase_sessions:
--   · rss_erasure_day_plan_matches — which plans mention the identifier, matched the way rss_erasure_matches matches
--     calls (phone: its digits; email: the address; client name: the name). Returns the plan, rep and day only — the
--     plan is the rep's own (0303: no manager read, A10), so the admin sees THAT a plan mentions the customer, never
--     its words.
--   · rss_erase_day_plans — replaces the identifier inside those plans (the dump and the organised plan) with
--     "[removed]"; the rest of the rep's plan stays (§3.1.1(2): that customer's data and nothing else). When the
--     customer is on no call, it records the request's completion itself (rss_erase_sessions does when there are calls).
-- remote_day_plans' append-only rules become erasure-aware with 0285's exact pattern. Service role only. Re-runnable.

create or replace rule remote_day_plans_no_update as on update to public.remote_day_plans
  where coalesce(current_setting('rss.erasure', true), '') <> 'on' do instead nothing;
create or replace rule remote_day_plans_no_delete as on delete to public.remote_day_plans
  where coalesce(current_setting('rss.erasure', true), '') <> 'on' do instead nothing;

-- The pattern that finds the identifier inside free text, per kind (shared by both functions so they cannot drift).
create or replace function public.rss_erasure_text_pattern(p_kind text, p_value text)
returns text language plpgsql immutable set search_path = public as $$
declare
  digits text := regexp_replace(coalesce(p_value, ''), '\D', '', 'g');
  needle text;
begin
  if p_kind = 'phone' then
    if length(digits) < 7 then raise exception 'RSS erasure: a phone number needs at least 7 digits'; end if;
    needle := case when length(digits) > 10 then right(digits, 10) else digits end;
    -- the digits in order, allowing up to three separators between them ("(555) 010-0123", "555.010.0123")
    return array_to_string(regexp_split_to_array(needle, ''), '[^0-9A-Za-z]{0,3}');
  elsif p_kind in ('email', 'client_label') then
    if length(trim(coalesce(p_value, ''))) < 2 then raise exception 'RSS erasure: identifier too short'; end if;
    -- the literal, regex-escaped
    return regexp_replace(trim(p_value), '([\.\^\$\*\+\?\(\)\[\]\{\}\|\\\-])', '\\\1', 'g');
  end if;
  raise exception 'RSS erasure: unknown match kind %', p_kind;
end $$;

create or replace function public.rss_erasure_day_plan_matches(p_company uuid, p_kind text, p_value text)
returns table (plan_id bigint, rep_id uuid, day date)
  language plpgsql stable security definer set search_path = public as $$
declare
  pat text := public.rss_erasure_text_pattern(p_kind, p_value);
begin
  return query
    select d.id, d.rep_id, d.day
    from remote_day_plans d
    where d.company_id = p_company
      and (d.dump ~* pat or d.plan::text ~* pat)
    order by d.day desc, d.id desc
    limit 200;
end $$;

create or replace function public.rss_erase_day_plans(p_company uuid, p_request uuid, p_plans bigint[], p_kind text, p_value text, p_by uuid, p_complete boolean)
returns integer
  language plpgsql security definer set search_path = public as $$
declare
  pat text := public.rss_erasure_text_pattern(p_kind, p_value);
  r record;
  new_plan jsonb;
  n integer := 0;
begin
  if not exists (select 1 from erasure_requests q where q.id = p_request and q.company_id = p_company) then
    raise exception 'RSS erasure: request not found for this company';
  end if;
  if exists (select 1 from erasure_completions e where e.request_id = p_request) then
    raise exception 'RSS erasure: this request has already been carried out';
  end if;
  perform set_config('rss.erasure', 'on', true);
  for r in select d.id, d.dump, d.plan from remote_day_plans d
           where d.company_id = p_company and d.id = any (coalesce(p_plans, '{}'))
             and (d.dump ~* pat or d.plan::text ~* pat)
  loop
    begin
      new_plan := regexp_replace(r.plan::text, pat, '[removed]', 'gi')::jsonb;
    exception when others then
      new_plan := '{}'::jsonb; -- the organised plan could not be kept safely; the rep's own words (dump) remain
    end;
    update remote_day_plans set dump = regexp_replace(r.dump, pat, '[removed]', 'gi'), plan = new_plan where id = r.id;
    n := n + 1;
  end loop;
  if p_complete then
    insert into erasure_completions (request_id, company_id, sessions_erased, erased_by) values (p_request, p_company, 0, p_by);
  end if;
  perform set_config('rss.erasure', 'off', true);
  return n;
end $$;

revoke all on function public.rss_erasure_text_pattern(text, text) from public, anon, authenticated;
revoke all on function public.rss_erasure_day_plan_matches(uuid, text, text) from public, anon, authenticated;
revoke all on function public.rss_erase_day_plans(uuid, uuid, bigint[], text, text, uuid, boolean) from public, anon, authenticated;
grant execute on function public.rss_erasure_text_pattern(text, text) to service_role;
grant execute on function public.rss_erasure_day_plan_matches(uuid, text, text) to service_role;
grant execute on function public.rss_erase_day_plans(uuid, uuid, bigint[], text, text, uuid, boolean) to service_role;
