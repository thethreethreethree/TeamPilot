-- 0040 — Coach v6 schema additions.
--
-- Phase 1 of the post-CAT-001 C.A.R.E rebuild. Closes audit P0
-- violations of A11 (mirror not judge), A17 (multi-contract
-- design), A18 (labels invite not penalize), and A16 direction 2
-- (Coach reads Co-Pilot's reasoning when grading).
--
-- What changes structurally
-- ─────────────────────────
-- Before: Coach grades the agent's reply with a verdict-shaped
-- enum ('productive' / 'neutral' / 'needs_guidance' / 'withheld').
-- Per A11 the System cannot render verdicts on human work — it
-- can only count what's present and surface those counts so the
-- user renders the verdict. The verdict rubric was the
-- constitutional violation; the new schema replaces it.
--
-- After: Coach v6 surfaces COUNTS — both positive presence
-- (acknowledgment, answer, next step) and risk counts (unsupported
-- absolutes, fabricated specifics, empty filler). The display
-- chip shows the counts; the agent / leader render the verdict.
--
-- Why JSONB and not a column per count
-- ─────────────────────────────────────
-- The count categories are explicitly an A4 uncertainty per the
-- Phase 1 design: the exact categories may need to evolve as real
-- graded replies surface gaps. JSONB lets the rubric grow without
-- a migration per category change. Per A4 — surface uncertainties,
-- defer to evidence. Pinning the schema to today's category set
-- would be exactly the A4 failure mode.
--
-- A16 direction 2 — co_pilot_reasoning + co_pilot_invoked
-- ────────────────────────────────────────────────────────
-- The A16 audit finding (composition between AI tools on the same
-- surface) was closed in direction 1 already (commit 0612cec) —
-- the Co-Pilot route now reads the most recent Coach grade. This
-- migration adds the storage for direction 2: when an agent sends
-- a Co-Pilot-drafted reply, the message row stores the reasoning
-- the Co-Pilot surfaced. The grader reads that reasoning and
-- doesn't penalize the message for shape choices Co-Pilot
-- explicitly justified.
--
-- Backwards compatibility
-- ───────────────────────
-- The existing coach_grade column stays. The Coach v6 grader
-- writes BOTH coach_counts (the new structure) AND coach_grade
-- (derived from the counts) during the transition window. UI
-- prefers coach_counts when present. Once the new flow has
-- accumulated enough graded replies for the §4 readout to validate
-- it against coach_grade, a future migration deprecates the enum.
--
-- A12 idempotent.

alter table support_messages
  add column if not exists coach_counts jsonb,
  add column if not exists co_pilot_reasoning text,
  add column if not exists co_pilot_invoked boolean not null default false;

-- ─── Index on coach_counts presence ──────────────────────────
-- Lets growth aggregation queries quickly find "agent replies
-- graded under v6" vs "still using v5 enum" without scanning.
create index if not exists support_messages_coach_v6_idx
  on support_messages (author_id, created_at desc)
  where coach_counts is not null and author_type = 'agent';

-- ─── Update preserve trigger to allow new Coach columns ──────
-- The 0037 trigger preserve_support_message_content reverts any
-- update to body/author columns but allows coach_grade,
-- coach_reason_internal, coach_graded_at. Coach v6 adds
-- coach_counts to the list of allowed update columns. The
-- co_pilot_reasoning + co_pilot_invoked columns are set on
-- INSERT and never updated, so they don't need exemption.
--
-- Recreating the trigger function with security definer
-- preserved from 0037 + 0039.

create or replace function preserve_support_message_content()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Revert any attempt to mutate content / author columns. These
  -- are append-only per §3.1; the only writes allowed after
  -- INSERT are the Coach grading columns (which are System-
  -- emitted observations, not author edits).
  new.body := old.body;
  new.author_id := old.author_id;
  new.author_type := old.author_type;
  new.is_internal_note := old.is_internal_note;
  new.conversation_id := old.conversation_id;
  new.created_at := old.created_at;
  -- co_pilot_reasoning + co_pilot_invoked are also append-only:
  -- set on insert based on whether the agent invoked Co-Pilot,
  -- never changed after.
  new.co_pilot_reasoning := old.co_pilot_reasoning;
  new.co_pilot_invoked := old.co_pilot_invoked;
  return new;
end;
$$;

-- Trigger already exists from 0037; the create-or-replace above
-- updates the function body in place. No need to drop/recreate
-- the trigger binding.

-- ─── Comments ────────────────────────────────────────────────
comment on column support_messages.coach_counts is
  'Coach v6 output (A11 count-based rubric). JSONB shape:
   {
     positive: {
       acknowledged: 0 | 1,
       answered: 0 | 1,
       next_step: 0 | 1
     },
     risks: {
       unsupported_absolutes: int,
       fabricated_specifics: int,
       empty_filler: int
     },
     reason_internal: text   -- 1-2 sentences, internal-only,
                             -- the agent reads this for growth
   }
   The counts are facts; the verdict (whether the pattern is fair)
   is the user''s, not the System''s. Per ThinkerThinker.md A11.';

comment on column support_messages.co_pilot_reasoning is
  'When the agent invoked the AI Co-Pilot to draft this reply,
   the Co-Pilot returns a 1-2 sentence reasoning explaining the
   communication move it made. We persist it here so:
   (a) the agent can see in the conversation timeline what the
       Co-Pilot was doing,
   (b) the Coach grader reads it when scoring this message and
       doesn''t penalize deliberate shape choices Co-Pilot
       explicitly justified — A16 direction 2 composition.
   NULL when the agent typed without Co-Pilot.';

comment on column support_messages.co_pilot_invoked is
  'Boolean flag for analytics — was the AI Co-Pilot called during
   drafting of this message? Independent of co_pilot_reasoning
   (which can be null even if invoked, if the call failed). Used
   in the §4 readout to compare Coach grades on Co-Pilot-assisted
   vs unassisted replies.';
