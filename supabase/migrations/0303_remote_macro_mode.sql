-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 0303 — Remote Sales Macro Mode: the simplified remote sales system (docs/rss/MACRO-MODE-SPEC.md, founder 2026-11-22)
-- ═════════════════════════════════════════════════════════════════════════════════════════════
--
-- Five facts the simplified system needs that nothing stores today:
--   1. profiles.remote_macro_mode_enabled — the rep's own switch, separate from Sales Coach's (0219).
--   2. remote_call_briefs — one read of a call per transcript version: key points, next steps and the Next Meeting
--      agenda / key points / checklist. Stored once so the page shows the same read and the AI is not re-billed.
--   3. remote_checklist_reviews — the Next Meeting checklist "must be reviewed": which items the rep kept (each kept
--      item becomes a Task with its due date, so reminders live in the one Tasks module).
--   4. The pipeline: remote_prospects (who), remote_prospect_events (stage / amount / next call / name — every change
--      is a new row, §3.1; the current value is the latest), remote_prospect_calls (which calls belong to whom; the
--      last call date is derived from them, never typed), remote_prospect_tasks (the prospect's to-dos, as Tasks).
--   5. remote_followup_drafts and remote_day_plans — the follow-up email/text drafts and the daily brain dump.
--
-- Every table is append-only (no UPDATE/DELETE rules). Reads: the rep's own rows, or a manager under 0273's tree.
-- Writes go through the CALLER's client: a rep may insert only rows that are theirs (rep_id = auth.uid()), and a
-- prospect event only on a prospect they may see. AI reads (briefs) are written by the service role after the
-- route's own checks, like session_follow_through (0281). Idempotent (A12).
-- ═════════════════════════════════════════════════════════════════════════════════════════════

do $$
begin
  if not exists (select 1 from pg_proc where proname = 'rss_tree_allows') then
    raise exception 'Macro Mode preflight: rss_tree_allows() not found — apply 0273 first';
  end if;
end $$;

-- 1. The switch ------------------------------------------------------------------------------------------------
alter table public.profiles add column if not exists remote_macro_mode_enabled boolean not null default false;

-- 2. Call briefs -----------------------------------------------------------------------------------------------
create table if not exists public.remote_call_briefs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.coaching_sessions(id) on delete cascade,
  company_id uuid not null references public.companies(id),
  rep_id uuid not null references public.profiles(id),
  transcript_version integer not null,
  -- [{ text, seq }] — each point cites the line it rests on (seq), checked against the transcript before storing.
  key_points jsonb not null default '[]'::jsonb,
  -- [{ text, seq }]
  next_steps jsonb not null default '[]'::jsonb,
  -- { agenda: [{ text }], bring_up: [{ text, seq }], checklist: [{ text, due: 'YYYY-MM-DD' | null }] }
  next_meeting jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint remote_call_briefs_once unique (session_id, transcript_version)
);
alter table public.remote_call_briefs enable row level security;
drop policy if exists rmm_briefs_select on public.remote_call_briefs;
create policy rmm_briefs_select on public.remote_call_briefs for select to authenticated
  using (company_id = auth_company_id() and (rep_id = auth.uid() or (is_sales_coach_manager() and rss_tree_allows(rep_id))));
create or replace rule remote_call_briefs_no_update as on update to public.remote_call_briefs do instead nothing;
create or replace rule remote_call_briefs_no_delete as on delete to public.remote_call_briefs do instead nothing;

-- 3. Checklist reviews -----------------------------------------------------------------------------------------
create table if not exists public.remote_checklist_reviews (
  id bigint generated always as identity primary key,
  brief_id uuid not null references public.remote_call_briefs(id),
  company_id uuid not null references public.companies(id),
  reviewed_by uuid not null references public.profiles(id),
  -- [{ text, due, task_id }] — what the rep kept (edited text allowed) and the Task each became.
  kept jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.remote_checklist_reviews enable row level security;
drop policy if exists rmm_reviews_select on public.remote_checklist_reviews;
create policy rmm_reviews_select on public.remote_checklist_reviews for select to authenticated
  using (company_id = auth_company_id()
         and exists (select 1 from remote_call_briefs b where b.id = remote_checklist_reviews.brief_id)); -- b's own RLS
drop policy if exists rmm_reviews_insert on public.remote_checklist_reviews;
create policy rmm_reviews_insert on public.remote_checklist_reviews for insert to authenticated
  with check (company_id = auth_company_id() and reviewed_by = auth.uid()
              and exists (select 1 from remote_call_briefs b where b.id = remote_checklist_reviews.brief_id));
create or replace rule remote_checklist_reviews_no_update as on update to public.remote_checklist_reviews do instead nothing;
create or replace rule remote_checklist_reviews_no_delete as on delete to public.remote_checklist_reviews do instead nothing;

-- 4. Pipeline --------------------------------------------------------------------------------------------------
create table if not exists public.remote_prospects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  rep_id uuid not null references public.profiles(id),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists remote_prospects_rep_idx on public.remote_prospects (company_id, rep_id);
alter table public.remote_prospects enable row level security;
drop policy if exists rmm_prospects_select on public.remote_prospects;
create policy rmm_prospects_select on public.remote_prospects for select to authenticated
  using (company_id = auth_company_id() and (rep_id = auth.uid() or (is_sales_coach_manager() and rss_tree_allows(rep_id))));
drop policy if exists rmm_prospects_insert on public.remote_prospects;
create policy rmm_prospects_insert on public.remote_prospects for insert to authenticated
  with check (company_id = auth_company_id() and rep_id = auth.uid() and created_by = auth.uid());
create or replace rule remote_prospects_no_update as on update to public.remote_prospects do instead nothing;
create or replace rule remote_prospects_no_delete as on delete to public.remote_prospects do instead nothing;

create table if not exists public.remote_prospect_events (
  id bigint generated always as identity primary key,
  prospect_id uuid not null references public.remote_prospects(id),
  company_id uuid not null references public.companies(id),
  kind text not null check (kind in ('name', 'organization', 'stage', 'amount', 'next_call')),
  -- name/organization: text · stage: open|won|lost (+ optional label) · amount: number ≥ 0 · next_call: ISO date or null
  value jsonb not null,
  actor_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint remote_prospect_events_stage check (
    kind <> 'stage' or (value ->> 'status') in ('open', 'won', 'lost')),
  constraint remote_prospect_events_amount check (
    kind <> 'amount' or (jsonb_typeof(value -> 'amount') = 'number' and (value ->> 'amount')::numeric >= 0))
);
create index if not exists remote_prospect_events_idx on public.remote_prospect_events (prospect_id, kind, id desc);
alter table public.remote_prospect_events enable row level security;
drop policy if exists rmm_pevents_select on public.remote_prospect_events;
create policy rmm_pevents_select on public.remote_prospect_events for select to authenticated
  using (company_id = auth_company_id()
         and exists (select 1 from remote_prospects p where p.id = remote_prospect_events.prospect_id));
drop policy if exists rmm_pevents_insert on public.remote_prospect_events;
create policy rmm_pevents_insert on public.remote_prospect_events for insert to authenticated
  with check (company_id = auth_company_id() and actor_id = auth.uid()
              and exists (select 1 from remote_prospects p where p.id = remote_prospect_events.prospect_id
                                                          and p.company_id = auth_company_id()));
create or replace rule remote_prospect_events_no_update as on update to public.remote_prospect_events do instead nothing;
create or replace rule remote_prospect_events_no_delete as on delete to public.remote_prospect_events do instead nothing;

create table if not exists public.remote_prospect_calls (
  id bigint generated always as identity primary key,
  prospect_id uuid not null references public.remote_prospects(id),
  session_id uuid not null references public.coaching_sessions(id) on delete cascade,
  company_id uuid not null references public.companies(id),
  linked_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint remote_prospect_calls_once unique (session_id)
);
create index if not exists remote_prospect_calls_idx on public.remote_prospect_calls (prospect_id);
alter table public.remote_prospect_calls enable row level security;
drop policy if exists rmm_pcalls_select on public.remote_prospect_calls;
create policy rmm_pcalls_select on public.remote_prospect_calls for select to authenticated
  using (company_id = auth_company_id()
         and exists (select 1 from remote_prospects p where p.id = remote_prospect_calls.prospect_id));
drop policy if exists rmm_pcalls_insert on public.remote_prospect_calls;
create policy rmm_pcalls_insert on public.remote_prospect_calls for insert to authenticated
  with check (company_id = auth_company_id() and linked_by = auth.uid()
              and exists (select 1 from remote_prospects p where p.id = remote_prospect_calls.prospect_id)
              -- The caller must be able to SEE the call (coaching_sessions' own RLS: owner or manager), so a rep cannot
              -- attach a peer's call to their prospect by guessing its id.
              and exists (select 1 from coaching_sessions s where s.id = remote_prospect_calls.session_id
                                                             and s.company_id = auth_company_id()));
create or replace rule remote_prospect_calls_no_update as on update to public.remote_prospect_calls do instead nothing;
create or replace rule remote_prospect_calls_no_delete as on delete to public.remote_prospect_calls do instead nothing;

create table if not exists public.remote_prospect_tasks (
  id bigint generated always as identity primary key,
  prospect_id uuid not null references public.remote_prospects(id),
  task_id uuid not null references public.tasks(id) on delete cascade,
  company_id uuid not null references public.companies(id),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint remote_prospect_tasks_once unique (task_id)
);
create index if not exists remote_prospect_tasks_idx on public.remote_prospect_tasks (prospect_id);
alter table public.remote_prospect_tasks enable row level security;
drop policy if exists rmm_ptasks_select on public.remote_prospect_tasks;
create policy rmm_ptasks_select on public.remote_prospect_tasks for select to authenticated
  using (company_id = auth_company_id()
         and exists (select 1 from remote_prospects p where p.id = remote_prospect_tasks.prospect_id));
drop policy if exists rmm_ptasks_insert on public.remote_prospect_tasks;
create policy rmm_ptasks_insert on public.remote_prospect_tasks for insert to authenticated
  with check (company_id = auth_company_id() and created_by = auth.uid()
              and exists (select 1 from remote_prospects p where p.id = remote_prospect_tasks.prospect_id)
              and exists (select 1 from tasks t where t.id = remote_prospect_tasks.task_id and t.company_id = auth_company_id()));
create or replace rule remote_prospect_tasks_no_update as on update to public.remote_prospect_tasks do instead nothing;
create or replace rule remote_prospect_tasks_no_delete as on delete to public.remote_prospect_tasks do instead nothing;

-- The current state of each prospect, derived from its events (§3.1) — never stored. security_invoker: the caller's
-- RLS on every table applies.
create or replace view public.remote_prospects_current with (security_invoker = true) as
select
  p.id, p.company_id, p.rep_id, p.created_at,
  (select e.value ->> 'text' from remote_prospect_events e where e.prospect_id = p.id and e.kind = 'name' order by e.id desc limit 1) as name,
  (select e.value ->> 'text' from remote_prospect_events e where e.prospect_id = p.id and e.kind = 'organization' order by e.id desc limit 1) as organization,
  coalesce((select e.value ->> 'status' from remote_prospect_events e where e.prospect_id = p.id and e.kind = 'stage' order by e.id desc limit 1), 'open') as status,
  (select e.value ->> 'label' from remote_prospect_events e where e.prospect_id = p.id and e.kind = 'stage' order by e.id desc limit 1) as stage_label,
  (select (e.value ->> 'amount')::numeric from remote_prospect_events e where e.prospect_id = p.id and e.kind = 'amount' order by e.id desc limit 1) as amount,
  (select e.value ->> 'date' from remote_prospect_events e where e.prospect_id = p.id and e.kind = 'next_call' order by e.id desc limit 1) as next_call_date,
  (select max(s.started_at) from remote_prospect_calls c join coaching_sessions s on s.id = c.session_id where c.prospect_id = p.id) as last_call_at,
  (select count(*) from remote_prospect_calls c where c.prospect_id = p.id) as call_count
from remote_prospects p;
grant select on public.remote_prospects_current to authenticated, service_role;

-- 5. Follow-up drafts and the daily brain dump ------------------------------------------------------------------
create table if not exists public.remote_followup_drafts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.coaching_sessions(id) on delete cascade,
  company_id uuid not null references public.companies(id),
  rep_id uuid not null references public.profiles(id),
  created_by uuid not null references public.profiles(id),
  channel text not null check (channel in ('email', 'text')),
  subject text,
  body text not null check (length(body) between 1 and 6000),
  created_at timestamptz not null default now()
);
create index if not exists remote_followup_drafts_idx on public.remote_followup_drafts (session_id, created_at desc);
alter table public.remote_followup_drafts enable row level security;
drop policy if exists rmm_drafts_select on public.remote_followup_drafts;
create policy rmm_drafts_select on public.remote_followup_drafts for select to authenticated
  using (company_id = auth_company_id() and (rep_id = auth.uid() or (is_sales_coach_manager() and rss_tree_allows(rep_id))));
create or replace rule remote_followup_drafts_no_update as on update to public.remote_followup_drafts do instead nothing;
create or replace rule remote_followup_drafts_no_delete as on delete to public.remote_followup_drafts do instead nothing;

create table if not exists public.remote_day_plans (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id),
  rep_id uuid not null references public.profiles(id),
  day date not null,
  dump text not null check (length(dump) between 1 and 4000),
  -- { items: [{ time: 'HH:MM' | null, what }], needle_movers: [string, string] } — the rep's own words, organised.
  plan jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists remote_day_plans_idx on public.remote_day_plans (rep_id, day, id desc);
alter table public.remote_day_plans enable row level security;
-- The brain dump is the rep's own planning: not a manager's to read (A10 — no shadow read).
drop policy if exists rmm_days_select on public.remote_day_plans;
create policy rmm_days_select on public.remote_day_plans for select to authenticated
  using (company_id = auth_company_id() and rep_id = auth.uid());
drop policy if exists rmm_days_insert on public.remote_day_plans;
create policy rmm_days_insert on public.remote_day_plans for insert to authenticated
  with check (company_id = auth_company_id() and rep_id = auth.uid());
create or replace rule remote_day_plans_no_update as on update to public.remote_day_plans do instead nothing;
create or replace rule remote_day_plans_no_delete as on delete to public.remote_day_plans do instead nothing;
