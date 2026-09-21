-- A12 RE-RUNNABILITY GUARDS ADDED 2026-09-21. The statements below this line are the original
-- migration; the only change is that object creations are now guarded (drop-if-exists before
-- create policy/trigger, existence checks around create type, if-not-exists on indexes,
-- drop-before-create on views). NOTHING about the resulting schema changed — verified by
-- applying all 254 migrations twice against Postgres 16: 0 failures on a fresh database.
--
-- WHY AN APPLIED MIGRATION WAS EDITED. A12 (0021 and 0022 both failed live on "already
-- exists") requires migrations to be safe-to-re-run BY CONSTRUCTION. 18 of these were not, and
-- a later migration cannot fix an earlier one — on any replay 0001 still runs first. Tested:
-- a repair migration leaves 0001 failing exactly as before. Editing in place is the only thing
-- that reaches zero. Supabase never re-runs an applied migration, so production is untouched.
-- Founder decision, 2026-09-21. Record: docs/tbc/2026-09-21-migration-idempotency/.

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

drop policy if exists "team_invitations - delete" on team_invitations;
create policy "team_invitations - delete" on team_invitations
  for delete using (company_id = auth_company_id());
