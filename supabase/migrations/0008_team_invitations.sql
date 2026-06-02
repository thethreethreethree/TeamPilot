-- 0008 — Team invitations + member lifecycle
--
-- Production team management. Adds:
--   - team_invitations: invite-by-code records with full audit
--   - profiles.status: 'active' | 'removed' so removal is soft and append-only-flavored
--   - Standard CEO/COO/Lead/Member roles, fully self-managed by the company admins
--
-- Onboarding already creates a profile row for the company founder with role='CEO'.
-- This migration adds the structure for that founder to invite others.

-- ─────────────────────────────────────────────────────────────
-- profiles.status — soft deletion
-- ─────────────────────────────────────────────────────────────

alter table profiles
  add column if not exists status text not null default 'active'
    check (status in ('active', 'removed'));
alter table profiles
  add column if not exists removed_at timestamptz;

create index if not exists profiles_company_status_idx
  on profiles (company_id, status);

-- ─────────────────────────────────────────────────────────────
-- team_invitations
-- ─────────────────────────────────────────────────────────────

create table if not exists team_invitations (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references companies(id) on delete cascade,
  email        text not null,
  role         text not null default 'Member'
                check (role in ('CEO','COO','Lead','Member')),
  code         text not null unique,        -- random 32-char code used in invite links
  invited_by   uuid references auth.users(id) on delete set null,
  invited_at   timestamptz not null default now(),
  expires_at   timestamptz not null default (now() + interval '14 days'),
  accepted_at  timestamptz,
  accepted_by  uuid references auth.users(id) on delete set null,
  revoked_at   timestamptz,
  revoked_by   uuid references auth.users(id) on delete set null,
  revoke_reason text
);

create index if not exists team_invitations_company_status_idx
  on team_invitations (company_id, accepted_at, revoked_at, expires_at);

-- A team_invitations row is append-only on the invite metadata (email, role,
-- code, invited_by, invited_at). Only accepted_*, revoked_* may be updated.
create or replace function check_invitation_immutability()
returns trigger language plpgsql as $$
begin
  if OLD.company_id is distinct from NEW.company_id then raise exception 'team_invitations.company_id is immutable'; end if;
  if OLD.email is distinct from NEW.email then raise exception 'team_invitations.email is immutable'; end if;
  if OLD.role is distinct from NEW.role then raise exception 'team_invitations.role is immutable'; end if;
  if OLD.code is distinct from NEW.code then raise exception 'team_invitations.code is immutable'; end if;
  if OLD.invited_by is distinct from NEW.invited_by then raise exception 'team_invitations.invited_by is immutable'; end if;
  if OLD.invited_at is distinct from NEW.invited_at then raise exception 'team_invitations.invited_at is immutable'; end if;
  if OLD.accepted_at is not null and OLD.accepted_at is distinct from NEW.accepted_at then
    raise exception 'team_invitations.accepted_at cannot be changed after acceptance';
  end if;
  return NEW;
end $$;

drop trigger if exists team_invitations_immutable on team_invitations;
create trigger team_invitations_immutable
  before update on team_invitations
  for each row execute function check_invitation_immutability();

-- ─────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────

alter table team_invitations enable row level security;

-- Company members can see and create invitations for their own company.
create policy "team_invitations - select" on team_invitations
  for select using (company_id = auth_company_id());
create policy "team_invitations - insert" on team_invitations
  for insert with check (company_id = auth_company_id());
-- Updates (accept / revoke) require company membership OR the accept_invitation()
-- SQL function below which runs with security definer for the accept path (a
-- prospective member won't be in the company yet).
create policy "team_invitations - update" on team_invitations
  for update using (company_id = auth_company_id());

-- Profiles already have a self-only select/update policy from 0001. Add a
-- company-wide select so members can see each other.
drop policy if exists "company members - select profiles" on profiles;
create policy "company members - select profiles" on profiles
  for select using (company_id = auth_company_id());

-- ─────────────────────────────────────────────────────────────
-- accept_invitation() — security definer so the accepting user can be
-- attached to a company they are not yet a member of.
--
-- The function:
--   1. Looks up the invitation by code
--   2. Validates it: not accepted, not revoked, not expired
--   3. Updates the calling user's profile (creating if it does not exist)
--      to point at the invitation's company with the invitation's role
--   4. Marks the invitation as accepted
-- ─────────────────────────────────────────────────────────────

create or replace function accept_invitation(p_code text, p_full_name text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite   team_invitations;
  v_user_id  uuid;
  v_company_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_invite from team_invitations where code = p_code;
  if v_invite.id is null then
    raise exception 'Invitation not found';
  end if;
  if v_invite.accepted_at is not null then
    raise exception 'Invitation already accepted';
  end if;
  if v_invite.revoked_at is not null then
    raise exception 'Invitation revoked';
  end if;
  if v_invite.expires_at < now() then
    raise exception 'Invitation expired';
  end if;

  v_company_id := v_invite.company_id;

  -- Attach the user to the company.
  insert into profiles (id, company_id, full_name, role, status)
    values (v_user_id, v_company_id, p_full_name, v_invite.role, 'active')
    on conflict (id) do update
      set company_id = excluded.company_id,
          role       = excluded.role,
          status     = 'active',
          full_name  = coalesce(profiles.full_name, excluded.full_name);

  -- Stamp the invitation.
  update team_invitations
    set accepted_at = now(),
        accepted_by = v_user_id
    where id = v_invite.id;

  return v_company_id;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- emit a member.joined event when a profile becomes active in a company
-- ─────────────────────────────────────────────────────────────

create or replace function emit_member_joined_event()
returns trigger
language plpgsql
security invoker
as $$
declare
  v_event_id uuid;
begin
  -- Only on insert OR on transitioning to active from another state.
  if (TG_OP = 'INSERT' and NEW.status = 'active' and NEW.company_id is not null) or
     (TG_OP = 'UPDATE' and NEW.status = 'active' and OLD.status <> 'active' and NEW.company_id is not null) then
    -- We cannot call record_event() here directly because the trigger may run
    -- before auth_company_id() is meaningful for the new joiner. Use a direct
    -- insert with the company_id from the profile row.
    insert into events (company_id, kind, subject, actor, payload)
      values (
        NEW.company_id,
        'member.joined',
        'user:' || NEW.id::text,
        NEW.id,
        jsonb_build_object('role', NEW.role, 'full_name', NEW.full_name)
      )
      returning id into v_event_id;
    perform derive_signals_for_event(v_event_id);
  end if;
  return NEW;
end;
$$;

drop trigger if exists profiles_emit_member_joined on profiles;
create trigger profiles_emit_member_joined
  after insert or update on profiles
  for each row execute function emit_member_joined_event();
