-- 0394 — deal splits (2026-11-28; revenue plan phase 10; Gong F20.12; founder picker "Deal splits"; decides R9).
-- Re-runnable.
--
-- deal_splits: a deal's revenue shared between people of the company, as whole percents. Append-only; the latest row
-- per deal is its split (deal_splits_current). One entry — the deal's rep at 100 — is "no split". Attribution only: who
-- can SEE a deal is still the rep's tree (remote_prospects' RLS); rep_id stays the deal's owner for access, agents and
-- notifications. No customer words (ids and numbers).
--
-- Checked in the database (rss_check_deal_split), not trusted to the route: 1–5 entries, whole percents 1–100 summing
-- to 100, no one twice, everyone a person of the deal's company, the deal's rep always one of them.
-- Who sets it (RLS): the deal's rep, or a Sales Coach manager the tree allows over that rep. Who reads it: whoever can
-- see the deal.

create table if not exists public.deal_splits (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id),
  prospect_id uuid not null references public.remote_prospects(id),
  shares jsonb not null check (jsonb_typeof(shares) = 'array' and jsonb_array_length(shares) between 1 and 5),
  set_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists deal_splits_prospect_idx on public.deal_splits (prospect_id, id desc);

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
    if not exists (select 1 from profiles pr where pr.id = u and pr.company_id = new.company_id) then
      raise exception 'deal split: everyone must be in the deal''s company' using errcode = '23514';
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
drop trigger if exists rss_check_deal_split on public.deal_splits;
create trigger rss_check_deal_split before insert on public.deal_splits for each row execute function public.rss_check_deal_split();

create or replace rule deal_splits_no_update as on update to public.deal_splits do instead nothing;
create or replace rule deal_splits_no_delete as on delete to public.deal_splits do instead nothing;

alter table public.deal_splits enable row level security;
drop policy if exists deal_splits_select on public.deal_splits;
create policy deal_splits_select on public.deal_splits for select to authenticated
  using (company_id = auth_company_id() and exists (select 1 from remote_prospects p where p.id = deal_splits.prospect_id));
drop policy if exists deal_splits_insert on public.deal_splits;
create policy deal_splits_insert on public.deal_splits for insert to authenticated
  with check (company_id = auth_company_id() and set_by = auth.uid()
              and exists (select 1 from remote_prospects p
                           where p.id = deal_splits.prospect_id and p.company_id = auth_company_id()
                             and (p.rep_id = auth.uid() or (is_sales_coach_manager() and rss_tree_allows(p.rep_id)))));
drop policy if exists mfa_required on public.deal_splits;
create policy mfa_required on public.deal_splits as restrictive for all to authenticated
  using ((select public.rss_mfa_ok())) with check ((select public.rss_mfa_ok()));

create or replace view public.deal_splits_current with (security_invoker = true) as
select distinct on (s.prospect_id) s.id, s.company_id, s.prospect_id, s.shares, s.set_by, s.created_at
from deal_splits s order by s.prospect_id, s.id desc;
grant select on public.deal_splits_current to authenticated, service_role;
