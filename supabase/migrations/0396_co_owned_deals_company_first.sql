-- 0396 — rss_co_owned_deals reads only the person's own company (2026-11-28; review of 19cf1412). Re-runnable.
--
-- 0395's version took every company's latest split before matching the person. Same answer, now narrowed to the
-- person's company BEFORE "latest per deal" is chosen — never by the containment test, which would pick an older split
-- that still names them. Service role only, as before.

create or replace function public.rss_co_owned_deals(p_user uuid) returns setof uuid
  language sql stable security definer set search_path = public as $$
  select cur.prospect_id
    from profiles me
    join lateral (
      select distinct on (s.prospect_id) s.prospect_id, s.shares
        from deal_splits s
       where s.company_id = me.company_id
       order by s.prospect_id, s.id desc
    ) cur on true
   where me.id = p_user and coalesce(me.status, 'active') <> 'removed'
     and cur.shares @> jsonb_build_array(jsonb_build_object('user_id', p_user::text))
$$;
revoke all on function public.rss_co_owned_deals(uuid) from public, anon, authenticated;
grant execute on function public.rss_co_owned_deals(uuid) to service_role;
