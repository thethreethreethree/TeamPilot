-- 0063 — Break the RLS recursion between files and
-- file_access_grants.
--
-- Diagnosed 2026-06-20 from founder report: every files.insert
-- failed with "infinite recursion detected in policy for relation
-- 'files'". The cycle (introduced in migration 0057):
--
--   files_select (specific_people branch)
--     → EXISTS on file_access_grants
--     → file_access_grants_select
--       → EXISTS on files
--         → files_select          ← back to start
--
-- Postgres detects this and refuses. Any operation that returns a
-- row from files (including INSERT … RETURNING) trips it.
--
-- Constitutional sources (§0.1 precondition):
--   • §A12 — every policy change uses DROP IF EXISTS then CREATE,
--     safe to re-run regardless of current DB state.
--   • §A14 — the recursion was a render-path failure for the
--     SELECT-returning-from-INSERT path. The data path (the
--     INSERT itself) succeeded; the post-INSERT row read failed
--     because the policy graph was unsound. Closing the cycle
--     restores the render path.
--   • §0 — the failure is a structural unsoundness in the policy
--     graph, not a missing feature. Fix the structure, not the
--     symptom.
--
-- Trade-off taken
-- ───────────────
-- file_access_grants_select tightens to "you see grants where you
-- ARE the grantee." The previous policy also let the file's
-- uploader see grants on their own files (via the cyclic EXISTS).
-- That capability moves to the application layer: the
-- /api/files/[id]/access GET route now uses the admin client with
-- an explicit "caller must be uploader OR admin" auth check, which
-- is a stronger authorization (verified at the route, not by RLS)
-- AND has no risk of cycles.
--
-- All other access semantics preserved:
--   - files_select still gates via uploader / role / specific_people
--     (the EXISTS subquery now sees only the caller's OWN grants,
--     which is sufficient — the file is visible to them iff they
--     are a grantee)
--   - file_access_grants_write unchanged (uploader-or-admin INSERT/
--     DELETE on grants via the user-scoped client; the EXISTS on
--     files there triggers files_select, which after this fix has
--     no recursion since file_access_grants_select no longer
--     references files)

drop policy if exists file_access_grants_select on file_access_grants;

create policy file_access_grants_select on file_access_grants
  for select
  using (
    profile_id = auth.uid()
  );

comment on policy file_access_grants_select on file_access_grants is
  '2026-06-20: tightened to grantee-only to break the RLS
   recursion with files_select. File-owners viewing their own
   file''s grants now route through /api/files/[id]/access GET
   which uses the admin client with explicit auth-context check.';

-- ─── End migration 0063. ────────────────────────────────────
