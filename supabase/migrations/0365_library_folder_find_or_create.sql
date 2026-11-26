-- 0365 — find or make one level of a library folder path, atomically (2026-11-26; review of 0363). Idempotent (A12).
--
-- Saving into "Objections / Pricing" found each level by name and made it if missing, in separate requests: two people
-- saving into the same new path at the same moment could each make it, leaving two "Pricing" side by side. This does
-- both in one statement under the library's advisory lock (0363's rss_folder_library_lock — the same lock the create
-- and move guards take), matching names without case or edge spaces as the move guard does, by CURRENT parent (0360).
-- Called by /api/coach/remote/library with the service role only; returns the folder's id.

create or replace function public.rss_library_folder_find_or_create(
  p_company uuid, p_owner uuid, p_is_company boolean, p_parent uuid, p_name text
) returns uuid
  language plpgsql security definer set search_path = public as $$
declare
  found_id uuid;
begin
  perform public.rss_folder_library_lock(p_company, p_is_company, p_owner);
  select f.id into found_id
    from public.library_folders f
   where f.company_id = p_company and f.is_company = p_is_company and (p_is_company or f.owner_id = p_owner)
     and lower(trim(f.name)) = lower(trim(p_name))
     and public.rss_folder_parent_now(f.id) is not distinct from p_parent
   order by f.created_at asc
   limit 1;
  if found_id is not null then return found_id; end if;
  insert into public.library_folders (company_id, owner_id, is_company, name, parent_id)
  values (p_company, p_owner, p_is_company, trim(p_name), p_parent)
  returning id into found_id;
  return found_id;
end $$;
revoke all on function public.rss_library_folder_find_or_create(uuid, uuid, boolean, uuid, text) from public, anon, authenticated;
grant execute on function public.rss_library_folder_find_or_create(uuid, uuid, boolean, uuid, text) to service_role;
