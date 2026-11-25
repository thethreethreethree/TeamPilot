-- 0344 — a tracker can have a start and an end date (2026-11-26; Gong ledger F11.5 "Start/end dates and backfill").
-- starts_on: calls that started before it aren't matched; a start date in the past is read back from that date when the
-- tracker is saved (the route's backfill), a future one means "scheduled". ends_on: calls that started after the end of
-- that day aren't matched — a planned stop. NULL = no limit (every tracker until now).
--
-- Like the words, side, kind and window, the dates never change (0276's guard, extended by 0329 and 0335): changing
-- what a tracker counts means a new tracker, so its past hits stay explainable. Re-runnable.

alter table public.keyword_trackers add column if not exists starts_on date;
alter table public.keyword_trackers add column if not exists ends_on date;
alter table public.keyword_trackers drop constraint if exists keyword_trackers_dates;
alter table public.keyword_trackers add constraint keyword_trackers_dates check (starts_on is null or ends_on is null or ends_on >= starts_on);

create or replace function public.rss_guard_tracker_update() returns trigger
  language plpgsql set search_path = public as $$
begin
  if new.company_id is distinct from old.company_id or new.name is distinct from old.name
     or new.phrases is distinct from old.phrases or new.side is distinct from old.side
     or new.kind is distinct from old.kind or new.within_first_seconds is distinct from old.within_first_seconds
     or new.starts_on is distinct from old.starts_on or new.ends_on is distinct from old.ends_on
     or new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at then
    raise exception 'RSS: a tracker''s words never change — deactivate it and create a new one';
  end if;
  if old.active = false and new.active = true then
    raise exception 'RSS: a deactivated tracker stays deactivated — create a new one';
  end if;
  return new;
end $$;
