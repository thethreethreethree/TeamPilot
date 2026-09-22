-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 0259 — recording_comments (Project 4: the Recordings tab)
-- ═════════════════════════════════════════════════════════════════════════════════════════════
--
-- THE LAST TABLE 0252 DEFERRED. Its header reads:
--
--     Deferred to ship WITH their features, each in its own migration:
--         recording_comments, score_overrides → Project 4 (Recordings tab)
--
-- Only ONE of those two is created here. `score_overrides` is the guide's name for what the
-- product already built as `pitch_score_overrides` (0255) with `apply_pitch_score_override`
-- (0256) — the third table today whose guide name differs from its product name, after
-- rep_activity/rep_kpi_daily and pitches/pitch_scores. Checked before writing, not after (A21).
--
-- Shape from the build guide's page-2 data model, verbatim:
--     recording_comments   pitch_id, author_id, timestamp_s, body, sent_to_rep
--
-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- WHY A LOG AND NOT EDITABLE NOTES (§3.1)
-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- A comment here is a manager speaking to a rep about a specific second of their recording, and
-- item 6 of the guide sends it to them: *"'Save and send to rep' notifies the rep and shows the
-- comment in their Pitch detail."*
--
-- Once a rep has read it, it is said. An editable row would let a manager revise what they told
-- someone after the fact, with the rep's memory as the only record of the original — which is the
-- shape of dispute this product exists to prevent, pointed the wrong way. So: append-only, no
-- update policy, and a correction is a NEW comment.
--
-- `sent_to_rep` is set at insert and never changed. A draft that was never sent and a comment the
-- rep has seen are different things, and flipping the flag afterwards would erase which one this
-- was.
--
-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- THE ACCESS RULE
-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- A rep may read a comment on their own pitch ONLY once it was sent to them. A manager sees all
-- of their company's. That asymmetry is the one place this table is not simply "own row or
-- manager": an unsent comment is a manager's working note, and A10's no-shadow-read rule is
-- satisfied by the fact that an unsent note is not a read ABOUT the rep that anyone is acting on
-- — the moment it informs anything, it is sent, and then they see it.
--
-- Same `is_sales_coach_manager()` predicate as 0252, not a second definition (A21).
--
-- Idempotent throughout (§A12).
-- ═════════════════════════════════════════════════════════════════════════════════════════════

create table if not exists recording_comments (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references companies(id) on delete cascade,
  pitch_id     uuid not null references pitch_scores(id) on delete cascade,
  author_id    uuid not null references auth.users(id) on delete cascade,

  -- WHERE in the recording. Not nullable: a comment with no timestamp is a note about the pitch,
  -- and the pitch already has somewhere for those. This table is specifically "at 7:22".
  timestamp_s  integer not null check (timestamp_s >= 0),

  body         text not null check (length(btrim(body)) > 0),

  -- Set at insert, never updated. See the header: a draft and a delivered comment are different
  -- facts and the flag is the only thing that distinguishes them.
  sent_to_rep  boolean not null default false,

  created_at   timestamptz not null default now()
);

create index if not exists recording_comments_pitch_idx
  on recording_comments (pitch_id, timestamp_s);

alter table recording_comments enable row level security;

-- A manager reads their company's; a rep reads comments on their own pitch that were SENT.
drop policy if exists "recording_comments - select" on recording_comments;
create policy "recording_comments - select" on recording_comments
  for select using (
    company_id = auth_company_id()
    and (
      is_sales_coach_manager()
      or (
        sent_to_rep
        and exists (
          select 1 from pitch_scores p
          where p.id = recording_comments.pitch_id
            and p.rep_id = auth.uid()
        )
      )
    )
  );

-- No insert/update/delete policy. Comments are written server-side by the route that also stamps
-- the author, for 0252's stated reason — and because a client-authored `author_id` is a manager's
-- name on somebody else's words.
