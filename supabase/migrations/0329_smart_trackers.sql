-- 0329 — smart trackers: find an idea said in any words, from example sentences (2026-11-23; ledger F11.8
-- "Example-based smart trackers", LACK; founder picker 2026-11-23: "One AI read per call").
--
-- A keyword tracker (0276) matches exact phrases. A SMART tracker holds example sentences instead ("we're locked into a
-- contract", "our deal with Comcast doesn't end till June"); when a call's transcript lands, ONE AI read checks the call
-- against all of the company's smart trackers at once (smartTrackerScan.ts) and writes hits into the same tracker_hits
-- table — so the Trackers list, the call page, search and adoption all work unchanged. A hit's `matched` is the EXAMPLE
-- it matched (the company's own words), never the customer's line, so tracker_hits still holds no customer words and
-- legal erasure needs nothing new.
--
-- keyword_trackers gains `kind` ('keyword' | 'smart'); like the words, the kind never changes (0276's guard extended).
-- At most 10 active smart trackers per company (the route enforces it). Re-runnable.

alter table public.keyword_trackers add column if not exists kind text not null default 'keyword';
alter table public.keyword_trackers drop constraint if exists keyword_trackers_kind;
alter table public.keyword_trackers add constraint keyword_trackers_kind check (kind in ('keyword', 'smart'));
alter table public.keyword_trackers drop constraint if exists keyword_trackers_smart_examples;
alter table public.keyword_trackers add constraint keyword_trackers_smart_examples check (kind <> 'smart' or cardinality(phrases) between 1 and 10);

create or replace function public.rss_guard_tracker_update() returns trigger
  language plpgsql set search_path = public as $$
begin
  if new.company_id is distinct from old.company_id or new.name is distinct from old.name
     or new.phrases is distinct from old.phrases or new.side is distinct from old.side
     or new.kind is distinct from old.kind
     or new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at then
    raise exception 'RSS: a tracker''s words never change — deactivate it and create a new one';
  end if;
  if old.active = false and new.active = true then
    raise exception 'RSS: a deactivated tracker stays deactivated — create a new one';
  end if;
  return new;
end $$;
