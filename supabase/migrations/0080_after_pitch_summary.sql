-- 0080_after_pitch_summary.sql
--
-- After Pitch Summary — the rep's personal "between doors" debrief.
-- Founder request 2026-07-02 (PDF spec). Built foundation-up (AMD-006 L1
-- before L2). Two new append-only tables; NOTHING existing is altered.
--
-- Design decisions (on the record):
--
--   1. coaching_cue_outcomes — closes the loop the PDF §3 asks for ("the AI
--      whispered X → you followed it → outcome"). Until now we stored the cue
--      + when, but NEVER whether the rep followed it. This table records that
--      determination, with an explicit `source`:
--         - 'rep_marked'  = the rep tapped "used it" during the call (first-
--            party truth).
--         - 'inferred'    = the post-call engine judged followed/partial/
--            ignored from what the rep said AFTER the cue, with evidence.
--      The source column is load-bearing (§3.4): we must never present an
--      inference as a rep-confirmed fact. Append-only (§3.1) — a re-judgement
--      appends; the latest is current.
--
--   2. after_pitch_summaries — the assembled summary artifact (moments,
--      narrative, PRIVATE scores, cue-outcome refs, one focus). RLS is
--      restricted to the OWNING AGENT (select/insert where agent_id =
--      auth.uid()). This is the structural privacy for the self-assessment
--      SCORES (A18 — data surfaced to an authority invites a behavior; a
--      "who scored low / who ignored coaching" surface for a manager invites
--      penalty, so managers never see it). The existing manager-visible
--      growth-review event (coach.sales_review_generated) is UNCHANGED — a
--      manager's visibility is the narrative review, not the rep's private
--      scoreboard. Append-only (§3.1); regeneration appends, latest is current.
--
-- Composition (A16/A21): this does NOT fork the growth-review. The After
-- Pitch Summary REUSES generateSalesReview for its narrative and adds the
-- moments + private scores + cue-loop as distinct, labeled layers on top.
--
-- Idempotent (A12): create-if-not-exists, create-or-replace rules,
-- drop-policy-if-exists. Safe to run twice or after a half-run.

-- ─── Cue outcomes (append-only: did the rep follow the cue?) ─────────
create table if not exists coaching_cue_outcomes (
  id            uuid primary key default gen_random_uuid(),
  cue_id        uuid not null references coaching_cues(id) on delete cascade,
  session_id    uuid not null references coaching_sessions(id) on delete cascade,
  -- The determination. 'partial' = the rep moved toward the cue but not fully.
  determination text not null
                  check (determination in ('followed', 'partial', 'ignored')),
  -- HOW we know (§3.4 — never present an inference as confirmed).
  source        text not null check (source in ('rep_marked', 'inferred')),
  -- Short evidence string for an 'inferred' determination (the transcript
  -- moment that shows follow/ignore). Null for 'rep_marked' (the tap IS the
  -- evidence). Kept honest — no fabricated evidence.
  evidence      text,
  -- Who/what recorded it (the rep for rep_marked; the reviewing rep for
  -- inferred). Nullable — a service-role pipeline write may have no user.
  created_by    uuid references profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);

create index if not exists coaching_cue_outcomes_cue_idx
  on coaching_cue_outcomes (cue_id, created_at desc);
create index if not exists coaching_cue_outcomes_session_idx
  on coaching_cue_outcomes (session_id, created_at desc);

-- Append-only (§3.1) — mirrors coaching_cues' own rules.
create or replace rule coaching_cue_outcomes_no_update as
  on update to coaching_cue_outcomes do instead nothing;
create or replace rule coaching_cue_outcomes_no_delete as
  on delete to coaching_cue_outcomes do instead nothing;

alter table coaching_cue_outcomes enable row level security;

-- SELECT scoped to the OWNING AGENT only (A18 — a "who ignored coaching"
-- report must never be a manager surface). The service-role pipeline bypasses
-- RLS for writes; the post-call summary assembler reads via service role too.
drop policy if exists "coaching_cue_outcomes - select" on coaching_cue_outcomes;
create policy "coaching_cue_outcomes - select" on coaching_cue_outcomes
  for select using (
    exists (
      select 1 from coaching_sessions s
      where s.id = coaching_cue_outcomes.session_id
        and s.agent_id = auth.uid()
    )
  );

-- INSERT allowed for the owning agent (the live "used it" tap posts as the
-- rep). The service-role pipeline bypasses RLS anyway.
drop policy if exists "coaching_cue_outcomes - insert" on coaching_cue_outcomes;
create policy "coaching_cue_outcomes - insert" on coaching_cue_outcomes
  for insert with check (
    exists (
      select 1 from coaching_sessions s
      where s.id = coaching_cue_outcomes.session_id
        and s.agent_id = auth.uid()
    )
  );

-- ─── After Pitch Summary (rep-private assembled artifact) ────────────
create table if not exists after_pitch_summaries (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references coaching_sessions(id) on delete cascade,
  company_id  uuid not null references companies(id) on delete cascade,
  -- The owning rep. Privacy pivots on this column (RLS below).
  agent_id    uuid not null references profiles(id) on delete cascade,
  -- The full summary: { moments, narrative, scores, cueOutcomes, focus }.
  -- Stored so the mobile surface reads it back without re-spending an LLM
  -- call (§3.6 — the artifact is the visible record).
  payload     jsonb not null,
  created_at  timestamptz not null default now()
);

create index if not exists after_pitch_summaries_session_idx
  on after_pitch_summaries (session_id, created_at desc);
create index if not exists after_pitch_summaries_agent_idx
  on after_pitch_summaries (agent_id, created_at desc);

-- Append-only (§3.1) — regeneration appends a new row; the latest (by
-- created_at) is the current summary.
create or replace rule after_pitch_summaries_no_update as
  on update to after_pitch_summaries do instead nothing;
create or replace rule after_pitch_summaries_no_delete as
  on delete to after_pitch_summaries do instead nothing;

alter table after_pitch_summaries enable row level security;

-- PRIVATE TO THE OWNING AGENT (A18). A manager / admin CANNOT read another
-- rep's private self-assessment summary — not by role, not by company. The
-- only structural exception is the service-role client (bypasses RLS) used by
-- the server-side generator to write the row.
drop policy if exists "after_pitch_summaries - select owner" on after_pitch_summaries;
create policy "after_pitch_summaries - select owner" on after_pitch_summaries
  for select using (agent_id = auth.uid());

-- INSERT only by the owning agent (the rep generates their OWN summary). A
-- manager cannot mint someone else's private summary — agent_id must equal
-- the caller. The service-role generator bypasses RLS.
drop policy if exists "after_pitch_summaries - insert owner" on after_pitch_summaries;
create policy "after_pitch_summaries - insert owner" on after_pitch_summaries
  for insert with check (agent_id = auth.uid());
