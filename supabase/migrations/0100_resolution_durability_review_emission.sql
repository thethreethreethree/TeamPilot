-- 0100 — §3.5 resolution durability review event emission
--
-- Why
-- ───
-- 0005 created the `resolutions` table as "the missing fourth link" that
-- closes the §3.1 chain: events → signals → problems → resolutions →
-- (new events). It did close HALF of it: `close_problem()` appends the
-- resolution AND emits `problem.resolved` (0005 line 188). That is the
-- CREATION half.
--
-- What was never wired is the REVIEW half. The resolution's durability
-- judgment — held / reopened / partial, the §3.5 "did it actually
-- work?" measurement 0005's own header (lines 6-9) names as the whole
-- reason the table exists — is written by PATCH /api/resolutions into
-- the `durability` / `observed_outcome` columns and then… stops. It is
-- read back for DISPLAY (learning-summary, exports, care dashboards)
-- but it emits no event, so it derives no signal, so a resolution that
-- REOPENED — a `problem_recurrence`, the single most important honest
-- consequence signal the constitution asks for — never re-enters the
-- events→signals chain. For the `resolutions` table specifically, the
-- loop §3.1 mandates is OPEN.
--
-- This is the IDENTICAL gap 0015 diagnosed and closed for chat topics:
--   "What was missing was the REVIEW action: someone coming back later
--    and saying 'this stuck' or 'this came back.' That review IS the
--    §3.5 measurement; without it, the chain stops at 'closed' and never
--    reaches the held-vs-reopened judgment that the constitution
--    requires as evidence the System is producing real outcomes."
-- 0015 fixed it for `chat_topics.close_durability`; the `resolutions`
-- table (fed by the problems workflow via close_problem, a DIFFERENT
-- surface — chat closes never insert into `resolutions`) was left with
-- the same hole. This migration applies 0015's decided pattern to it.
-- It is a §3.1 close-the-loop correctness alignment, not a new feature.
--
-- This migration:
--   1. Adds an AFTER UPDATE OF durability trigger on `resolutions` that
--      emits a `resolution.durability_reviewed` event whenever
--      `durability` transitions (NULL→value or value→value) and runs
--      derive_signals_for_event so the signal lands in the same txn.
--   2. Registers three signal_sources mapping that event kind to the
--      same three signal kinds 0015 uses — held / reopened / partial.
--
-- Why a separate event kind (not re-using problem.resolved)
-- ────────────────────────────────────────────────────────
-- §3.1 events are append-only. `problem.resolved` already fired at
-- CREATION; re-emitting it at review time would imply the problem was
-- resolved twice, which is a lie (0015's exact reasoning). The review
-- is its own discrete action and earns its own kind.
--
-- Why the signal source points at the PROBLEM, not the resolution
-- ───────────────────────────────────────────────────────────────
-- The signal kinds are resolution_held / problem_recurrence /
-- partial_resolution. `problem_recurrence` is fundamentally a statement
-- ABOUT THE PROBLEM (it came back). Sourcing the signal at
-- `problem:${payload.problem_id}` ties the recurrence back to the
-- problem so §1.2 retrospective analysis can see "this problem
-- recurred" — more useful than pointing at the one-off resolution row.
--
-- `unknown` earns no signal
-- ─────────────────────────
-- Mirrors 0015: `unknown` explicitly means "not yet a consequence
-- measurement," and signals must be earned (§3.2). No signal_source
-- predicate matches durability='unknown', so it derives nothing — the
-- honest behaviour, achieved structurally rather than by a special case.
--
-- No backfill
-- ───────────
-- The trigger fires on future updates only. Resolutions whose durability
-- was set BEFORE this migration do not retroactively emit events — §3.1
-- forbids fabricating historical events stamped now(). Their durability
-- is still readable on the column for display; only new/changed reviews
-- from here forward feed the signal chain. Same limitation 0015 accepted.
--
-- Ripple (§1.5, holistic)
-- ───────────────────────
--   • signals table: new resolution_held / problem_recurrence /
--     partial_resolution signals will begin appearing from resolution
--     reviews. This is the INTENDED effect — the loop closing — not a
--     regression. Verified downstream consumers (§1.5 holistic trace):
--     (a) fetchSignals (the signals feed / Command Center surface) shows
--     the new signals; (b) learn.ts (the brain learning cycle) counts
--     signal kinds and treats >=5 observations of a kind as a pattern, so
--     resolution-review recurrences now feed pattern detection. NOTE: per
--     0005, signals do NOT auto-create problems — a `problem_recurrence`
--     signal becomes evidence AVAILABLE to be linked to a problem, and the
--     §3.2 understanding gate then evaluates that link before any problem
--     surfaces. 0100 supplies previously-missing evidence to that process;
--     it does not (and must not) auto-surface a problem on its own.
--   • No double-count with 0015: chat closes never insert into
--     `resolutions` (the only INSERT is close_problem, 0005 L175), and
--     the event kind/subject differ, so the two paths never emit twice
--     for one real-world outcome.
--   • Idempotent (§A12): create-or-replace fn, drop-if-exists trigger,
--     on-conflict-do-nothing sources — safe to re-run.
--
-- STATUS: UNAPPLIED. Per repo convention (and the migration-coupling
-- discipline — never assume applied), the founder applies this against
-- each environment; code must not assert it is live without per-env
-- verification.

create or replace function resolutions_emit_durability_review()
returns trigger
language plpgsql
security invoker
as $$
declare
  v_event_id uuid;
begin
  -- Only fire when durability actually changes (including NULL→value).
  -- IS DISTINCT FROM handles the NULL comparison correctly; `=` doesn't.
  if NEW.durability is distinct from OLD.durability then
    insert into events (company_id, kind, subject, actor, payload, occurred_at)
    values (
      NEW.company_id,
      'resolution.durability_reviewed',
      'resolution:' || NEW.id::text,
      auth.uid(),
      jsonb_build_object(
        'resolution_id', NEW.id,
        'problem_id', NEW.problem_id,
        'durability', NEW.durability,
        'previous_durability', OLD.durability,
        'observed_outcome', NEW.observed_outcome
      ),
      now()
    )
    returning id into v_event_id;
    perform derive_signals_for_event(v_event_id);
  end if;
  return NEW;
end;
$$;

drop trigger if exists resolutions_durability_review_trigger on resolutions;
create trigger resolutions_durability_review_trigger
  after update of durability on resolutions
  for each row execute function resolutions_emit_durability_review();

-- ─────────────────────────────────────────────────────────────────────
-- signal_sources for the new event kind
-- ─────────────────────────────────────────────────────────────────────
--
-- Mirrors 0015's chat.topic_durability_reviewed mappings, bound instead
-- to the resolutions-table review event and predicated on the `durability`
-- payload key. `unknown` is intentionally absent — it earns no signal.
insert into signal_sources (event_kind, signal_kind, predicate, source_template, notes)
values
  ('resolution.durability_reviewed', 'resolution_held',
   '{"durability":"held"}'::jsonb,
   'problem:${payload.problem_id}',
   '§3.5: a reviewer confirmed the resolution held.'),
  ('resolution.durability_reviewed', 'problem_recurrence',
   '{"durability":"reopened"}'::jsonb,
   'problem:${payload.problem_id}',
   '§3.5: a reviewer confirmed the problem came back — the honest recurrence signal.'),
  ('resolution.durability_reviewed', 'partial_resolution',
   '{"durability":"partial"}'::jsonb,
   'problem:${payload.problem_id}',
   '§3.5: a reviewer confirmed the resolution held only partially.')
on conflict do nothing;
