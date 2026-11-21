-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 0288 — an invitation can carry who the person will report to (RSS Phase 9 follow-up; Gong F2.8)
-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- The CSV team import names managers. For someone already on the team it sets manager_id at once; for someone being
-- invited there was no person to attach it to, so the admin had to come back after they joined. Now the invitation
-- carries manager_id, and accepting applies it.
--
-- WHO MAY: only admins set managers (/api/team/set-manager). Any member may create a non-admin invitation, and the
-- invitation insert policy (0008/0141) does not look at this new column, so the trigger applies it ONLY when the
-- invitation's inviter is a company admin — otherwise a member could pre-assign a newcomer to a manager of their
-- choosing. And only if the manager is still an active member of that company. The loop/company guard (0272) still runs.
--
-- accept_invitation (0114) is NOT changed: joining must never fail because of this. The trigger fires after the
-- invitation is stamped accepted, and any failure is a warning, not an error. SECURITY DEFINER so the privileged-column
-- guard (0090/0091/0272) treats it as the privileged writer it is. Idempotent (A12).
-- ═════════════════════════════════════════════════════════════════════════════════════════════

alter table public.team_invitations add column if not exists manager_id uuid references public.profiles(id) on delete set null;

create or replace function public.rss_apply_invited_manager() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if new.manager_id is null or new.accepted_by is null or old.accepted_at is not null or new.accepted_at is null then
    return new;
  end if;
  begin
    if exists (select 1 from profiles i where i.id = new.invited_by and i.company_id = new.company_id
                 and i.role = any (admin_roles()) and i.status <> 'removed')
       and exists (select 1 from profiles m where m.id = new.manager_id and m.company_id = new.company_id
                     and m.status = 'active') then
      update profiles set manager_id = new.manager_id
       where id = new.accepted_by and company_id = new.company_id and manager_id is null;
    end if;
  exception when others then
    raise warning 'rss_apply_invited_manager skipped for invitation %: %', new.id, sqlerrm;
  end;
  return new;
end $$;
revoke all on function public.rss_apply_invited_manager() from public, anon, authenticated;
drop trigger if exists rss_apply_invited_manager on public.team_invitations;
create trigger rss_apply_invited_manager after update of accepted_at on public.team_invitations
  for each row execute function public.rss_apply_invited_manager();
