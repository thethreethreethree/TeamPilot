-- 0395 — deal splits: co-owners read their deals; the split check refuses other companies first (2026-11-28; review of
-- 7734b6c5; founder picker "Co-owners see deals they co-own"). Re-runnable.
--
--   · rss_check_deal_split (0394's, two changes): a signed-in caller's row for another company is refused before
--     anything is read, so its messages never describe another company's deals or people; a removed member can't be
--     named.
--   · rss_co_owned_deals(user) / rss_is_co_owner(user, deal): the deals whose CURRENT split names a person (their own
--     company only). Service role only: the server uses them to let a co-owner open their deals read only. No table
--     rule is widened — every write still goes through the deal's own rules, which don't know co-owners — and the
--     access ends when the latest split stops naming them.

create or replace function public.rss_check_deal_split() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  rep uuid;
  total integer := 0;
  n integer := 0;
  users uuid[] := '{}';
  e jsonb;
  u uuid;
  pct integer;
begin
  -- A signed-in caller may only write their own company's split, refused BEFORE anything is read (review 2026-11-28:
  -- this trigger runs ahead of the insert policy with definer rights, so its messages must not describe another
  -- company's deals or people). The service role (current_user not authenticated/anon) passes.
  if current_user in ('authenticated', 'anon') and new.company_id is distinct from auth_company_id() then
    raise exception 'deal split: not your company' using errcode = '42501';
  end if;
  select p.rep_id into rep from remote_prospects p where p.id = new.prospect_id and p.company_id = new.company_id;
  if rep is null then
    raise exception 'deal split: the deal is not in this company' using errcode = '23514';
  end if;
  for e in select * from jsonb_array_elements(new.shares) loop
    if jsonb_typeof(e) <> 'object' or coalesce(e ->> 'user_id', '') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       or coalesce(e ->> 'pct', '') !~ '^[0-9]{1,3}$' then
      raise exception 'deal split: each share is {user_id, pct}' using errcode = '23514';
    end if;
    u := (e ->> 'user_id')::uuid;
    pct := (e ->> 'pct')::integer;
    if pct < 1 or pct > 100 then
      raise exception 'deal split: a share is 1 to 100 percent' using errcode = '23514';
    end if;
    if u = any (users) then
      raise exception 'deal split: a person appears twice' using errcode = '23514';
    end if;
    if not exists (select 1 from profiles pr where pr.id = u and pr.company_id = new.company_id and coalesce(pr.status, 'active') <> 'removed') then
      raise exception 'deal split: everyone must be a current member of the deal''s company' using errcode = '23514';
    end if;
    users := users || u;
    total := total + pct;
    n := n + 1;
  end loop;
  if total <> 100 then
    raise exception 'deal split: shares must add up to 100' using errcode = '23514';
  end if;
  if not (rep = any (users)) then
    raise exception 'deal split: the deal''s rep is always one of the owners' using errcode = '23514';
  end if;
  return new;
end $$;

create or replace function public.rss_co_owned_deals(p_user uuid) returns setof uuid
  language sql stable security definer set search_path = public as $$
  select cur.prospect_id
    from (select distinct on (s.prospect_id) s.prospect_id, s.company_id, s.shares
            from deal_splits s order by s.prospect_id, s.id desc) cur
    join profiles me on me.id = p_user and me.company_id = cur.company_id and coalesce(me.status, 'active') <> 'removed'
   where cur.shares @> jsonb_build_array(jsonb_build_object('user_id', p_user::text))
$$;
revoke all on function public.rss_co_owned_deals(uuid) from public, anon, authenticated;
grant execute on function public.rss_co_owned_deals(uuid) to service_role;

create or replace function public.rss_is_co_owner(p_user uuid, p_prospect uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.rss_co_owned_deals(p_user) d where d = p_prospect)
$$;
revoke all on function public.rss_is_co_owner(uuid, uuid) from public, anon, authenticated;
grant execute on function public.rss_is_co_owner(uuid, uuid) to service_role;
