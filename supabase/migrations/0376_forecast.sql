-- 0376 — the forecast (2026-11-27; revenue Phase 6, docs/ELOSTATE-REVENUE-BUILD-PLAN; Gong M22: F22.1 boards, F22.2
-- submission / metric / target columns, F22.3 submit with a note, F22.5 snapshots, F22.7 accuracy). Re-runnable.
--
-- Plan R12's stand-in: one board per company, by quarter ('YYYY-Qn'). Two submission columns, Commit and Best case;
-- the metric columns (closed won, open pipeline closing in the quarter) are computed from the deals, never stored.
--   · forecast_submissions — a person's number for a quarter and column, with a note and the open deals behind it at
--     that moment (deal id + amount). Append-only: the latest per (person, quarter, column) is their forecast, and every
--     earlier one is the snapshot Gong takes weekly — so accuracy (forecast ÷ actual) needs no cron. A person submits
--     only their own number.
--   · forecast_targets — a quarter's target for a person, set by an admin or Sales Coach manager the tree allows (or
--     for themselves). Append-only; the latest wins.
-- RLS: your own rows, or a manager's over the reps the tree allows; MFA restrictive (0309). No customer words here.

create table if not exists public.forecast_submissions (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id),
  user_id uuid not null references public.profiles(id),
  period text not null check (period ~ '^[0-9]{4}-Q[1-4]$'),
  category text not null check (category in ('commit', 'best_case')),
  amount numeric not null check (amount >= 0 and amount <= 1e12),
  note text check (note is null or length(note) <= 500),
  deals jsonb not null default '[]'::jsonb check (jsonb_typeof(deals) = 'array' and jsonb_array_length(deals) <= 500),
  created_at timestamptz not null default now()
);
create index if not exists forecast_submissions_idx on public.forecast_submissions (company_id, period, user_id, category, id desc);

create table if not exists public.forecast_targets (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id),
  user_id uuid not null references public.profiles(id),
  period text not null check (period ~ '^[0-9]{4}-Q[1-4]$'),
  amount numeric not null check (amount >= 0 and amount <= 1e12),
  set_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists forecast_targets_idx on public.forecast_targets (company_id, period, user_id, id desc);

alter table public.forecast_submissions enable row level security;
alter table public.forecast_targets enable row level security;

drop policy if exists forecast_submissions_select on public.forecast_submissions;
create policy forecast_submissions_select on public.forecast_submissions for select to authenticated
  using (company_id = auth_company_id() and (user_id = auth.uid() or (is_sales_coach_manager() and rss_tree_allows(user_id))));
drop policy if exists forecast_submissions_insert on public.forecast_submissions;
create policy forecast_submissions_insert on public.forecast_submissions for insert to authenticated
  with check (company_id = auth_company_id() and user_id = auth.uid());

drop policy if exists forecast_targets_select on public.forecast_targets;
create policy forecast_targets_select on public.forecast_targets for select to authenticated
  using (company_id = auth_company_id() and (user_id = auth.uid() or (is_sales_coach_manager() and rss_tree_allows(user_id))));
drop policy if exists forecast_targets_insert on public.forecast_targets;
create policy forecast_targets_insert on public.forecast_targets for insert to authenticated
  with check (company_id = auth_company_id() and set_by = auth.uid() and is_sales_coach_manager()
              and (user_id = auth.uid() or rss_tree_allows(user_id))
              and exists (select 1 from profiles p where p.id = forecast_targets.user_id and p.company_id = auth_company_id()));

do $$
declare t text;
begin
  foreach t in array array['forecast_submissions', 'forecast_targets'] loop
    execute format('drop policy if exists mfa_required on public.%I', t);
    execute format('create policy mfa_required on public.%I as restrictive for all to authenticated using ((select public.rss_mfa_ok())) with check ((select public.rss_mfa_ok()))', t);
    execute format('create or replace rule %I as on update to public.%I do instead nothing', t || '_no_update', t);
    execute format('create or replace rule %I as on delete to public.%I do instead nothing', t || '_no_delete', t);
  end loop;
end $$;
