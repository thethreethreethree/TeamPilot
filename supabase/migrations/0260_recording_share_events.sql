-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 0260 — recording_share_events (Project 4, item 7: "Save as team example")
-- ═════════════════════════════════════════════════════════════════════════════════════════════
--
-- THE GUIDE'S WORDING IS THE WHOLE SPECIFICATION:
--
--     "Save as team example" needs the rep's permission before other reps can hear it.
--
-- Nothing in the product holds that permission. Grepped for team_example / share_request /
-- example_request across sql, ts and tsx before writing: zero hits. This is the first table today
-- that the guide named and the product genuinely does not already have under another name — the
-- previous four (rep_activity, score_overrides, pitches, timed transcript segments) all did.
--
-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- WHY AN EVENT LOG AND NOT A BOOLEAN ON pitch_scores
-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- A `shared_as_example boolean` would be a manager-side switch, which is precisely what the guide
-- forbids and what A10 forbids more strongly: other reps hearing a recording of this one is past a
-- shadow read, it is a shadow broadcast. A boolean also cannot answer the question that matters
-- after the fact — *was this rep asked, and what did they say* — because granting and never having
-- been asked look identical in one column.
--
-- So: append-only, four kinds, and the current state is derived by replaying (§3.1). A rep who
-- grants and later revokes leaves both facts on the record; the clip stops playing and the history
-- of the consent survives.
--
-- THE ASYMMETRY THAT MAKES IT A PERMISSION. A manager may only append `requested`. Only the rep
-- whose pitch it is may append `granted`, `declined` or `revoked`. That is enforced in the CHECK
-- and in the policies below, not in the route, because a route is one deploy away from being the
-- only thing standing between a manager and a recording of somebody else.
--
-- Idempotent throughout (§A12).
-- ═════════════════════════════════════════════════════════════════════════════════════════════

create table if not exists recording_share_events (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  pitch_id    uuid not null references pitch_scores(id) on delete cascade,

  -- Who appended this. For `requested` it is the manager; for the other three it is the rep, and
  -- the policy below is what makes that true rather than conventional.
  actor_id    uuid not null references auth.users(id) on delete cascade,

  kind        text not null check (kind in ('requested', 'granted', 'declined', 'revoked')),

  -- Optional: why the manager wants it, or why the rep said no. Shown to the other party.
  note        text,

  created_at  timestamptz not null default now()
);

create index if not exists recording_share_events_pitch_idx
  on recording_share_events (pitch_id, created_at);

alter table recording_share_events enable row level security;

-- Both parties see the whole thread. A rep must be able to read the request to answer it, and a
-- manager must be able to read a revocation or the clip keeps playing after consent was withdrawn.
drop policy if exists "recording_share_events - select" on recording_share_events;
create policy "recording_share_events - select" on recording_share_events
  for select using (
    company_id = auth_company_id()
    and (
      is_sales_coach_manager()
      or exists (
        select 1 from pitch_scores p
        where p.id = recording_share_events.pitch_id
          and p.rep_id = auth.uid()
      )
    )
  );

-- THE REP'S ANSWER IS THE REP'S TO GIVE. A manager appending `granted` on someone else's pitch is
-- the failure this table exists to prevent, so the insert policy names the rep explicitly: only
-- the owner of the pitch may append an answer, and only as themselves.
drop policy if exists "recording_share_events - rep answers" on recording_share_events;
create policy "recording_share_events - rep answers" on recording_share_events
  for insert with check (
    company_id = auth_company_id()
    and actor_id = auth.uid()
    and kind in ('granted', 'declined', 'revoked')
    and exists (
      select 1 from pitch_scores p
      where p.id = recording_share_events.pitch_id
        and p.rep_id = auth.uid()
    )
  );

-- No update, no delete: a withdrawn consent is a new row, never an erased one.
-- `requested` has no client insert policy — it is written server-side by the manager route, for
-- 0252's stated reason, and so that a client cannot forge the asking half either.
