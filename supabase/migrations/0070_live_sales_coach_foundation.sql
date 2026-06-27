-- 0070_live_sales_coach_foundation.sql
--
-- Live Sales Coach — Subsystem 2 (Recording & Storage) data foundation.
-- Founder request 2026-06-27. Built foundation-up (AMD-006 L1 before
-- L2): this is the immutable, append-only data layer every other part
-- of the Live Sales Coach rests on. The real-time audio pipeline
-- (subsystem 1) and the agent-facing review surface are later
-- increments; they will WRITE to and READ from these tables.
--
-- Design decisions (on the record):
--   - Transcript segments + cues are APPEND-ONLY assets (§3.1 + the
--     founder's stated data-as-asset principle): no UPDATE / DELETE,
--     enforced by rules, mirroring support_messages (0034).
--   - context is carried on the session ('in_person' | 'video') so the
--     same foundation serves both conversation types — the founder
--     chose "design the data layer for both now" (2026-06-27).
--   - The POST-CALL REVIEW is NOT a new table. It reuses the existing
--     append-only `events` chain as kind='coach.sales_review_generated'
--     subject='sales_session:<id>', exactly like coach.debrief_generated
--     (§A21 — one coach-output mechanism, not a parallel one). This
--     keeps the "growth over time" rollup uniform across surfaces.
--   - Cues are stored even though the realtime pipeline is a later
--     increment, because the "reduced reliance on live cues over time"
--     progress signal (founder's training-wheels intent) is derived by
--     counting cues per session across sessions.
--
-- Idempotent (§A12): create-if-not-exists, create-or-replace rules,
-- drop-policy-if-exists. Safe to run twice or after a half-run.

-- ─── Sessions ──────────────────────────────────────────────────────
create table if not exists coaching_sessions (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies(id) on delete cascade,
  agent_id        uuid not null references profiles(id) on delete cascade,
  -- 'in_person' (door-to-door) | 'video' (online call). Both supported.
  context         text not null check (context in ('in_person', 'video')),
  -- Optional human label for the client/campaign this session belongs
  -- to. Kept as free text for now — no campaign entity was specified;
  -- a later increment can promote this to a real FK without data loss.
  client_label    text,
  status          text not null default 'active'
                    check (status in ('active', 'ended', 'reviewed')),
  -- Pointer to the persisted full-audio asset (subsystem 1 writes it).
  -- Nullable: a session can exist with a transcript but no stored audio.
  audio_asset_url text,
  started_at      timestamptz not null default now(),
  ended_at        timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists coaching_sessions_company_agent_idx
  on coaching_sessions (company_id, agent_id, started_at desc);

-- ─── Transcript segments (append-only, diarized) ───────────────────
create table if not exists coaching_transcript_segments (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references coaching_sessions(id) on delete cascade,
  -- Diarization: distinguish agent vs customer where possible; 'unknown'
  -- when the diarizer can't attribute a segment confidently.
  speaker     text not null check (speaker in ('agent', 'customer', 'unknown')),
  text        text not null,
  -- Monotonic ordering within a session (the realtime feed assigns it).
  seq         integer not null,
  -- Wall-clock the words were spoken, when the pipeline provides it.
  spoken_at   timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists coaching_transcript_segments_session_idx
  on coaching_transcript_segments (session_id, seq);

-- Append-only: a transcript is an immutable asset (§3.1). No edits, no
-- deletes — same discipline as support_messages.
create or replace rule coaching_transcript_segments_no_update as
  on update to coaching_transcript_segments do instead nothing;
create or replace rule coaching_transcript_segments_no_delete as
  on delete to coaching_transcript_segments do instead nothing;

-- ─── Cues (append-only record of live coaching delivered) ──────────
create table if not exists coaching_cues (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references coaching_sessions(id) on delete cascade,
  -- Two modes (founder spec): 'suggestion' = tactic/strategy call;
  -- 'guide_response' = coach exactly what to say.
  mode         text not null check (mode in ('suggestion', 'guide_response')),
  text         text not null,
  delivered_at timestamptz not null default now(),
  -- End-to-end latency of this cue (ms), when the pipeline measures it.
  -- "a late tip is worthless" — this column is how we will hold the
  -- pipeline to the founder's latency-above-all requirement.
  latency_ms   integer,
  created_at   timestamptz not null default now()
);

create index if not exists coaching_cues_session_idx
  on coaching_cues (session_id, delivered_at);

create or replace rule coaching_cues_no_update as
  on update to coaching_cues do instead nothing;
create or replace rule coaching_cues_no_delete as
  on delete to coaching_cues do instead nothing;

-- ─── Trigger: stamp ended_at when a session ends ───────────────────
create or replace function stamp_coaching_session_ended_at()
returns trigger
language plpgsql
as $$
begin
  if new.status in ('ended', 'reviewed')
     and old.status = 'active'
     and new.ended_at is null then
    new.ended_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_stamp_coaching_session_ended on coaching_sessions;
create trigger trg_stamp_coaching_session_ended
  before update on coaching_sessions
  for each row execute function stamp_coaching_session_ended_at();

-- ─── RLS ───────────────────────────────────────────────────────────
-- The realtime pipeline writes via the service-role client (bypasses
-- RLS), like the C.A.R.E customer path. RLS here gates AGENT dashboard
-- access: a member can see sessions in their own company.
alter table coaching_sessions enable row level security;
alter table coaching_transcript_segments enable row level security;
alter table coaching_cues enable row level security;

drop policy if exists "coaching_sessions - select" on coaching_sessions;
create policy "coaching_sessions - select" on coaching_sessions
  for select using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.company_id = coaching_sessions.company_id
    )
  );

drop policy if exists "coaching_sessions - insert" on coaching_sessions;
create policy "coaching_sessions - insert" on coaching_sessions
  for insert with check (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.company_id = coaching_sessions.company_id
    )
  );

-- Update gated to the owning agent or a company admin (status changes).
drop policy if exists "coaching_sessions - update" on coaching_sessions;
create policy "coaching_sessions - update" on coaching_sessions
  for update using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.company_id = coaching_sessions.company_id
        and (coaching_sessions.agent_id = p.id or p.role in ('CEO', 'COO', 'admin'))
    )
  );

-- Segments + cues: readable by same-company members; inserts allowed
-- for same-company members (the service-role pipeline bypasses anyway).
drop policy if exists "coaching_transcript_segments - select" on coaching_transcript_segments;
create policy "coaching_transcript_segments - select" on coaching_transcript_segments
  for select using (
    exists (
      select 1 from coaching_sessions s
      join profiles p on p.company_id = s.company_id
      where s.id = coaching_transcript_segments.session_id
        and p.id = auth.uid()
    )
  );

drop policy if exists "coaching_transcript_segments - insert" on coaching_transcript_segments;
create policy "coaching_transcript_segments - insert" on coaching_transcript_segments
  for insert with check (
    exists (
      select 1 from coaching_sessions s
      join profiles p on p.company_id = s.company_id
      where s.id = coaching_transcript_segments.session_id
        and p.id = auth.uid()
    )
  );

drop policy if exists "coaching_cues - select" on coaching_cues;
create policy "coaching_cues - select" on coaching_cues
  for select using (
    exists (
      select 1 from coaching_sessions s
      join profiles p on p.company_id = s.company_id
      where s.id = coaching_cues.session_id
        and p.id = auth.uid()
    )
  );

drop policy if exists "coaching_cues - insert" on coaching_cues;
create policy "coaching_cues - insert" on coaching_cues
  for insert with check (
    exists (
      select 1 from coaching_sessions s
      join profiles p on p.company_id = s.company_id
      where s.id = coaching_cues.session_id
        and p.id = auth.uid()
    )
  );
