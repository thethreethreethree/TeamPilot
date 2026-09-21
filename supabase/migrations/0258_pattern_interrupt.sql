-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 0258 — Pattern Interrupt storage (Project 5 of the 2026-09-19 coaching build)
-- ═════════════════════════════════════════════════════════════════════════════════════════════
--
-- THE TABLES 0252 PROMISED. Its header reads:
--
--     Deferred to ship WITH their features, each in its own migration:
--         patterns, pattern_events            → Project 5 (Pattern Interrupt)
--
-- This is that migration. The inputs already exist: `pitch_score_elements` carries a Hit/Partial/
-- Missed grade per element per pitch with `unique (pitch_id, element_id)`, and 0252 created
-- `pitch_elements_element_idx on (company_id, element_id)` with the comment "Pattern detection
-- will scan the last 10 pitch_scores where this element applied". Applicability needs no column —
-- a row exists only when the item was graded, so "it applied" IS row presence.
--
-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- WHY TWO TABLES, AND WHY THERE IS NO STATUS COLUMN (§3.1)
-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- §3.1: everything is an event, events are append-only, entity state is derived by replaying.
-- Applied here that is not ceremony — the status has five values and three of them are computed
-- from pitches that arrive AFTER the row was written:
--
--     New → Coaching → Improving / Stalled → Fixed
--
-- Fixed clears automatically after 5 clean applicable pitches; Stalled means coached 7+ days ago
-- with no streak and no improvement. A `status` column would have to be recomputed by a job on
-- every new pitch, and would be wrong between runs — so there is none. `patterns` holds identity
-- plus the facts FROZEN at detection; `pattern_events` is the append-only log of what a human did;
-- status is resolved in one place, `src/lib/coach/patterns/status.ts`, and returned as a verdict.
--
-- THE GUIDE LISTS A `status` COLUMN and this table does not have one. That is not a divergence:
-- the guide's own Step 5 heading is "Statuses (drive them from data and pattern_events)", which is
-- what the resolver does. The field list on page 2 is what the table HOLDS conceptually, and Step
-- 5 is how it is maintained; deriving satisfies both, and a stored copy would be the §2.2
-- duplicated-decision this build is otherwise careful about.
--
-- Frozen matters for `cost_per_pitch` specifically. A pattern detected under one rubric must not
-- silently re-cost itself when the rubric changes — the same reason `pitch_scores` stores its
-- components rather than recomputing on read.
--
-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- THE ACCESS RULE — unchanged, deliberately (§A21)
-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- The guide's launch checklist ends "Reps only ever see their own patterns and recordings." These
-- tables use the SAME predicate 0252 established — `is_sales_coach_manager()` — rather than a
-- second definition of who a manager is. A21 is precisely the failure of two modules agreeing on
-- a name and disagreeing on the feature behind it, and "manager" is the name most likely to fork.
--
-- No insert/update/delete policy, also deliberately and for 0252's stated reason: detection runs
-- server-side under the service role. A rep cannot open a pattern about themselves, and a manager
-- coaches through a logged event rather than by editing a row.
--
-- Idempotent throughout (§A12): every create carries IF NOT EXISTS, every policy is dropped IF
-- EXISTS before being created, so a replay against a partially-applied database is a no-op rather
-- than a 42P07.
-- ═════════════════════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- patterns — one detected repeated miss, with what qualified it
-- ─────────────────────────────────────────────────────────────────────────────────────────────
create table if not exists patterns (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references companies(id) on delete cascade,
  rep_id       uuid not null references auth.users(id) on delete cascade,

  -- WHICH rubric item. Three kinds because the rubric has three: a graded element, a bonus the rep
  -- keeps failing to earn, a violation they keep committing. `item_id` is the rubric id
  -- ("close.askForSale"), not a label — labels are presentation and change without a migration.
  item_kind    text not null check (item_kind in ('element', 'bonus', 'violation')),
  item_id      text not null,

  -- The evidence that qualified it, frozen. §3.2: a problem may not reach a human without the
  -- signals that support it, so a surfaced pattern carries its own justification and a manager can
  -- see "5 of 7" rather than being asked to trust a flag.
  -- `first_seen` is the guide's name for it (page 2: rep_id, element_id, status, first_seen,
  -- fixed_at, cost_per_pitch, rubric_version). The Rep progress board prints it as "first seen
  -- Sep 14" and derives the OPEN column ("9 days") from it.
  first_seen         timestamptz not null default now(),
  misses_at_detection      integer not null check (misses_at_detection >= 0),
  applicable_at_detection  integer not null check (applicable_at_detection > 0),
  -- Average points lost per applicable pitch at detection. Becomes "points recovered" once fixed.
  cost_per_pitch     numeric(4,1) not null default 0,
  -- The dot strip as graded, newest first: {missed,missed,hit,...}. Stored rather than recomputed
  -- so the card shows what was true when the pattern opened.
  strip_at_detection text[] not null default '{}',

  -- A pattern cannot have more misses than pitches it was measured over. Cheap, and it catches the
  -- window/strip mix-up that would otherwise surface as "7 of 5" on a manager's screen.
  constraint patterns_misses_within_applicable
    check (misses_at_detection <= applicable_at_detection),

  -- The rubric this pattern was detected under, for the same reason pitch_scores carries it:
  -- `cost_per_pitch` is frozen in the rubric's terms, and an element's max can change between
  -- versions. Without it, "costing 2.1 pts per pitch" is a number with no denominator.
  rubric_version     text,

  -- Set by an explicit 'fixed' event or left null; the partial unique index below depends on
  -- it, so it is declared here AND re-asserted by an ALTER for a table from a partial apply.
  fixed_at     timestamptz,
  created_at   timestamptz not null default now()
);

-- A12, and the reason this line is ABOVE the index rather than below it: `create table if not
-- exists` is a no-op against a table that already exists, so a database left by a partial apply
-- keeps whatever columns it had. The index below is partial ON fixed_at and would fail with
-- 42703 on such a database. The ALTER makes the column true in both worlds before anything
-- depends on it. (Caught by reading the order, before the migration had ever run.)
alter table patterns add column if not exists fixed_at timestamptz;

-- One OPEN pattern per rep per item. Without this, every detection run opens another row for the
-- same miss and a rep accumulates duplicates of one problem — the count inflates, the chips lie,
-- and a manager coaches the same thing three times. Partial, so the history of fixed patterns for
-- that item is kept and a recurrence can open a new row.
create unique index if not exists patterns_open_unique
  on patterns (company_id, rep_id, item_id)
  where fixed_at is null;

create index if not exists patterns_rep_idx on patterns (company_id, rep_id);
-- The team-wide roll-up: "3+ reps sharing one item promotes the pattern to the top".
create index if not exists patterns_item_idx on patterns (company_id, item_id);

-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- pattern_events — append-only, what a human did about it
-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- Never updated, never deleted. `coached_at` is not a column on `patterns` to be edited; it is the
-- timestamp of the earliest 'coaching_started' event, which means the record shows WHO coached and
-- WHEN even after a second manager picks it up.
create table if not exists pattern_events (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  pattern_id  uuid not null references patterns(id) on delete cascade,
  -- THE GUIDE'S SIX, verbatim from its page-2 data model:
  --     pattern_events  pattern_id, type (coached, drill_assigned, note, rep_reviewed,
  --                     clip_disputed, fixed), actor, created_at, body
  -- An earlier draft of this migration invented its own five ('detected', 'coaching_started',
  -- 'reopened' …) before the boards had been opened. Three of the six are load-bearing on screens
  -- that already exist in the design and would have had nowhere to write:
  --   · drill_assigned — the Ⓓ marker on the Rep progress timeline, and the manager's
  --                      "Assign Role Play drill" action
  --   · rep_reviewed   — the Ⓡ marker, the rep's "Reviewed ✓" button, the "Rep reviewed 2/2" tile
  --                      and the whole AWAITING REP REVIEW count ("Coached, clips not opened")
  --   · clip_disputed  — the rep's "This clip looks wrong", which alerts the manager
  kind        text not null check (kind in ('coached', 'drill_assigned', 'note', 'rep_reviewed', 'clip_disputed', 'fixed')),
  -- Null for 'detected', which the system writes. A human event without an actor would make the
  -- log unauditable, but the constraint is not NOT NULL because the detector is not a human.
  actor_id    uuid references auth.users(id) on delete set null,
  body        text,
  created_at  timestamptz not null default now()
);

create index if not exists pattern_events_pattern_idx on pattern_events (pattern_id, created_at);

-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────────────────────────────────
alter table patterns       enable row level security;
alter table pattern_events enable row level security;

-- A rep sees their own; a manager sees their company's. Same two-branch shape as pitch_scores.
drop policy if exists "patterns - select" on patterns;
create policy "patterns - select" on patterns
  for select using (
    company_id = auth_company_id()
    and (rep_id = auth.uid() or is_sales_coach_manager())
  );

-- Events inherit their pattern's visibility rather than restating it. Restating would be a second
-- copy of the access decision, and the copy is the one that drifts (§2.2) — a term added to the
-- pattern policy and not to this one would leak a manager's coaching note to the wrong rep.
drop policy if exists "pattern_events - select" on pattern_events;
create policy "pattern_events - select" on pattern_events
  for select using (
    company_id = auth_company_id()
    and exists (
      select 1 from patterns p
      where p.id = pattern_events.pattern_id
        and (p.rep_id = auth.uid() or is_sales_coach_manager())
    )
  );
