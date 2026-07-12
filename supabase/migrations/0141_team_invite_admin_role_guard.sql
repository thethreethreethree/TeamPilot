-- 0141 — SECURITY (HIGH): close a privilege-escalation hole in team invitations.
--
-- Finding (audit 2026-07-13): CEO/COO are both INVITABLE_ROLES and ADMIN_ROLES (src/lib/roles.ts),
-- and accepting a CEO/COO invitation grants company-admin (see 0114). The team_invitations INSERT
-- policy from 0008 only checked `company_id = auth_company_id()` — it never checked the CALLER's
-- role. Combined with POST /api/team having no app-level admin gate (fixed in the same change), ANY
-- plain Member could insert a CEO/COO invitation for their company and escalate a proxy account to
-- admin. This is the RLS backstop for the direct-Supabase-client path (the API route is gated too).
--
-- Fix: a non-admin may still create NON-admin-role invites (Member/Lead), but assigning an ADMIN
-- role (CEO/COO) now requires the caller to already be an admin (CEO/COO/admin) of the company.
-- Idempotent (drop-before-create).

drop policy if exists "team_invitations - insert" on team_invitations;
create policy "team_invitations - insert" on team_invitations
  for insert with check (
    company_id = auth_company_id()
    and (
      -- non-admin roles: any company member may invite
      role not in ('CEO', 'COO')
      -- admin roles (CEO/COO): only an existing admin may assign
      or exists (
        select 1 from profiles p
        where p.id = auth.uid() and p.role in ('CEO', 'COO', 'admin')
      )
    )
  );

-- Note: role is immutability-locked after insert (0008 trigger) + email-locked (0114), so an
-- attacker cannot insert a Member invite then flip it to CEO — the role is fixed at insert time,
-- which is exactly where this check now bites.
