-- 0002 — Understanding Gate
--
-- Encodes CLAUDE.md Rule 3.2 in the schema:
--   "A `problem` may NOT be surfaced to users until it links to a minimum threshold
--    of supporting `signals`. The schema itself must prevent half-understood problems
--    from reaching a human."
--
-- The gate is enforced by a trigger, not by application code, so it cannot be bypassed
-- by a confident agent under pressure. Application code may attempt to surface a
-- problem; the database refuses if the gate is not satisfied.
--
-- Tables:
--   signals            — append-only observations (Rule 3.1 immutability enforced by rules)
--   problems           — diagnostic hypotheses; status gated by trigger
--   problem_signals    — append-only linkage between problems and the signals that support them
--   problem_thresholds — per-kind override of the gate thresholds; defaults below

-- ─────────────────────────────────────────────────────────────
-- signals: append-only observation log
-- ─────────────────────────────────────────────────────────────

create table if not exists signals (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  kind        text not null,           -- e.g. 'task_blocked', 'meeting_overran', 'comment_unanswered'
  source      text not null,           -- e.g. 'task:<uuid>', 'meeting:<uuid>', 'user:<uuid>'
  payload     jsonb,
  observed_at timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

create index if not exists signals_company_observed_idx
  on signals (company_id, observed_at desc);

-- Append-only: block UPDATE and DELETE at the SQL layer.
create or replace rule signals_no_update as
  on update to signals do instead nothing;
create or replace rule signals_no_delete as
  on delete to signals do instead nothing;

-- ─────────────────────────────────────────────────────────────
-- problems: diagnostic hypotheses, status-gated
-- ─────────────────────────────────────────────────────────────
--
-- Status lifecycle:
--   draft        — being assembled. Visible to internal tooling only. The default.
--   surfaceable  — gate passed. May be shown to a human.
--   surfaced     — has been shown to a human (timestamped).
--   resolved     — closed; resolution recorded.
--   dismissed    — explicitly rejected (with reason). Asset for retrospective learning.

create table if not exists problems (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references companies(id) on delete cascade,
  kind         text not null,                          -- groups problems for threshold lookup
  title        text not null,
  diagnosis    text,                                   -- WHY (Rule 2). Optional in draft.
  status       text not null default 'draft'
               check (status in ('draft','surfaceable','surfaced','resolved','dismissed')),
  surfaced_at  timestamptz,
  resolved_at  timestamptz,
  dismissed_at timestamptz,
  dismissal_reason text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists problems_company_status_idx
  on problems (company_id, status);

-- ─────────────────────────────────────────────────────────────
-- problem_signals: append-only linkage
-- ─────────────────────────────────────────────────────────────

create table if not exists problem_signals (
  problem_id  uuid not null references problems(id) on delete cascade,
  signal_id   uuid not null references signals(id)  on delete restrict,
  weight      numeric not null default 1.0,
  created_at  timestamptz not null default now(),
  primary key (problem_id, signal_id)
);

create or replace rule problem_signals_no_update as
  on update to problem_signals do instead nothing;
create or replace rule problem_signals_no_delete as
  on delete to problem_signals do instead nothing;

-- ─────────────────────────────────────────────────────────────
-- problem_thresholds: per-kind tuning of the gate
-- ─────────────────────────────────────────────────────────────
--
-- Defaults are deliberately strict. Tune per-kind once the kind has been observed
-- enough times to justify a looser or tighter gate.

create table if not exists problem_thresholds (
  kind                 text primary key,
  min_signals          int not null default 3,
  min_distinct_sources int not null default 2,
  min_diagnosis_chars  int not null default 80,
  notes                text,
  updated_at           timestamptz not null default now()
);

-- Global default row keyed as '*'. Looked up when a kind-specific row is absent.
insert into problem_thresholds (kind, min_signals, min_distinct_sources, min_diagnosis_chars, notes)
  values ('*', 3, 2, 80,
    'Default Understanding Gate. Override per-kind by inserting another row with the kind name.')
  on conflict (kind) do nothing;

-- ─────────────────────────────────────────────────────────────
-- The Understanding Gate itself: a trigger that refuses to let a problem
-- transition out of 'draft' unless thresholds are met.
-- ─────────────────────────────────────────────────────────────

create or replace function check_understanding_gate()
returns trigger
language plpgsql
as $$
declare
  signal_count int;
  source_count int;
  threshold    record;
  is_surfacing boolean;
begin
  -- Only check when leaving 'draft'.
  is_surfacing := (TG_OP = 'INSERT' and NEW.status <> 'draft')
               or (TG_OP = 'UPDATE' and OLD.status = 'draft' and NEW.status <> 'draft');

  if not is_surfacing then
    return NEW;
  end if;

  -- Dismissal is allowed without meeting the gate: explicitly rejecting a draft
  -- without enough evidence is correct behavior, not a violation.
  if NEW.status = 'dismissed' then
    return NEW;
  end if;

  -- Find the threshold for this kind, falling back to the '*' default.
  select min_signals, min_distinct_sources, min_diagnosis_chars
    into threshold
    from problem_thresholds
    where kind = NEW.kind;

  if not found then
    select min_signals, min_distinct_sources, min_diagnosis_chars
      into threshold
      from problem_thresholds
      where kind = '*';
  end if;

  -- Count supporting signals.
  select count(*)::int, count(distinct s.source)::int
    into signal_count, source_count
    from problem_signals ps
    join signals s on s.id = ps.signal_id
    where ps.problem_id = NEW.id;

  if signal_count < threshold.min_signals then
    raise exception
      'Understanding Gate: problem % (kind=%) needs >=% signals, has %',
      NEW.id, NEW.kind, threshold.min_signals, signal_count
      using errcode = 'check_violation';
  end if;

  if source_count < threshold.min_distinct_sources then
    raise exception
      'Understanding Gate: problem % (kind=%) needs >=% distinct sources, has %',
      NEW.id, NEW.kind, threshold.min_distinct_sources, source_count
      using errcode = 'check_violation';
  end if;

  if coalesce(length(NEW.diagnosis), 0) < threshold.min_diagnosis_chars then
    raise exception
      'Understanding Gate: problem % (kind=%) needs a diagnosis of >=% chars, has %',
      NEW.id, NEW.kind, threshold.min_diagnosis_chars, coalesce(length(NEW.diagnosis), 0)
      using errcode = 'check_violation';
  end if;

  -- Stamp surfaced_at when transitioning to 'surfaced'.
  if NEW.status = 'surfaced' and NEW.surfaced_at is null then
    NEW.surfaced_at := now();
  end if;

  NEW.updated_at := now();
  return NEW;
end;
$$;

drop trigger if exists problems_understanding_gate on problems;
create trigger problems_understanding_gate
  before insert or update on problems
  for each row execute function check_understanding_gate();

-- ─────────────────────────────────────────────────────────────
-- Row-level security (per-company isolation, same pattern as 0001)
-- ─────────────────────────────────────────────────────────────

alter table signals            enable row level security;
alter table problems           enable row level security;
alter table problem_signals    enable row level security;
alter table problem_thresholds enable row level security;

do $$
declare t text;
begin
  foreach t in array array['signals','problems'] loop
    execute format(
      'create policy "%1$s - all" on %1$s for all
         using (company_id = auth_company_id())
         with check (company_id = auth_company_id());', t);
  end loop;
end $$;

-- problem_signals: scope through the parent problem.
create policy "problem_signals - all" on problem_signals
  for all
  using (
    exists (
      select 1 from problems p
      where p.id = problem_signals.problem_id
        and p.company_id = auth_company_id()
    )
  )
  with check (
    exists (
      select 1 from problems p
      where p.id = problem_signals.problem_id
        and p.company_id = auth_company_id()
    )
  );

-- problem_thresholds: read-only for any authenticated member. Modification is
-- intentionally not exposed via RLS; tuning thresholds is an operator-level decision
-- (Rule 5: builder under pressure must not be able to silently loosen the gate from
-- inside the application).
create policy "problem_thresholds - select" on problem_thresholds
  for select using (auth.uid() is not null);
