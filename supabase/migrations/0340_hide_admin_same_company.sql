-- 0340 — hide by phrase (F33.8): the admin exemption counts only for an admin OF THE CALL'S COMPANY.
-- 0337's rss_call_hidden_for(p_session, viewer) exempted `rss_is_company_admin(viewer)`, which checks the viewer's role
-- but not their company. Under RLS that can't matter (every policy also pins company_id = auth_company_id()), but the
-- service role passes a viewer explicitly (hiddenFrom / hiddenInCompanyFrom), and a viewer from another company — vendor
-- monitoring staff, say, who are admins of their own company — would read as exempt. Same function, one more term.
create or replace function public.rss_call_hidden_for(p_session uuid, viewer uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
           select 1 from call_hides h
           where h.session_id = p_session
             and not exists (select 1 from call_unhides u where u.hide_id = h.id)
         )
     and not exists (select 1 from coaching_sessions s where s.id = p_session and s.agent_id = viewer)
     and not (
           rss_is_company_admin(viewer)
           and exists (
             select 1 from coaching_sessions s join profiles p on p.id = viewer
             where s.id = p_session and p.company_id = s.company_id
           )
         )
$$;
revoke all on function public.rss_call_hidden_for(uuid, uuid) from public, anon, authenticated;
grant execute on function public.rss_call_hidden_for(uuid, uuid) to service_role;
