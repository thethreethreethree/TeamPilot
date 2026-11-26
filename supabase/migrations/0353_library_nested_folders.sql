-- 0353 — nested library folders (2026-11-26; Gong ledger F12.6 "nested"). Idempotent (A12).
--
-- A folder may sit inside another: "Objections / Pricing". The parent is fixed when the folder is created — folders are
-- never updated (0280's rule), so a folder can't be moved and no loop can form. The guard checks, at insert: the parent
-- exists, is in the same company and the same library (company, or the same person's own), and the new folder is at
-- most three levels deep. Archiving a folder (0346) hides what's inside it; that is derived on read (library.ts).

alter table public.library_folders add column if not exists parent_id uuid references public.library_folders(id);
create index if not exists library_folders_parent_idx on public.library_folders (parent_id);

create or replace function public.rss_guard_folder_parent() returns trigger
  language plpgsql set search_path = public as $$
declare
  p record;
  depth integer := 1;
  cur uuid := new.parent_id;
begin
  if new.parent_id is null then return new; end if;
  select company_id, owner_id, is_company into p from library_folders where id = new.parent_id;
  if not found then raise exception 'RSS: that parent folder does not exist'; end if;
  if p.company_id <> new.company_id or p.is_company <> new.is_company or (not new.is_company and p.owner_id <> new.owner_id) then
    raise exception 'RSS: a folder goes inside a folder of the same library';
  end if;
  while cur is not null loop
    depth := depth + 1;
    if depth > 3 then raise exception 'RSS: folders go at most three levels deep'; end if;
    select parent_id into cur from library_folders where id = cur;
  end loop;
  return new;
end $$;
drop trigger if exists rss_guard_folder_parent on public.library_folders;
create trigger rss_guard_folder_parent before insert on public.library_folders
  for each row execute function public.rss_guard_folder_parent();
