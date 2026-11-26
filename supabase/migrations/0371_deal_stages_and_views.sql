-- 0371 — a company's deal stages and each person's saved deal-board views (2026-11-27; revenue Phase 2,
-- docs/ELOSTATE-REVENUE-BUILD-PLAN; Gong F20.1 boards: tabs, filters, columns; F20.13 recipes). Re-runnable.
--
--   · deal_stage_lists — the company's ordered stages, each one open / won / lost. The WHOLE list is one row; the latest
--     row is the list (§3.1: a change is a new row, the history stays). Set by a company admin or Sales Coach manager
--     (is_sales_coach_manager, the leads check every manager surface uses). A deal's stage stays its stage event's
--     label (0303): the list names and orders them, so every reader of stage_label keeps working; a label that is not in
--     the list is shown as it is, never rewritten.
--   · deal_board_views — a person's saved filters on the deal board, by name; the latest row per (person, name) wins and
--     removed=true takes it off. Each person sees and writes only their own.
-- RLS: company; MFA restrictive (0309); append-only (no update/delete rules, nothing here is personal data of a customer).

create or replace function public.rss_valid_stage_list(p jsonb) returns boolean
  language sql immutable as $$
  select jsonb_typeof(p) = 'array'
     and jsonb_array_length(p) between 1 and 20
     and not exists (
       select 1 from jsonb_array_elements(p) s
        where jsonb_typeof(s) <> 'object'
           or jsonb_typeof(s -> 'name') <> 'string'
           or length(btrim(s ->> 'name')) not between 1 and 60
           or coalesce(s ->> 'kind', '') not in ('open', 'won', 'lost'))
     -- one name once (case and edge spaces ignored), and at least one open stage
     and (select count(distinct lower(btrim(s ->> 'name'))) from jsonb_array_elements(p) s) = jsonb_array_length(p)
     and exists (select 1 from jsonb_array_elements(p) s where s ->> 'kind' = 'open')
$$;

create table if not exists public.deal_stage_lists (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id),
  stages jsonb not null check (public.rss_valid_stage_list(stages)),
  actor_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists deal_stage_lists_idx on public.deal_stage_lists (company_id, id desc);

create table if not exists public.deal_board_views (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id),
  user_id uuid not null references public.profiles(id),
  name text not null check (length(btrim(name)) between 1 and 40),
  filters jsonb not null default '{}'::jsonb check (jsonb_typeof(filters) = 'object' and length(filters::text) <= 2000),
  removed boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists deal_board_views_idx on public.deal_board_views (user_id, name, id desc);

alter table public.deal_stage_lists enable row level security;
alter table public.deal_board_views enable row level security;

drop policy if exists deal_stage_lists_select on public.deal_stage_lists;
create policy deal_stage_lists_select on public.deal_stage_lists for select to authenticated
  using (company_id = auth_company_id());
drop policy if exists deal_stage_lists_insert on public.deal_stage_lists;
create policy deal_stage_lists_insert on public.deal_stage_lists for insert to authenticated
  with check (company_id = auth_company_id() and actor_id = auth.uid() and is_sales_coach_manager());

drop policy if exists deal_board_views_select on public.deal_board_views;
create policy deal_board_views_select on public.deal_board_views for select to authenticated
  using (company_id = auth_company_id() and user_id = auth.uid());
drop policy if exists deal_board_views_insert on public.deal_board_views;
create policy deal_board_views_insert on public.deal_board_views for insert to authenticated
  with check (company_id = auth_company_id() and user_id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['deal_stage_lists', 'deal_board_views'] loop
    execute format('drop policy if exists mfa_required on public.%I', t);
    execute format('create policy mfa_required on public.%I as restrictive for all to authenticated using ((select public.rss_mfa_ok())) with check ((select public.rss_mfa_ok()))', t);
    execute format('create or replace rule %I as on update to public.%I do instead nothing', t || '_no_update', t);
    execute format('create or replace rule %I as on delete to public.%I do instead nothing', t || '_no_delete', t);
  end loop;
end $$;

-- Current state (security_invoker, A30).
create or replace view public.deal_stage_list_current with (security_invoker = true) as
select distinct on (l.company_id) l.company_id, l.stages, l.actor_id, l.created_at
from deal_stage_lists l order by l.company_id, l.id desc;
grant select on public.deal_stage_list_current to authenticated, service_role;

create or replace view public.deal_board_views_current with (security_invoker = true) as
select v.* from (
  select distinct on (b.user_id, lower(btrim(b.name))) b.id, b.company_id, b.user_id, btrim(b.name) as name, b.filters, b.removed, b.created_at
  from deal_board_views b order by b.user_id, lower(btrim(b.name)), b.id desc
) v where not v.removed;
grant select on public.deal_board_views_current to authenticated, service_role;
