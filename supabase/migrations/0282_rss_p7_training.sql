-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 0282 — RSS Phase 7: training (scaffold 0277_rss_p7_training.sql, renumbered; Gong F17.3, F17.10, F17.11)
-- ═════════════════════════════════════════════════════════════════════════════════════════════
--
--   training_scenarios — a stored practice scenario a manager writes (optionally from a real call): who the prospect
--     is, the situation, the channel, the ONE skill being practised (the existing focus-scored role-play scores it),
--     difficulty, length, an optional pass mark. Never edited; retired once (retired_at) — attempts keep meaning.
--   training_assignments — a scenario given to a rep with a due date.
--   training_due_changes — a manager moving a due date is a row, not an edit (§3.1); current due = latest row.
--   training_attempts — each scored practice of an assignment, written by the role-play route from ITS OWN score
--     (never a client-sent number), with passed computed against the scenario's mark at the time.
--
-- D9 (voice role-play; rubric scoring of practice) is NOT DECIDED and nothing here assumes either: attempts carry the
-- existing 0-100 focus score. D18 (where the screens live) does not touch the schema.
--
-- DIFFERENCES FROM THE SCAFFOLD: channel uses the app's context words ('in_person','video','phone') — the scaffold's
-- 'door' matches no column the app writes; `focus` added (the role-play scores against one skill); no client write
-- policies (routes write after their own checks); the update policy that let a manager edit an assignment in place
-- is replaced by training_due_changes. Read rules: scenarios company-wide; assignments/attempts the rep's own or a
-- manager under the 0273 tree. Idempotent (A12).
-- ═════════════════════════════════════════════════════════════════════════════════════════════

do $$
begin
  if not exists (select 1 from pg_proc where proname = 'rss_tree_allows') then
    raise exception 'RSS preflight: rss_tree_allows() not found — apply 0273 first';
  end if;
end $$;

create table if not exists public.training_scenarios (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  title text not null check (length(trim(title)) between 1 and 120),
  persona text not null check (length(trim(persona)) between 1 and 200),
  situation text not null check (length(trim(situation)) between 1 and 600),
  focus text not null check (length(trim(focus)) between 1 and 600),
  channel text not null check (channel in ('in_person', 'video', 'phone')),
  difficulty text not null check (difficulty in ('easy', 'intermediate', 'advanced')),
  length_min smallint not null check (length_min between 2 and 30),
  pass_score smallint check (pass_score between 0 and 100),
  source_session_id uuid references public.coaching_sessions(id) on delete set null,
  created_by uuid not null references public.profiles(id),
  retired_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists training_scenarios_company_idx on public.training_scenarios (company_id, created_at desc);
alter table public.training_scenarios enable row level security;
drop policy if exists rss_scen_select on public.training_scenarios;
create policy rss_scen_select on public.training_scenarios for select to authenticated using (company_id = auth_company_id());
create or replace function public.rss_guard_scenario_update() returns trigger
  language plpgsql set search_path = public as $$
begin
  if (to_jsonb(new) - 'retired_at') is distinct from (to_jsonb(old) - 'retired_at') or old.retired_at is not null then
    raise exception 'RSS: a scenario never changes — retire it and write a new one';
  end if;
  return new;
end $$;
drop trigger if exists rss_guard_scenario_update on public.training_scenarios;
create trigger rss_guard_scenario_update before update on public.training_scenarios
  for each row execute function public.rss_guard_scenario_update();
create or replace rule training_scenarios_no_delete as on delete to public.training_scenarios do instead nothing;

create table if not exists public.training_assignments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  scenario_id uuid not null references public.training_scenarios(id),
  rep_id uuid not null references public.profiles(id),
  assigned_by uuid not null references public.profiles(id),
  due_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint training_assignments_once unique (scenario_id, rep_id)
);
create index if not exists training_assignments_rep_idx on public.training_assignments (rep_id, due_at);
alter table public.training_assignments enable row level security;
drop policy if exists rss_assign_select on public.training_assignments;
create policy rss_assign_select on public.training_assignments for select to authenticated
  using (company_id = auth_company_id() and (rep_id = auth.uid() or (is_sales_coach_manager() and rss_tree_allows(rep_id))));
create or replace rule training_assignments_no_update as on update to public.training_assignments do instead nothing;
create or replace rule training_assignments_no_delete as on delete to public.training_assignments do instead nothing;

create table if not exists public.training_due_changes (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id),
  assignment_id uuid not null references public.training_assignments(id),
  due_at timestamptz not null,
  changed_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists training_due_changes_assignment_idx on public.training_due_changes (assignment_id, id);
alter table public.training_due_changes enable row level security;
drop policy if exists rss_due_select on public.training_due_changes;
create policy rss_due_select on public.training_due_changes for select to authenticated
  using (company_id = auth_company_id() and exists (select 1 from training_assignments a where a.id = training_due_changes.assignment_id));
create or replace rule training_due_changes_no_update as on update to public.training_due_changes do instead nothing;
create or replace rule training_due_changes_no_delete as on delete to public.training_due_changes do instead nothing;

create table if not exists public.training_attempts (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id),
  assignment_id uuid not null references public.training_assignments(id),
  rep_id uuid not null references public.profiles(id),
  score smallint not null check (score between 0 and 100),
  applied boolean not null,
  passed boolean,  -- null: the scenario has no pass mark
  created_at timestamptz not null default now()
);
create index if not exists training_attempts_assignment_idx on public.training_attempts (assignment_id, created_at);
alter table public.training_attempts enable row level security;
drop policy if exists rss_attempts_select on public.training_attempts;
create policy rss_attempts_select on public.training_attempts for select to authenticated
  using (company_id = auth_company_id() and (rep_id = auth.uid() or (is_sales_coach_manager() and rss_tree_allows(rep_id))));
create or replace rule training_attempts_no_update as on update to public.training_attempts do instead nothing;
create or replace rule training_attempts_no_delete as on delete to public.training_attempts do instead nothing;
