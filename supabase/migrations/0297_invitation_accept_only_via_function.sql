-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 0297 — an invitation is accepted only through accept_invitation (residual from the second review, OPEN.md 2026-11-21)
-- ═════════════════════════════════════════════════════════════════════════════════════════════
--
-- 0008's update policy lets any company member update an invitation (company_id = auth_company_id()), and the
-- immutability trigger allowed accepted_at / accepted_by to be written once. So a member could mark someone else's
-- pending invitation accepted straight through PostgREST: since 0296 that moves nobody's manager, but the invitation
-- then reads as accepted and its code stops working (a quiet denial of someone's invite).
--
-- Why not narrow the update policy instead: revocation runs on the caller's client — PATCH /api/team and
-- createInvitation's auto-revoke of an EXPIRED invitation, which a non-admin inviting a Member/Lead reaches. Narrowing
-- the policy would break that. The defect is the accepted_* columns, so the guard is on those columns.
--
-- The only legitimate writer of accepted_* is accept_invitation (0114, SECURITY DEFINER): inside it current_user is the
-- function owner. A direct write arrives as 'authenticated' / 'anon'. check_invitation_immutability is SECURITY INVOKER,
-- so it sees the caller's role and refuses there. The service role (scripts, support) is unaffected.
--
-- 0296's function, verbatim, plus the one accepted_* clause. Idempotent (A12).
-- ═════════════════════════════════════════════════════════════════════════════════════════════

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
  if (OLD.accepted_at is distinct from NEW.accepted_at or OLD.accepted_by is distinct from NEW.accepted_by)
     and current_user in ('authenticated', 'anon') then
    raise exception 'team_invitations: an invitation is accepted only through accept_invitation';
  end if;
  return NEW;
end $$;
