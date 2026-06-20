-- 0065 — Finish breaking the files ↔ file_access_grants RLS cycle.
--
-- Honest accounting: migration 0063 was INCOMPLETE. I tightened
-- file_access_grants_select to grantee-only but left
-- file_access_grants_write as `for all` with a USING clause that
-- references files. That USING applies to SELECT operations on
-- file_access_grants (since `for all` covers all ops), and RLS
-- OR's permissive policies — so the visibility check on
-- file_access_grants includes BOTH policies. The write policy's
-- USING re-introduces the EXISTS-on-files cycle:
--
--   files_select
--     -> EXISTS file_access_grants
--       -> (file_access_grants_select OR file_access_grants_write USING)
--         -> file_access_grants_write USING: EXISTS files
--           -> files_select  ← back to start
--
-- The founder ran 0063, attempted a file upload, and got the same
-- 'infinite recursion detected in policy for relation "files"'.
-- Honest cause: I missed the `for all` semantics in the prior audit.
--
-- Fix: replace file_access_grants_write (`for all`) with separate
-- INSERT and DELETE policies. Neither applies to SELECT, so the
-- SELECT visibility on file_access_grants is determined solely by
-- file_access_grants_select (grantee-only, no files reference).
-- The cycle is closed.
--
-- UPDATE is intentionally omitted — file_access_grants rows are
-- immutable by design (file_id / profile_id / granted_by /
-- granted_at). Revoking a grant = DELETE. Re-granting = re-INSERT.
-- This matches §3.1 (append-only chain) for the access surface.
--
-- Constitutional sources (§0.1):
--   • §A12 — every DROP IF EXISTS + CREATE POLICY is idempotent.
--   • §A14 — the previous audit walked render branches but missed
--     that the WRITE policy's USING clause also gates SELECT
--     under `for all` semantics. A14's "data path complete ≠
--     render path complete" applies to RLS policy graphs too:
--     the cycle wasn't in the SELECT policy I rewrote; it was
--     in the WRITE policy's USING. Render branch missed.
--   • §0 — understanding precedes solving. 0063 solved the
--     wrong half. This solves the actual cycle.

-- ─── Drop the cycle-causing for-all policy ───────────────────
drop policy if exists file_access_grants_write on file_access_grants;

-- ─── Re-create as separate INSERT + DELETE ───────────────────
-- INSERT: only the file's uploader or a company admin can grant
-- access. The WITH CHECK references files but is ONLY evaluated
-- on INSERT, not on SELECT. files_select evaluated inside the
-- EXISTS subquery sees only the file_access_grants_select policy
-- now (no recursion via the WRITE USING anymore).
create policy file_access_grants_insert on file_access_grants
  for insert
  with check (
    exists (
      select 1 from files
      where files.id = file_access_grants.file_id
        and (
          files.uploader_id = auth.uid()
          or exists (
            select 1 from profiles
            where id = auth.uid()
              and company_id = files.company_id
              and role in ('CEO', 'COO', 'admin')
          )
        )
    )
  );

-- DELETE: same authorization — uploader or company admin. USING
-- here applies only to DELETE, not to SELECT.
create policy file_access_grants_delete on file_access_grants
  for delete
  using (
    exists (
      select 1 from files
      where files.id = file_access_grants.file_id
        and (
          files.uploader_id = auth.uid()
          or exists (
            select 1 from profiles
            where id = auth.uid()
              and company_id = files.company_id
              and role in ('CEO', 'COO', 'admin')
          )
        )
    )
  );

-- (No UPDATE policy — rows are immutable.)

comment on policy file_access_grants_insert on file_access_grants is
  '2026-06-20: split from the for-all WRITE policy to break the
   RLS recursion with files_select. WITH CHECK references files
   but only fires on INSERT.';

comment on policy file_access_grants_delete on file_access_grants is
  '2026-06-20: split from the for-all WRITE policy to break the
   RLS recursion with files_select. USING references files but
   only fires on DELETE, never on SELECT.';

-- ─── End migration 0065. ────────────────────────────────────
