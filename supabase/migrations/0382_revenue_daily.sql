-- 0382 — the nightly revenue job's tables (2026-11-27; revenue plan Phase 3a "nightly" warnings and Phase 4 drivers
-- "now / 30 / 90 days"; Engage plan E5 "close date near" trigger). Re-runnable. Runs only once CRON_SECRET is set
-- (docs/residuals/OPEN.md); until then the job's route answers 503 and these tables stay empty.
--
--   · deal_warning_snapshots — each open deal's warnings on a day, as dealRisk judged them (the one verdict, §2.2),
--     written by the job with the service role only (no insert policy: no person can write a warning). One row per deal
--     per day. Append-only. Holds no customer words (deal id, rep, warning kinds), so erasure keeps it (§3.1.1(3)).
--     Read: your own deals, or a Sales Coach manager / admin over the reps the tree allows.
--   · rss_valid_agent — 0380's rules plus 'close_date_near' with `days` (1–60): fire when an open deal's expected close
--     date is that many days away.
--   · agent_runs.fire_key — what a run fired for (here: the deal and its close date), unique per agent, so a date
--     trigger fires once for a deal's close date however many nights it is seen.

create table if not exists public.deal_warning_snapshots (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id),
  day date not null,
  prospect_id uuid not null references public.remote_prospects(id),
  rep_id uuid not null references public.profiles(id),
  level text not null check (level in ('at_risk', 'watch', 'ok')),
  reasons text[] not null default '{}' check (reasons <@ array[
    'no_next_call', 'missed_next_call', 'gone_quiet', 'overdue_todo', 'cooled', 'past_close_date',
    'ghosted', 'few_contacts', 'no_power', 'no_pricing', 'stalled', 'no_amount']::text[]),
  created_at timestamptz not null default now(),
  constraint deal_warning_snapshots_once unique (prospect_id, day)
);
create index if not exists deal_warning_snapshots_day_idx on public.deal_warning_snapshots (company_id, day);

create or replace rule deal_warning_snapshots_no_update as on update to public.deal_warning_snapshots do instead nothing;
create or replace rule deal_warning_snapshots_no_delete as on delete to public.deal_warning_snapshots do instead nothing;
alter table public.deal_warning_snapshots enable row level security;
drop policy if exists deal_warning_snapshots_select on public.deal_warning_snapshots;
create policy deal_warning_snapshots_select on public.deal_warning_snapshots for select to authenticated
  using (company_id = auth_company_id() and (rep_id = auth.uid() or (is_sales_coach_manager() and rss_tree_allows(rep_id))));
drop policy if exists mfa_required on public.deal_warning_snapshots;
create policy mfa_required on public.deal_warning_snapshots as restrictive for all to authenticated
  using ((select public.rss_mfa_ok())) with check ((select public.rss_mfa_ok()));

create or replace function public.rss_valid_agent(p_trigger jsonb, p_actions jsonb) returns boolean
  language sql immutable as $$
  select jsonb_typeof(p_trigger) = 'object'
     and (
       (coalesce(p_trigger ->> 'kind', '') = 'deal_stage'
        and (p_trigger ->> 'status' is null or p_trigger ->> 'status' in ('open', 'won', 'lost'))
        and (p_trigger ->> 'label' is null or length(btrim(p_trigger ->> 'label')) between 1 and 60)
        and (p_trigger ? 'status' or p_trigger ? 'label'))
       or
       (coalesce(p_trigger ->> 'kind', '') = 'tracker_heard'
        and coalesce(p_trigger ->> 'tracker_id', '') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
       or
       (coalesce(p_trigger ->> 'kind', '') = 'close_date_near'
        -- case, not and: SQL doesn't promise to test the pattern before the cast
        and case when coalesce(p_trigger ->> 'days', '') ~ '^[0-9]{1,2}$' then (p_trigger ->> 'days')::int between 1 and 60 else false end))
     and jsonb_typeof(p_actions) = 'array'
     and jsonb_array_length(p_actions) between 1 and 5
     and not exists (
       select 1 from jsonb_array_elements(p_actions) a
        where jsonb_typeof(a) <> 'object'
           or coalesce(a ->> 'kind', '') not in ('brief', 'notify', 'todo', 'webhook')
           or (a ->> 'kind' = 'notify' and coalesce(a ->> 'to', '') not in ('rep', 'owner'))
           or (a ->> 'kind' = 'todo' and (length(btrim(coalesce(a ->> 'title', ''))) not between 1 and 200
                                          or coalesce(a ->> 'due_days', '0') !~ '^[0-9]{1,3}$')))
$$;

alter table public.agent_runs add column if not exists fire_key text check (fire_key is null or length(fire_key) <= 200);
create unique index if not exists agent_runs_once_per_key on public.agent_runs (agent_id, fire_key)
  where fire_key is not null and not test;
