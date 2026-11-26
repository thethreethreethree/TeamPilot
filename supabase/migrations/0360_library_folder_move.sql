-- 0360 — moving a library folder (2026-11-26; Gong ledger F12.6 "a folder can't be moved after it's made"). Idempotent (A12).
--
-- Folders are never updated (0280), so a move is an EVENT: a library_folder_events row of kind 'move' naming the new
-- parent (to_parent; null = the top level). A folder's CURRENT parent is its latest move, else the parent it was made
-- with (rss_folder_parent_now). library_folders_current exposes it, and every reader uses that view.
--
-- The guard (at insert of a move): the new parent exists in the same company and the same library (company, or the same
-- person's own); the move makes no loop (a folder can't go inside itself or anything under it); and the deepest folder
-- in the moved branch ends up at most three levels deep. 0353's create-time guard now walks CURRENT parents too, so a
-- folder made inside a moved one is still capped at three levels.
--
-- Archive state (0346) is the latest archive/restore per folder; a move is neither (library.ts archivedFolderIds).

alter table public.library_folder_events add column if not exists to_parent uuid references public.library_folders(id);
alter table public.library_folder_events drop constraint if exists library_folder_events_kind_check;
alter table public.library_folder_events drop constraint if exists library_folder_events_kind_shape;
alter table public.library_folder_events add constraint library_folder_events_kind_shape check (
  (kind in ('archive', 'restore') and to_parent is null) or kind = 'move'
);

create or replace function public.rss_folder_parent_now(fid uuid) returns uuid
  language plpgsql stable set search_path = public as $$
declare
  ev record;
begin
  select to_parent into ev from library_folder_events where folder_id = fid and kind = 'move' order by id desc limit 1;
  if found then return ev.to_parent; end if;
  return (select parent_id from library_folders where id = fid);
end $$;

create or replace view public.library_folders_current with (security_invoker = true) as
  select f.*, public.rss_folder_parent_now(f.id) as current_parent_id from public.library_folders f;

-- Levels above a folder, by current parents (a top-level folder has 0). Stops at 10 to stay safe on bad data.
create or replace function public.rss_folder_levels_above(fid uuid) returns integer
  language plpgsql stable set search_path = public as $$
declare
  n integer := 0;
  cur uuid := public.rss_folder_parent_now(fid);
begin
  while cur is not null and n < 10 loop
    n := n + 1;
    cur := public.rss_folder_parent_now(cur);
  end loop;
  return n;
end $$;

create or replace function public.rss_guard_folder_parent() returns trigger
  language plpgsql set search_path = public as $$
declare
  p record;
begin
  if new.parent_id is null then return new; end if;
  select company_id, owner_id, is_company into p from library_folders where id = new.parent_id;
  if not found then raise exception 'RSS: that parent folder does not exist'; end if;
  if p.company_id <> new.company_id or p.is_company <> new.is_company or (not new.is_company and p.owner_id <> new.owner_id) then
    raise exception 'RSS: a folder goes inside a folder of the same library';
  end if;
  -- The new folder sits one level below its parent: parent's levels above + 2 levels counting both.
  if public.rss_folder_levels_above(new.parent_id) + 2 > 3 then
    raise exception 'RSS: folders go at most three levels deep';
  end if;
  return new;
end $$;

create or replace function public.rss_guard_folder_move() returns trigger
  language plpgsql set search_path = public as $$
declare
  f record;
  p record;
  cur uuid;
  branch integer;
begin
  if new.kind <> 'move' then return new; end if;
  select company_id, owner_id, is_company into f from library_folders where id = new.folder_id;
  if not found or f.company_id <> new.company_id then raise exception 'RSS: that folder does not exist'; end if;
  if new.to_parent is not null then
    select company_id, owner_id, is_company into p from library_folders where id = new.to_parent;
    if not found then raise exception 'RSS: that parent folder does not exist'; end if;
    if p.company_id <> f.company_id or p.is_company <> f.is_company or (not f.is_company and p.owner_id <> f.owner_id) then
      raise exception 'RSS: a folder goes inside a folder of the same library';
    end if;
    -- No loop: walking up from the new parent must never reach the folder being moved.
    cur := new.to_parent;
    while cur is not null loop
      if cur = new.folder_id then raise exception 'RSS: a folder can''t go inside itself or a folder inside it'; end if;
      cur := public.rss_folder_parent_now(cur);
    end loop;
  end if;
  -- The moved branch's height (1 = no subfolders), by current parents.
  with recursive sub(id, lvl) as (
    select new.folder_id, 1
    union all
    select c.id, s.lvl + 1 from public.library_folders c join sub s on public.rss_folder_parent_now(c.id) = s.id where s.lvl < 4
  ) select max(lvl) into branch from sub;
  if (case when new.to_parent is null then 0 else public.rss_folder_levels_above(new.to_parent) + 1 end) + branch > 3 then
    raise exception 'RSS: folders go at most three levels deep';
  end if;
  return new;
end $$;
drop trigger if exists rss_guard_folder_move on public.library_folder_events;
create trigger rss_guard_folder_move before insert on public.library_folder_events
  for each row execute function public.rss_guard_folder_move();
