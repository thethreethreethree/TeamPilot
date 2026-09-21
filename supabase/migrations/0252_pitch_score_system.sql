-- 0252 — Pitch Score system, Project 1 storage (2026-09-19 coaching build)
--
-- Source: docs/SYSTEM UPDATES AND REVISION 09-22-2026/ — "EloState Coaching Build Plan — Engineering Guide"
-- for the table list and build order, and the Scoring Rubric PDF for the values (which live in
-- code at src/lib/coach/pitchScore/rubric.ts).
--
-- SCOPE — WHY THIS IS FOUR TABLES AND NOT NINE. The guide lists nine tables across five projects.
-- A first draft of this migration created all nine, and the repo's own invariant audit rejected
-- it: "rep_activity exists and is never named in src/. Either the feature it backs is unreachable,
-- or the table is DEFINER-RPC-written." That gate is right, and it is the A31 failure it exists to
-- catch — schema-complete is not built. Shipping a `patterns` table months before Pattern
-- Interrupt can write to it produces a schema nobody can explain and a migration nobody can test.
--
-- So this migration carries only what Project 1 — the scoring engine — actually stores:
--     rubric_config, pitch_scores, pitch_score_elements, pitch_score_events
--
-- Deferred to ship WITH their features, each in its own migration:
--     rep_activity                        → Project 3 (team activity KPIs on Coach Assessment)
--     recording_comments, score_overrides → Project 4 (Recordings tab)
--     patterns, pattern_events            → Project 5 (Pattern Interrupt)
-- Their shapes are recorded in the build guide and in
-- docs/SYSTEM UPDATES AND REVISION 09-22-2026/LOGIC-AND-CONTRADICTIONS.md so the work is not lost.
--
-- THE ACCESS RULE. The guide's launch checklist ends with "Reps only ever see their own patterns
-- and recordings." Every table here carries the same two-branch read policy — own row OR company
-- manager — using the SAME manager predicate the app already enforces
-- (role in CEO/COO/admin OR sales_coach_role = 'admin'), so RLS and the application layer cannot
-- disagree about who a manager is (§A21 — one manager definition).
--
-- VERIFIED AGAINST REAL POSTGRES (16.14, 2026-09-21), not just written: applied clean, re-applied
-- idempotently, and the isolation was exercised with four seeded users — a rep sees 1 of 2 pitch_scores,
-- a manager sees both, another tenant sees none.
--
-- Idempotent throughout (§A12).

-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- Shared predicate
-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- STABLE + SECURITY DEFINER so RLS on profiles cannot recurse into the policies that call it.
create or replace function is_sales_coach_manager()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from profiles p
    where p.id = auth.uid()
      and (p.role in ('CEO', 'COO', 'admin') or p.sales_coach_role = 'admin')
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- rubric_config — the versioned scoring definition
-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- A pitch scored in September must stay explainable in December after the rubric changes, so
-- pitch_scores.rubric_version pins the config a score was computed under. A change means a NEW version,
-- never an edit in place — otherwise every historical score silently re-interprets itself.
create table if not exists rubric_config (
  version      text primary key,
  company_id   uuid references companies(id) on delete cascade,
  label        text not null,
  -- [{ id, section, label, points, whatCounts }]
  elements     jsonb not null default '[]'::jsonb,
  -- [{ id, label, points, repeatable, maxTotal, audioInferred }]
  bonuses      jsonb not null default '[]'::jsonb,
  -- [{ id, label, deduction, repeatable, maxTotal, flagsForReview }]
  violations   jsonb not null default '[]'::jsonb,
  base_max     integer not null default 100,
  bonus_cap    integer not null default 30,
  qualifying_min_base integer not null default 40,
  audio_confidence_threshold numeric(3,2) not null default 0.80,
  is_active    boolean not null default false,
  created_at   timestamptz not null default now()
);

-- One active rubric per company at a time; the app reads the active row.
create unique index if not exists rubric_config_one_active_per_company
  on rubric_config (company_id) where is_active = true;

-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- pitch_scores — one scored recording
-- ─────────────────────────────────────────────────────────────────────────────────────────────
create table if not exists pitch_scores (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies(id) on delete cascade,
  rep_id        uuid not null references auth.users(id) on delete cascade,
  -- Links back to the existing coaching session when the pitch came from one, so the new scoring
  -- sits alongside the existing debrief rather than replacing it. The guide is explicit that the
  -- letter grade and skill scores stay as they are; the Pitch Score runs beside them.
  session_id    uuid references coaching_sessions(id) on delete set null,

  recorded_at   timestamptz not null,
  duration_s    integer,
  audio_url     text,
  transcript    text,

  outcome       text check (outcome in ('sold', 'follow_up', 'no_sale')),

  -- Score components. Stored, not recomputed on read: the rubric can change, and a leaderboard
  -- that silently re-scores last week's pitch_scores is not a leaderboard.
  base          numeric(5,1) not null default 0,
  bonus         numeric(5,1) not null default 0,
  violations    numeric(5,1) not null default 0,
  total         numeric(5,1) not null default 0,
  -- Display band (Strong / Solid / …) — text because the bands are a presentation choice the
  -- founder may retune without a migration.
  band          text,

  -- The qualifying test is on BASE, never total: a pitch can show a healthy total off the back of
  -- bonuses and still not count. The CHECK below is the interesting part — it makes it impossible
  -- to store an exclusion without storing WHY, because the recordings list shows a Pitch Score
  -- next to "Not counted" and nothing on screen would otherwise explain the difference.
  qualifying    boolean not null default false,
  not_qualifying_reason text,
  constraint pitches_reason_matches_qualifying
    check ((qualifying and not_qualifying_reason is null)
        or (not qualifying and not_qualifying_reason is not null)),

  -- True when Delivery was scored out of 27 and scaled to 35 because no objection occurred.
  delivery_scaled boolean not null default false,

  rubric_version text not null references rubric_config(version),
  created_at     timestamptz not null default now()
);

create index if not exists pitches_rep_recorded_idx on pitch_scores (rep_id, recorded_at desc);
create index if not exists pitches_company_recorded_idx on pitch_scores (company_id, recorded_at desc);
-- Every average and the leaderboard read only qualifying rows, so they get a partial index.
create index if not exists pitches_company_qualifying_idx
  on pitch_scores (company_id, recorded_at desc) where qualifying;

-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- pitch_score_elements — the per-element grade behind a score
-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- The rubric requires "a Hit / Partial / Missed grade plus a short evidence note (timestamp or
-- quote) for every element, so reps and managers can see why points were awarded". Without it the
-- score is an unexplainable number and the Dispute button has nothing to point at.
create table if not exists pitch_score_elements (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references companies(id) on delete cascade,
  pitch_id     uuid not null references pitch_scores(id) on delete cascade,
  element_id   text not null,
  grade        text not null check (grade in ('hit', 'partial', 'missed')),
  points       numeric(4,1) not null default 0,
  timestamp_s  integer,
  evidence     text,
  created_at   timestamptz not null default now(),
  -- One grade per element per pitch — a second row would double-count into the section total and
  -- break the "sections sum to base" identity the launch checklist requires.
  unique (pitch_id, element_id)
);

create index if not exists pitch_elements_pitch_idx on pitch_score_elements (pitch_id);
-- Pattern detection will scan "the last 10 pitch_scores where this element applied", per rep per item.
create index if not exists pitch_elements_element_idx on pitch_score_elements (company_id, element_id);

-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- pitch_score_events — bonuses and violations detected in a pitch
-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- Deliberately NOT merged into pitch_score_elements, because these REPEAT: buying questions stack to
-- +6, talking over the customer to −6. A unique (pitch, item) constraint is right there and wrong
-- here, which is the whole reason for two tables.
create table if not exists pitch_score_events (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references companies(id) on delete cascade,
  pitch_id     uuid not null references pitch_scores(id) on delete cascade,
  type         text not null check (type in ('bonus', 'violation')),
  item_id      text not null,
  points       numeric(4,1) not null default 0,
  timestamp_s  integer,
  evidence     text,
  -- 0..1 for audio-inferred bonuses (inside/backyard, laughs). The rubric awards those only above
  -- a confidence threshold and lets a manager override, so the confidence has to survive to the
  -- dispute — a rejected bonus a rep queries needs an answer better than "the AI didn't see it".
  confidence   numeric(3,2),
  created_at   timestamptz not null default now()
);

create index if not exists pitch_events_pitch_idx on pitch_score_events (pitch_id);
create index if not exists pitch_events_item_idx on pitch_score_events (company_id, type, item_id);

-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- Tenant-consistency guard
-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- Every child carries its own company_id so RLS can pin the tenant without a join — predicates
-- that join to find their tenant are slow and easy to get subtly wrong, and this codebase has
-- already closed two cross-tenant write holes (0250, 0251). This trigger stops the local copy from
-- ever disagreeing with its parent, which is the way that shortcut goes wrong.
create or replace function pitch_child_company_matches()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_parent_company uuid;
begin
  select company_id into v_parent_company from pitch_scores where id = NEW.pitch_id;
  if v_parent_company is null then
    raise exception 'pitch % does not exist', NEW.pitch_id;
  end if;
  if NEW.company_id is distinct from v_parent_company then
    raise exception 'company_id must match the parent pitch (got %, pitch is %)',
      NEW.company_id, v_parent_company;
  end if;
  return NEW;
end;
$$;

drop trigger if exists pitch_elements_company_check on pitch_score_elements;
create trigger pitch_elements_company_check
  before insert or update on pitch_score_elements
  for each row execute function pitch_child_company_matches();

drop trigger if exists pitch_events_company_check on pitch_score_events;
create trigger pitch_events_company_check
  before insert or update on pitch_score_events
  for each row execute function pitch_child_company_matches();

-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- RLS — "reps only ever see their own recordings"
-- ─────────────────────────────────────────────────────────────────────────────────────────────
alter table rubric_config  enable row level security;
alter table pitch_scores        enable row level security;
alter table pitch_score_elements enable row level security;
alter table pitch_score_events   enable row level security;

-- rubric_config: everyone in the company reads it — the rep's read-only Scoring rubric screen is
-- rendered from it, which is how the guide guarantees that screen "never goes stale". A null
-- company_id is the shared default rubric. Writes are service-role only: no policy grants them.
drop policy if exists "rubric_config - select" on rubric_config;
create policy "rubric_config - select" on rubric_config
  for select using (company_id is null or company_id = auth_company_id());

-- pitch_scores: your own, or any in your company if you manage.
drop policy if exists "pitch_scores - select" on pitch_scores;
create policy "pitch_scores - select" on pitch_scores
  for select using (
    company_id = auth_company_id()
    and (rep_id = auth.uid() or is_sales_coach_manager())
  );

-- No insert/update policy on pitch_scores, deliberately: scoring happens server-side with the service
-- role. A rep cannot write their own score, and a manager corrects one through the logged override
-- path that ships with Project 4 — not by editing the row.

drop policy if exists "pitch_score_elements - select" on pitch_score_elements;
create policy "pitch_score_elements - select" on pitch_score_elements
  for select using (
    company_id = auth_company_id()
    and exists (
      select 1 from pitch_scores p
      where p.id = pitch_score_elements.pitch_id
        and (p.rep_id = auth.uid() or is_sales_coach_manager())
    )
  );

drop policy if exists "pitch_score_events - select" on pitch_score_events;
create policy "pitch_score_events - select" on pitch_score_events
  for select using (
    company_id = auth_company_id()
    and exists (
      select 1 from pitch_scores p
      where p.id = pitch_score_events.pitch_id
        and (p.rep_id = auth.uid() or is_sales_coach_manager())
    )
  );
