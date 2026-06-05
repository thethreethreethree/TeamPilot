-- 0017 — team_invitations DELETE policy (RLS gap fix)
--
-- Why
-- ───
-- Migration 0008 added team_invitations with policies for select /
-- insert / update — but not delete. The §1.7 rls-audit script caught
-- this. Without a delete policy, an admin trying to revoke an
-- outstanding invitation gets silent failure: the DELETE returns "ok"
-- with 0 rows affected (Postgres RLS denies the operation but doesn't
-- raise; same failure mode as the chat_pins gap fixed in 0016).
--
-- Scope
-- ─────
-- Aligned with the existing update policy: any current participant /
-- member of the company can revoke. We do NOT restrict to "only the
-- inviter can revoke" because invitations are organizational artifacts
-- (the constitution treats team membership as company-scoped, not
-- inviter-scoped), and limiting revocation to the inviter would
-- strand invites if that inviter leaves.

create policy "team_invitations - delete" on team_invitations
  for delete using (company_id = auth_company_id());
