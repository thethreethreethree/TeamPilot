-- 0363 — the folder guards, hardened (2026-11-26; review of 0360). Idempotent (A12).
--
-- 1. Concurrency. 0360's loop and depth checks read current parents without a lock: two moves at once (A into B and B
--    into A) could each pass and make a loop, and a create under a folder being moved could make a fourth level. Every
--    guard now takes a transaction-scoped advisory lock for its library (company + company-or-owner), so creates and
--    moves in one library take turns; other libraries are untouched.
-- 2. A bounded walk. The move guard's loop check now stops after 10 steps, like rss_folder_levels_above, so bad data
--    can never spin a statement until its timeout.
-- 3. Names. Creating by path reuses a folder found by name (route), so two siblings of one name never came from a
--    create; a move could make them ("Pricing" moved next to another "Pricing"), and a later save-by-path would pick one
--    silently. A move into a place that already has a folder of that name is refused.

create or replace function public.rss_folder_library_lock(p_company uuid, p_is_company boolean, p_owner uuid) returns void
  language plpgsql set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('library:' || p_company::text || ':' || case when p_is_company then 'company' else p_owner::text end, 0));
end $$;

create or replace function public.rss_guard_folder_parent() returns trigger
  language plpgsql set search_path = public as $$
declare
  p record;
begin
  perform public.rss_folder_library_lock(new.company_id, new.is_company, new.owner_id);
  if new.parent_id is null then return new; end if;
  select company_id, owner_id, is_company into p from library_folders where id = new.parent_id;
  if not found then raise exception 'RSS: that parent folder does not exist'; end if;
  if p.company_id <> new.company_id or p.is_company <> new.is_company or (not new.is_company and p.owner_id <> new.owner_id) then
    raise exception 'RSS: a folder goes inside a folder of the same library';
  end if;
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
  steps integer := 0;
  branch integer;
begin
  if new.kind <> 'move' then return new; end if;
  select company_id, owner_id, is_company, name into f from library_folders where id = new.folder_id;
  if not found or f.company_id <> new.company_id then raise exception 'RSS: that folder does not exist'; end if;
  perform public.rss_folder_library_lock(f.company_id, f.is_company, f.owner_id);
  if new.to_parent is not null then
    select company_id, owner_id, is_company into p from library_folders where id = new.to_parent;
    if not found then raise exception 'RSS: that parent folder does not exist'; end if;
    if p.company_id <> f.company_id or p.is_company <> f.is_company or (not f.is_company and p.owner_id <> f.owner_id) then
      raise exception 'RSS: a folder goes inside a folder of the same library';
    end if;
    cur := new.to_parent;
    while cur is not null loop
      if cur = new.folder_id then raise exception 'RSS: a folder can''t go inside itself or a folder inside it'; end if;
      steps := steps + 1;
      if steps > 10 then raise exception 'RSS: that folder''s place in the library can''t be worked out — ask for help'; end if;
      cur := public.rss_folder_parent_now(cur);
    end loop;
  end if;
  -- No two folders of one name side by side (case-insensitive, as people read them).
  if exists (
    select 1 from public.library_folders c
     where c.company_id = f.company_id and c.is_company = f.is_company and (f.is_company or c.owner_id = f.owner_id)
       and c.id <> new.folder_id and lower(trim(c.name)) = lower(trim(f.name))
       and public.rss_folder_parent_now(c.id) is not distinct from new.to_parent
  ) then
    raise exception 'RSS: there is already a folder called % there', f.name;
  end if;
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
