-- 0239 — Team invitations: allow inviting a new person DIRECTLY at an org tier (R1 of the team reorg).
--
-- Stages 1-2 (ea6c809f, 3af03607) ordered every roster by the 6-tier hierarchy and made the tiers
-- ASSIGNABLE to EXISTING members (/api/team/set-role). This closes the deferred half: a brand-new person
-- could only be invited as CEO/COO/Lead/Member (the 0008 CHECK), forcing invite-as-Member → reassign. This
-- widens the CHECK to the 8 assignable tier roles (roles.ts ORG_ROLE_OPTIONS) + legacy 'Lead', so invites
-- can name any tier.
--
-- SECURITY RIPPLE (§2.2 / A40): 0141 gates ADMIN-role invites (CEO/COO — accepting one grants company-admin
-- per 0114) behind "caller is already admin". 'CFO' was folded into ADMIN_ROLES (roles.ts, 2026-08-29), so
-- making CFO invitable WITHOUT adding it here would let any Member mint a CFO invite and escalate to admin —
-- re-opening exactly the hole 0141 closed. 0141 hardcoded ('CEO','COO'); that re-derived copy of ADMIN_ROLES
-- must gain CFO. Kept in lockstep with roles.ts ADMIN_ROLES = {CEO,CFO,COO,admin} (the invitable-admin subset
-- is {CEO,CFO,COO} — 'admin' is the onboarding-only, non-invitable bootstrap role).
--
-- Idempotent (drop-before-create). NOTE for the enumConstraintSync drift-guard: the CHECK statement below is
-- intentionally the FIRST role-membership list in this file (the test's regex would otherwise capture the
-- policy's caller-admin role list further down), and the test is repinned from 0008 to 0239. This comment
-- deliberately avoids writing the parenthesised membership syntax so the regex can't match the prose.

-- ── 1. Widen the role CHECK (must be the first role-membership list in this file) ──
-- The 0008 inline column CHECK is auto-named team_invitations_role_check. Drop it and add the widened set.
-- 'Lead' is retained (legacy invitation rows may hold it; dropping it would fail the ALTER's row validation).
alter table team_invitations drop constraint if exists team_invitations_role_check;
alter table team_invitations
  add constraint team_invitations_role_check
  check (role in ('CEO','CFO','COO','VP','Director','Manager','Supervisor','Lead','Member'));

-- ── 2. Extend the 0141 privilege-escalation guard to CFO ──
drop policy if exists "team_invitations - insert" on team_invitations;
create policy "team_invitations - insert" on team_invitations
  for insert with check (
    company_id = auth_company_id()
    and (
      -- non-admin roles: any company member may invite (mirrors ADMIN_ROLES minus the invitable-admin subset)
      role not in ('CEO', 'CFO', 'COO')
      -- admin roles (CEO/CFO/COO): only an existing admin may assign
      -- (keep in lockstep with roles.ts ADMIN_ROLES = CEO/CFO/COO/admin)
      or exists (
        select 1 from profiles p
        where p.id = auth.uid() and p.role in ('CEO', 'CFO', 'COO', 'admin')
      )
    )
  );
