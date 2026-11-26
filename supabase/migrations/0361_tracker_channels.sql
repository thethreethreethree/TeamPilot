-- 0361 — a tracker can be limited to a call type (2026-11-26; Gong ledger F11.3 "filters by call type"). Idempotent (A12).
--
-- channels: the call types a tracker listens to — phone, video, or both. NULL = every call type it can hear (trackers
-- only ever scan phone and video calls). E.g. "screen share" belongs to video calls; a phone call that never says it
-- is not a miss. Like the words, side, window and dates, the scope never changes (the guard below, after 0352): a
-- different scope is a new tracker, so its past hits and its adoption stay explainable.
--
-- keyword_trackers_live (0352) is `select *`, which Postgres expands when the view is made, so it is re-made here to
-- carry the new column.

alter table public.keyword_trackers add column if not exists channels text[];
alter table public.keyword_trackers drop constraint if exists keyword_trackers_channels;
alter table public.keyword_trackers add constraint keyword_trackers_channels
  check (channels is null or (cardinality(channels) between 1 and 2 and channels <@ array['phone', 'video']::text[]));

create or replace function public.rss_guard_tracker_update() returns trigger
  language plpgsql set search_path = public as $$
begin
  if new.company_id is distinct from old.company_id or new.name is distinct from old.name
     or new.phrases is distinct from old.phrases or new.side is distinct from old.side
     or new.kind is distinct from old.kind or new.within_first_seconds is distinct from old.within_first_seconds
     or new.starts_on is distinct from old.starts_on or new.ends_on is distinct from old.ends_on
     or new.channels is distinct from old.channels
     or new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at then
    raise exception 'RSS: a tracker''s words never change — deactivate it and create a new one';
  end if;
  if old.active = false and new.active = true then
    raise exception 'RSS: a deactivated tracker stays deactivated — create a new one';
  end if;
  -- 0352: a draft may go live, once; a live tracker never becomes a draft.
  if old.draft = false and new.draft = true then
    raise exception 'RSS: a live tracker can''t go back to draft — switch it off and create a new one';
  end if;
  return new;
end $$;

create or replace view public.keyword_trackers_live with (security_invoker = true) as
  select * from public.keyword_trackers where active and not draft;
grant select on public.keyword_trackers_live to authenticated, service_role;
