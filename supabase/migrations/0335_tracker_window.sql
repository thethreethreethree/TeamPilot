-- 0335 — a tracker can count only what is said in the first N minutes of a call (2026-11-25; Gong ledger F11.3
-- "partial-call window"). E.g. a required disclosure must be said in the first 2 minutes; a mention at minute 20 is not
-- the disclosure. NULL = the whole call (every tracker until now).
--
-- Like the words, side and kind, the window never changes (0276's guard, extended by 0329): changing what a tracker
-- counts means a new tracker, so its past hits stay explainable. A line with no known time can't be placed in the
-- window, so a windowed tracker leaves it out (trackers.ts, smartTrackerScan.ts). Re-runnable.

alter table public.keyword_trackers add column if not exists within_first_seconds integer;
alter table public.keyword_trackers drop constraint if exists keyword_trackers_window;
alter table public.keyword_trackers add constraint keyword_trackers_window check (within_first_seconds is null or within_first_seconds between 30 and 3600);

create or replace function public.rss_guard_tracker_update() returns trigger
  language plpgsql set search_path = public as $$
begin
  if new.company_id is distinct from old.company_id or new.name is distinct from old.name
     or new.phrases is distinct from old.phrases or new.side is distinct from old.side
     or new.kind is distinct from old.kind or new.within_first_seconds is distinct from old.within_first_seconds
     or new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at then
    raise exception 'RSS: a tracker''s words never change — deactivate it and create a new one';
  end if;
  if old.active = false and new.active = true then
    raise exception 'RSS: a deactivated tracker stays deactivated — create a new one';
  end if;
  return new;
end $$;
