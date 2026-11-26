-- 0367 — call categories (2026-11-26; Gong ledger F10.10 / F10.9; founder picker 2026-11-26: "Rep picks at close" from a
-- list the company admin sets — no AI guess). Idempotent (A12).
--
--   call_categories — the company's list ("Discovery", "Demo", "Renewal"). A company admin adds or retires one; a
--     category is never renamed (retire and add), so a call's category always means what it meant when it was picked.
--   call_category_picks — a rep picking (or clearing) the category of one of their phone/video calls. Append-only; the
--     latest pick per call is its category (category_id null = cleared). Read like the call: the rep, or a manager the
--     0273 tree allows; hidden calls left out (0341's rule).
-- Written by /api/coach/remote/call-categories and /api/coach/remote/[id]/category with the service role after their
-- own checks. Category names are a company's labels, no customer data. MFA from the start (0309).

create table if not exists public.call_categories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  name text not null check (length(trim(name)) between 1 and 40),
  created_by uuid not null references public.profiles(id),
  retired_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists call_categories_company_idx on public.call_categories (company_id, created_at);
alter table public.call_categories enable row level security;
drop policy if exists call_categories_select on public.call_categories;
create policy call_categories_select on public.call_categories for select to authenticated using (company_id = auth_company_id());
drop policy if exists mfa_required on public.call_categories;
create policy mfa_required on public.call_categories as restrictive for all to authenticated
  using ((select public.rss_mfa_ok())) with check ((select public.rss_mfa_ok()));
create or replace function public.rss_guard_call_category_update() returns trigger
  language plpgsql set search_path = public as $$
begin
  if (to_jsonb(new) - 'retired_at') is distinct from (to_jsonb(old) - 'retired_at') or old.retired_at is not null then
    raise exception 'RSS: a call category never changes — retire it and add another';
  end if;
  return new;
end $$;
drop trigger if exists rss_guard_call_category_update on public.call_categories;
create trigger rss_guard_call_category_update before update on public.call_categories
  for each row execute function public.rss_guard_call_category_update();
create or replace rule call_categories_no_delete as on delete to public.call_categories do instead nothing;

create table if not exists public.call_category_picks (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id),
  session_id uuid not null references public.coaching_sessions(id) on delete cascade,
  rep_id uuid not null references public.profiles(id),
  category_id uuid references public.call_categories(id),
  picked_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists call_category_picks_session_idx on public.call_category_picks (session_id, id desc);
create index if not exists call_category_picks_company_idx on public.call_category_picks (company_id, id);
alter table public.call_category_picks enable row level security;
drop policy if exists call_category_picks_select on public.call_category_picks;
create policy call_category_picks_select on public.call_category_picks for select to authenticated
  using (company_id = auth_company_id() and (rep_id = auth.uid() or (is_sales_coach_manager() and rss_tree_allows(rep_id))));
drop policy if exists rss_not_hidden on public.call_category_picks;
create policy rss_not_hidden on public.call_category_picks as restrictive for select to authenticated
  using (session_id is null or session_id not in (select public.rss_hidden_calls_for_me()));
drop policy if exists mfa_required on public.call_category_picks;
create policy mfa_required on public.call_category_picks as restrictive for all to authenticated
  using ((select public.rss_mfa_ok())) with check ((select public.rss_mfa_ok()));
create or replace rule call_category_picks_no_update as on update to public.call_category_picks do instead nothing;
create or replace rule call_category_picks_no_delete as on delete to public.call_category_picks do instead nothing;
