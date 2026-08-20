-- 0235 — Add-agent upgrade: team passwords + forced first-login password change (2026-08-21, urgent client build).
--
-- Two capabilities for the streamlined "Add agent" flow on the Members page:
--
-- (1) profiles.must_change_password — an admin who adds a brand-new user (no existing account) creates that
--     user's login with a shared TEAM PASSWORD as the initial password (service-role, see the add-member route).
--     The app then forces the new user to set their OWN password on first login, and clears the flag. Guarded
--     below so an end-user cannot self-clear it via direct PostgREST and skip the forced change — which would
--     otherwise leave the SHARED team password (known to others) live on their account. Cleared ONLY when the
--     password is actually reset, through the service-role set-password route.
--
-- (2) team_passwords — an admin-managed, TITLED, DISTRIBUTABLE shared credential. The admin creates one (or
--     several, each titled), views it to hand out to the team, can change it, and can soft-delete it. The picked
--     one becomes a new user's initial login password. The secret is admin-VIEWABLE by design (it is a shared
--     join credential the admin distributes, like a Wi-Fi password), so it is stored recoverably — but access is
--     locked to service-role behind an admin-gated route: RLS denies ALL direct authenticated/anon access.
--     (Encryption-at-rest is a documented hardening follow-up; the boundary today is RLS + service-role + the
--     admin gate.)

-- ---- (1) must_change_password + its guard --------------------------------------------------------------------
alter table profiles
  add column if not exists must_change_password boolean not null default false;

-- Isolated guard (deliberately NOT folded into the critical 0090/0091 authz-column guard, to avoid touching that
-- security-load-bearing function). Freezes must_change_password against direct end-user UPDATE; definer RPCs and
-- service-role (current_user = the service role, not 'authenticated'/'anon') pass untouched.
create or replace function guard_must_change_password()
returns trigger language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user in ('authenticated', 'anon')
     and NEW.must_change_password is distinct from OLD.must_change_password then
    raise exception 'profiles.must_change_password is system-managed (cleared only when the password is actually reset)';
  end if;
  return NEW;
end;
$$;

drop trigger if exists profiles_guard_must_change_password on profiles;
create trigger profiles_guard_must_change_password
  before update on profiles
  for each row execute function guard_must_change_password();

-- ---- (2) team_passwords ---------------------------------------------------------------------------------------
create table if not exists team_passwords (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  secret text not null check (char_length(secret) between 8 and 200),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists team_passwords_company_active_idx
  on team_passwords(company_id) where revoked_at is null;

alter table team_passwords enable row level security;
-- No policies → RLS denies every authenticated/anon read+write. Only the service-role client (used by the
-- admin-gated /api/team/passwords route) bypasses RLS. Revoke table grants too (belt-and-braces: a grant without
-- a policy is already inert under RLS, but the codebase convention is to revoke from public AND the roles).
revoke all on team_passwords from anon, authenticated, public;
