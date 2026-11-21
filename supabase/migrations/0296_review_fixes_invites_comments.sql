-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 0296 — fixes from the second outside-view security review (2026-11-20, docs/tbc/2026-11-20-rss-p9/check.md)
-- ═════════════════════════════════════════════════════════════════════════════════════════════
--
-- 1. HIGH — a non-admin could set someone's manager through 0288. The trigger trusted invited_by and accepted_by, but
--    any company member may UPDATE an invitation (0008:100), the immutability trigger did not cover manager_id and lets
--    accepted_at/accepted_by be written, and the insert policy never checked invited_by. So a member could forge an
--    admin as inviter (or edit manager_id on an admin's invitation), then mark it accepted by a manager-less rep, and
--    the definer trigger would attach that rep under a manager of their choosing — widening who sees the rep's calls.
--    Three independent closes, so no single one has to be right:
--      a. the trigger applies the manager only when the person accepting IS the signed-in caller and their auth email
--         matches the invitation's (exactly what accept_invitation, 0114, enforces) — a forged accepted_by cannot pass;
--      b. manager_id joins the immutability trigger: it cannot change after the invitation is created;
--      c. the insert policy requires invited_by = auth.uid() (the only app writer, createInvitation, already does).
-- 2. MEDIUM — a 'named' comment could be saved while its mentions failed (two inserts, no transaction): the comment
--    then reads as sent while nobody but the author can open it. rss_insert_comment writes both in one transaction.
-- 3. LOW — rss_comment_base_visible answered for any viewer. It now answers only for the caller, or for the service
--    role (the comment route), like rss_can_view_rep.
-- Idempotent (A12). Policies/functions recreated from their latest definitions with only the stated change.
-- ═════════════════════════════════════════════════════════════════════════════════════════════

-- ── 1a ──
create or replace function public.rss_apply_invited_manager() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if new.manager_id is null or new.accepted_by is null or old.accepted_at is not null or new.accepted_at is null then
    return new;
  end if;
  begin
    if new.accepted_by = auth.uid()
       and exists (select 1 from auth.users u where u.id = new.accepted_by
                     and lower(trim(u.email)) = lower(trim(new.email)))
       and exists (select 1 from profiles i where i.id = new.invited_by and i.company_id = new.company_id
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

-- ── 1b ── 0008's trigger, verbatim, plus manager_id.
create or replace function check_invitation_immutability()
returns trigger language plpgsql as $$
begin
  if OLD.company_id is distinct from NEW.company_id then raise exception 'team_invitations.company_id is immutable'; end if;
  if OLD.email is distinct from NEW.email then raise exception 'team_invitations.email is immutable'; end if;
  if OLD.role is distinct from NEW.role then raise exception 'team_invitations.role is immutable'; end if;
  if OLD.code is distinct from NEW.code then raise exception 'team_invitations.code is immutable'; end if;
  if OLD.invited_by is distinct from NEW.invited_by then raise exception 'team_invitations.invited_by is immutable'; end if;
  if OLD.invited_at is distinct from NEW.invited_at then raise exception 'team_invitations.invited_at is immutable'; end if;
  if OLD.manager_id is distinct from NEW.manager_id then raise exception 'team_invitations.manager_id is immutable'; end if;
  if OLD.accepted_at is not null and OLD.accepted_at is distinct from NEW.accepted_at then
    raise exception 'team_invitations.accepted_at cannot be changed after acceptance';
  end if;
  return NEW;
end $$;

-- ── 1c ── 0292's policy, verbatim, plus invited_by = auth.uid().
drop policy if exists "team_invitations - insert" on team_invitations;
create policy "team_invitations - insert" on team_invitations
  for insert with check (
    company_id = auth_company_id()
    and invited_by = auth.uid()
    and (
      not (role = any (admin_roles()))
      or exists (
        select 1 from profiles p
        where p.id = auth.uid() and p.status <> 'removed' and p.role = any (admin_roles())
      )
    )
  );

-- ── 2 ── a comment and its mentions, in one transaction (service role only; the route checks everything first).
create or replace function public.rss_insert_comment(
  p_company uuid, p_pitch uuid, p_author uuid, p_timestamp_s integer, p_body text, p_sent boolean,
  p_visibility text, p_mentions uuid[]
) returns uuid
  language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  insert into recording_comments (company_id, pitch_id, author_id, timestamp_s, body, sent_to_rep, visibility)
  values (p_company, p_pitch, p_author, p_timestamp_s, p_body, p_sent, coalesce(p_visibility, 'everyone'))
  returning id into v_id;
  if p_mentions is not null and cardinality(p_mentions) > 0 then
    insert into recording_comment_mentions (company_id, comment_id, user_id)
    select p_company, v_id, m from unnest(p_mentions) m;
  end if;
  return v_id;
end $$;
revoke all on function public.rss_insert_comment(uuid, uuid, uuid, integer, text, boolean, text, uuid[]) from public, anon, authenticated;
grant execute on function public.rss_insert_comment(uuid, uuid, uuid, integer, text, boolean, text, uuid[]) to service_role;

-- ── 3 ── 0293's function plus the caller guard.
create or replace function public.rss_comment_base_visible(viewer uuid, p_pitch uuid, p_sent boolean) returns boolean
  language sql stable security definer set search_path = public as $$
  select (auth.uid() is null or viewer = auth.uid()) and exists (
    select 1
    from pitch_scores p
    join profiles v on v.id = viewer
    where p.id = p_pitch
      and v.company_id = p.company_id
      and v.status <> 'removed'
      and (
        (p.rep_id = viewer and p_sent)
        or (
          (v.role = any (admin_roles()) or v.sales_coach_role = 'admin')
          and (not rss_tree_active(p.company_id) or rss_can_view_rep(viewer, p.rep_id))
        )
      )
  )
$$;
