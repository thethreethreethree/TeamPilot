-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 0276 — RSS Phase 3 step 3: keyword trackers (Gong F11.1). From the scaffold's 0274_rss_p3_scoring.sql part 2.
-- ═════════════════════════════════════════════════════════════════════════════════════════════
--
-- A manager names exact words or phrases (a competitor, a product, a required disclosure); every remote sales
-- session's transcript is matched when it lands (src/lib/coach/remote/trackerScan.ts, called from
-- generateSessionArtifacts) and each hit is stored with the segment's time, so the session page shows
-- "Competitors · 03:12".
--
-- WHERE THIS DIFFERS FROM THE SCAFFOLD, AND WHY
--   · rubric_config.channel (scaffold part 1) is NOT here. The scorer grades with the rubric in code and does
--     not read rubric_config; a channel column nothing reads would be a feature that does not exist. It ships
--     with the scorer change (Phase 3 step 1). Note for then: rubric_config's flag is `is_active` (0252), not
--     `active` as the scaffold's index assumed — that index would not have applied.
--   · A tracker's words never change. The scaffold's update policy let a manager edit phrases in place, which
--     silently changes what every past hit means (§3.1). Here a tracker is written only by the manager route,
--     and a trigger allows exactly one change: active true → false (deactivate, never delete — the plan's rule).
--   · tracker_hits.at_ms is NULLABLE: a segment with no wall-clock (an older transcript) is still a hit; it just
--     cannot be played from. Inventing 0 would send the player to the start of the call.
--   · Hits carry the segment's seq and the transcript version, unique per (tracker, session, version, seq,
--     phrase), so a re-scan never duplicates and a repaired transcript (0269) is matched afresh.
--   · Read rule for hits = the session's rule (owner, or a manager under the 0273 reporting tree), via
--     rss_tree_allows, not a second definition (§2.2).
--
-- Idempotent (A12).
-- ═════════════════════════════════════════════════════════════════════════════════════════════

do $$
begin
  if not exists (select 1 from pg_proc where proname = 'rss_tree_allows') then
    raise exception 'RSS preflight: rss_tree_allows() not found — apply 0273 first';
  end if;
end $$;

create table if not exists public.keyword_trackers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  name text not null check (length(trim(name)) between 1 and 60),
  phrases text[] not null check (cardinality(phrases) between 1 and 200),
  side text not null default 'any' check (side in ('rep', 'customer', 'any')),
  active boolean not null default true,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists keyword_trackers_company_idx on public.keyword_trackers (company_id, active);

-- The one permitted change: switching a tracker off. Everything else about a tracker is fixed at creation.
create or replace function public.rss_guard_tracker_update() returns trigger
  language plpgsql set search_path = public as $$
begin
  if new.company_id is distinct from old.company_id or new.name is distinct from old.name
     or new.phrases is distinct from old.phrases or new.side is distinct from old.side
     or new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at then
    raise exception 'RSS: a tracker''s words never change — deactivate it and create a new one';
  end if;
  if old.active = false and new.active = true then
    raise exception 'RSS: a deactivated tracker stays deactivated — create a new one';
  end if;
  return new;
end $$;
drop trigger if exists rss_guard_tracker_update on public.keyword_trackers;
create trigger rss_guard_tracker_update before update on public.keyword_trackers
  for each row execute function public.rss_guard_tracker_update();
create or replace rule keyword_trackers_no_delete as on delete to public.keyword_trackers do instead nothing;

create table if not exists public.tracker_hits (
  id bigint generated always as identity primary key,
  tracker_id uuid not null references public.keyword_trackers(id),
  session_id uuid not null references public.coaching_sessions(id) on delete cascade,
  company_id uuid not null references public.companies(id),
  rep_id uuid not null references public.profiles(id),
  seq integer not null,
  at_ms integer check (at_ms >= 0),
  speaker text not null check (speaker in ('rep', 'customer', 'unknown')),
  matched text not null,
  transcript_version integer not null,
  created_at timestamptz not null default now(),
  constraint tracker_hits_once unique (tracker_id, session_id, transcript_version, seq, matched)
);
create index if not exists tracker_hits_session_idx on public.tracker_hits (session_id, transcript_version);
create index if not exists tracker_hits_tracker_idx on public.tracker_hits (tracker_id);
create or replace rule tracker_hits_no_update as on update to public.tracker_hits do instead nothing;
create or replace rule tracker_hits_no_delete as on delete to public.tracker_hits do instead nothing;

alter table public.keyword_trackers enable row level security;
alter table public.tracker_hits enable row level security;

drop policy if exists rss_trackers_select on public.keyword_trackers;
create policy rss_trackers_select on public.keyword_trackers for select to authenticated
  using (company_id = auth_company_id());
-- No client write policies: /api/coach/remote/trackers writes after requireSalesCoachManager (service role).

drop policy if exists rss_hits_select on public.tracker_hits;
create policy rss_hits_select on public.tracker_hits for select to authenticated
  using (company_id = auth_company_id() and (rep_id = auth.uid() or (is_sales_coach_manager() and rss_tree_allows(rep_id))));
-- No client write policies: the pipeline (service role) writes hits.
