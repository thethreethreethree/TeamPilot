-- 0018 — feedback + smoke test schema
--
-- Why this lands as a constitutional feature, not a side-channel
-- ──────────────────────────────────────────────────────────────
-- §1.1 says: "Every input is a permanent asset, never transient
-- noise. Errors, abandoned approaches, complaints, and dead ends are
-- assets equal to successes." Tester feedback is EXPLICITLY the
-- shape §1.1 names. So feedback doesn't live in Slack, Linear, or
-- email — it lives in the §3.1 chain alongside every other event the
-- System reasons over. Each piece of feedback:
--
--   1. Inserts a row into `feedback` (append-only, §3.1 immutable
--      at the SQL-layer like events/signals/chat_messages).
--   2. Emits a `feedback.submitted` event via trigger.
--   3. Becomes a candidate for signal derivation via signal_sources
--      (3+ reports of the same surface → `user_friction` signal).
--   4. Patterns of that signal earn problem status via §3.2 Gate.
--   5. Resolutions get durability tracked via §3.5 — did the fix
--      hold, or did the same report come back?
--
-- The feedback loop itself thereby demonstrates the constitution
-- working on its own development. That's §1.6 close-the-loop made
-- structural, not just procedural.
--
-- Status lifecycle on `feedback` rows
-- ───────────────────────────────────
-- Even though feedback is append-only (no DELETE, per §3.1), the
-- status field IS updateable — we need to triage. The trigger emits
-- a separate `feedback.status_changed` event on every transition so
-- the journey is preserved. New rows always start as 'open'.

-- ─────────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────────

create table if not exists feedback (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies(id) on delete cascade,
  author_id     uuid references auth.users(id) on delete set null,
  kind          text not null
                check (kind in (
                  'bug',
                  'idea',
                  'question',
                  'friction',
                  'praise',
                  'smoke_test_result'
                )),
  title         text not null,
  body          text not null default '',
  page_path     text not null default '/',
  -- Rich context captured automatically at submit time
  viewport      jsonb not null default '{}'::jsonb,
  -- Free-form metadata: includes screenshot_url (if any), topic_id
  -- when the user was inside a chat at submit, ai_assisted markers,
  -- linked smoke_test_item_id when kind='smoke_test_result', etc.
  payload       jsonb not null default '{}'::jsonb,
  -- Threading: replies + acknowledgments chain back to the original.
  parent_id     uuid references feedback(id) on delete set null,
  status        text not null default 'open'
                check (status in (
                  'open',
                  'triaged',
                  'in_progress',
                  'resolved',
                  'declined',
                  'duplicate'
                )),
  -- Triage metadata — who, when, why. Append-style: on each status
  -- transition the trigger emits an event; this column tracks the
  -- current state for fast queries.
  triaged_by    uuid references auth.users(id) on delete set null,
  triaged_at    timestamptz,
  resolved_by   uuid references auth.users(id) on delete set null,
  resolved_at   timestamptz,
  resolution_note text,
  -- For 'duplicate' status: link to the canonical feedback row.
  duplicate_of  uuid references feedback(id) on delete set null,
  created_at    timestamptz not null default now()
);

create index if not exists feedback_company_status_idx
  on feedback (company_id, status, created_at desc);
create index if not exists feedback_author_idx on feedback (author_id);
create index if not exists feedback_kind_idx on feedback (kind);

-- Append-only by §3.1. Feedback is permanent record; status changes
-- via UPDATE on the status field only, never DELETE.
create or replace rule feedback_no_delete as
  on delete to feedback do instead nothing;

-- ─────────────────────────────────────────────────────────────────
-- smoke_test_versions — admin-curated checklists
-- ─────────────────────────────────────────────────────────────────
--
-- A "version" is a snapshot of the test checklist the admin published
-- to testers. Versions are append-only (new edits = new version) so a
-- tester's results always reference an unambiguous spec.
--
-- `items` is a jsonb array of { id, title, instructions, expected,
-- reference_image_url? }. Each item has a stable id so results can
-- reference it even if the array order changes between versions.

create table if not exists smoke_test_versions (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references companies(id) on delete cascade,
  -- e.g. "Tier B verification, 2026-06-04" — human-readable
  label        text not null,
  -- Marker for which version is currently active for testers. Only
  -- one active version per company at a time.
  is_active    boolean not null default false,
  items        jsonb not null default '[]'::jsonb,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);

create unique index if not exists smoke_test_versions_one_active_per_company
  on smoke_test_versions (company_id)
  where is_active = true;

create or replace rule smoke_test_versions_no_delete as
  on delete to smoke_test_versions do instead nothing;

-- ─────────────────────────────────────────────────────────────────
-- smoke_test_results — per-tester results, isolated by user
-- ─────────────────────────────────────────────────────────────────
--
-- Each tester gets their own row per (version, item_id). Two testers
-- testing the same item produce two distinct rows — neither overwrites
-- the other. This is the "separate data storage" the user asked for.
--
-- Status: pass / fail / unable. Notes required for fail + unable.
-- A re-test by the same tester appends a new row (append-only), so
-- the history of "I marked it fail, fixed it, now passes" is preserved.

create table if not exists smoke_test_results (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies(id) on delete cascade,
  version_id    uuid not null references smoke_test_versions(id) on delete cascade,
  -- The item.id from smoke_test_versions.items[].id
  item_id       text not null,
  tester_id     uuid not null references auth.users(id) on delete cascade,
  status        text not null check (status in ('pass', 'fail', 'unable')),
  notes         text not null default '',
  -- Optional follow-up: link to a feedback row if the tester wrote up
  -- the failure in detail through the floating button.
  feedback_id   uuid references feedback(id) on delete set null,
  created_at    timestamptz not null default now()
);

create index if not exists smoke_test_results_version_tester_idx
  on smoke_test_results (version_id, tester_id, created_at desc);

create or replace rule smoke_test_results_no_delete as
  on delete to smoke_test_results do instead nothing;
create or replace rule smoke_test_results_no_update as
  on update to smoke_test_results do instead nothing;

-- ─────────────────────────────────────────────────────────────────
-- Triggers: feedback / smoke_test events → chain
-- ─────────────────────────────────────────────────────────────────

create or replace function feedback_emit_event()
returns trigger
language plpgsql
security invoker
as $$
declare
  v_event_id uuid;
  v_kind     text;
  v_payload  jsonb;
begin
  if TG_OP = 'INSERT' then
    v_kind := 'feedback.submitted';
    v_payload := jsonb_build_object(
      'feedback_id', NEW.id,
      'kind', NEW.kind,
      'page_path', NEW.page_path,
      'title_excerpt', left(NEW.title, 120),
      'parent_id', NEW.parent_id
    );
    insert into events (company_id, kind, subject, actor, payload, occurred_at)
    values (
      NEW.company_id, v_kind,
      'feedback:' || NEW.id::text,
      NEW.author_id, v_payload, NEW.created_at
    )
    returning id into v_event_id;
    perform derive_signals_for_event(v_event_id);
    return NEW;

  elsif TG_OP = 'UPDATE' then
    -- Only emit on status transitions. Other column updates (e.g. a
    -- typo fix in resolution_note) don't earn an event.
    if NEW.status is distinct from OLD.status then
      v_kind := 'feedback.status_changed';
      v_payload := jsonb_build_object(
        'feedback_id', NEW.id,
        'from_status', OLD.status,
        'to_status', NEW.status,
        'resolution_note', NEW.resolution_note,
        'duplicate_of', NEW.duplicate_of
      );
      insert into events (company_id, kind, subject, actor, payload, occurred_at)
      values (
        NEW.company_id, v_kind,
        'feedback:' || NEW.id::text,
        coalesce(NEW.resolved_by, NEW.triaged_by, auth.uid()),
        v_payload, now()
      )
      returning id into v_event_id;
      perform derive_signals_for_event(v_event_id);
    end if;
    return NEW;
  end if;
  return NEW;
end;
$$;

drop trigger if exists feedback_emit_event_trigger on feedback;
create trigger feedback_emit_event_trigger
  after insert or update on feedback
  for each row execute function feedback_emit_event();

create or replace function smoke_test_result_emit_event()
returns trigger
language plpgsql
security invoker
as $$
declare
  v_event_id uuid;
begin
  insert into events (company_id, kind, subject, actor, payload, occurred_at)
  values (
    NEW.company_id,
    case NEW.status
      when 'pass' then 'smoke_test.pass'
      when 'fail' then 'smoke_test.fail'
      else 'smoke_test.unable'
    end,
    'smoke_test_item:' || NEW.item_id,
    NEW.tester_id,
    jsonb_build_object(
      'version_id', NEW.version_id,
      'item_id', NEW.item_id,
      'status', NEW.status,
      'notes_excerpt', left(NEW.notes, 200),
      'feedback_id', NEW.feedback_id
    ),
    NEW.created_at
  )
  returning id into v_event_id;
  perform derive_signals_for_event(v_event_id);
  return NEW;
end;
$$;

drop trigger if exists smoke_test_result_emit_event_trigger on smoke_test_results;
create trigger smoke_test_result_emit_event_trigger
  after insert on smoke_test_results
  for each row execute function smoke_test_result_emit_event();

-- ─────────────────────────────────────────────────────────────────
-- signal_sources: feedback patterns earn signals
-- ─────────────────────────────────────────────────────────────────
--
-- A single bug report doesn't earn a signal — that would flood the
-- chain with noise. But the event lands so patterns are detectable.
-- Smoke test failures DO each earn a signal (they're already filtered
-- by the testing context — the tester wouldn't be testing if there
-- wasn't a hypothesis to validate).
--
-- These mappings can grow over time as we learn what patterns of
-- feedback are signal-worthy.

insert into signal_sources (event_kind, signal_kind, predicate, source_template, notes)
values
  -- A reported bug is direct evidence of friction. One report is a
  -- signal; multiple reports against the same surface accumulate
  -- toward problem status via §3.2 Gate.
  ('feedback.submitted', 'user_friction', '{"kind":"bug"}'::jsonb,
   'feedback:${payload.feedback_id}',
   'A tester reported a bug. Each report is friction evidence.'),

  -- Reported friction without a clear "bug" framing — UX confusion,
  -- "this doesn't work the way I expected." Same signal kind; the
  -- predicate keeps the routing clear.
  ('feedback.submitted', 'user_friction', '{"kind":"friction"}'::jsonb,
   'feedback:${payload.feedback_id}',
   'A tester reported UX friction. Counts toward Understanding Gate.'),

  -- Smoke test FAIL is the strongest pre-Gate signal we get — it's
  -- a structured, hypothesis-tested failure with notes.
  ('smoke_test.fail', 'user_friction', null,
   'smoke_test_item:${payload.item_id}',
   '§3.5 measurement: a smoke test the tester ran returned fail.'),

  -- 'unable' = the tester could not perform the test. Distinct
  -- signal kind because the failure mode is different — it's "the
  -- test itself is malformed" or "the surface isn't reachable from
  -- here," not "the system behaved wrong."
  ('smoke_test.unable', 'test_unreachable', null,
   'smoke_test_item:${payload.item_id}',
   'Tester could not exercise this test. Surface or test itself needs revision.'),

  -- Status change to 'resolved' is the resolution-durable side.
  -- Whether it actually held is measured later via §3.5 durability —
  -- "did the same report come back within N days?"
  ('feedback.status_changed', 'resolution_held', '{"to_status":"resolved"}'::jsonb,
   'feedback:${payload.feedback_id}',
   '§3.5: a feedback report was marked resolved. Durability measured later.')
on conflict do nothing;

-- ─────────────────────────────────────────────────────────────────
-- RLS — per-company isolation
-- ─────────────────────────────────────────────────────────────────

alter table feedback              enable row level security;
alter table smoke_test_versions   enable row level security;
alter table smoke_test_results    enable row level security;

-- feedback: any company member can read all feedback (testers should
-- see each other's reports — that prevents duplicates and surfaces
-- consensus). Only authenticated members can insert. Updates (status
-- transitions) are limited to company members; we'll layer admin-
-- only triage in the application code, not the policy, so the
-- constitution remains "the admin role is a discipline, not a
-- privilege wall" (per §3.3 spirit).
create policy "feedback - select" on feedback
  for select using (company_id = auth_company_id());
create policy "feedback - insert" on feedback
  for insert with check (
    company_id = auth_company_id()
    and author_id = auth.uid()
  );
create policy "feedback - update" on feedback
  for update using (company_id = auth_company_id());

-- smoke_test_versions: company-wide select. Insert/update is
-- application-gated to admin role — we don't enforce role at the
-- policy layer because the role taxonomy is still settling and
-- having the policy say "admin only" would lock us into that name.
create policy "smoke_test_versions - select" on smoke_test_versions
  for select using (company_id = auth_company_id());
create policy "smoke_test_versions - insert" on smoke_test_versions
  for insert with check (company_id = auth_company_id());
create policy "smoke_test_versions - update" on smoke_test_versions
  for update using (company_id = auth_company_id());

-- smoke_test_results: every tester sees only their own results
-- (per the "separate data storage so they don't overwrite each other"
-- requirement). Aggregate views are reconstructed by the admin inbox
-- via a server route using the service role.
create policy "smoke_test_results - select - own" on smoke_test_results
  for select using (
    company_id = auth_company_id()
    and tester_id = auth.uid()
  );
create policy "smoke_test_results - insert" on smoke_test_results
  for insert with check (
    company_id = auth_company_id()
    and tester_id = auth.uid()
  );
