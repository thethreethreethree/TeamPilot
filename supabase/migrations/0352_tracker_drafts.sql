-- 0352 — draft trackers (2026-11-26; Gong ledger F11.4 "save as draft"). Idempotent (A12).
--
-- A manager can save a tracker without switching it on: a draft is never matched against calls, has no hits and
-- isn't counted, so its phrases can be previewed (trackers/preview) and the tracker put live when it's right.
-- `draft` defaults to false: every existing tracker stays live.
--
-- WHAT CAN CHANGE. 0276's rule holds — a tracker's words never change. The guard allows one more change: draft → live
-- (true → false), once; a live tracker never goes back to draft (its hits would then belong to a draft). Switching a
-- tracker off (active true → false) works for drafts too.
--
-- ONE DEFINITION OF "LIVE" (§2.2): keyword_trackers_live = active and not a draft. Every scan and count reads it,
-- so the condition is written once. security_invoker: the caller's RLS on keyword_trackers still decides.

alter table public.keyword_trackers add column if not exists draft boolean not null default false;

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
  -- 0352: a draft may go live, once; a live tracker never becomes a draft.
  if old.draft = false and new.draft = true then
    raise exception 'RSS: a live tracker can''t go back to draft — switch it off and create a new one';
  end if;
  return new;
end $$;

create or replace view public.keyword_trackers_live with (security_invoker = true) as
  select * from public.keyword_trackers where active and not draft;
grant select on public.keyword_trackers_live to authenticated, service_role;
