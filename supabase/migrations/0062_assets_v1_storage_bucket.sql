-- 0062 — Create the assets-v1 Supabase Storage bucket + policies.
--
-- Per 2026-06-19 founder report ("Storage upload failed: Bucket not
-- found"). The bucket creation was previously documented as a
-- COMMENT in migration 0057 with the words "Phase 0 manual step
-- (one-time after applying this migration)". That was a footgun —
-- left the project in a state where Phase 0 'ran' but uploads
-- failed in production until someone remembered to also run the
-- block from the comment. This migration moves the bucket setup
-- into executable SQL so it ships with the chain instead of
-- depending on operator memory.
--
-- Constitutional sources (§0.1 precondition):
--   • §A12 (migrations safe-to-re-run by construction) — every
--     INSERT uses ON CONFLICT DO NOTHING; every DROP POLICY uses
--     IF EXISTS; every CREATE POLICY is replaced via DROP-then-
--     CREATE so re-running the migration produces the same state.
--   • §0 (Understanding precedes solving) — the failure was an
--     incomplete schema, not a missing feature. The fix is closing
--     the schema, not adding a workaround in application code.
--   • §A14 (data path complete ≠ render path complete) — the
--     application code's upload path (uploadAssetBytes) assumed
--     the bucket existed. Render path was complete; data path
--     (the bucket) was not. This migration closes the gap.
--
-- After this migration:
--   - Bucket assets-v1 exists (private; not listed in public bucket
--     listings)
--   - file_size_limit = 25 MB (matches the AGENT_MAX_BYTES const
--     in src/lib/storage/assets.ts)
--   - Storage RLS allows authenticated users to upload + read
--     objects whose path starts with their company_id; service
--     role bypasses RLS (used by createAdminClient paths like
--     the customer-widget upload route).

-- ─── (1) Create the bucket ───────────────────────────────────
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) values (
  'assets-v1',
  'assets-v1',
  false,                  -- private; access via signed URLs
  26214400,               -- 25 MB; matches AGENT_MAX_BYTES
  null                    -- no MIME restriction at bucket layer;
                          -- the application enforces stricter
                          -- per-source caps (10 MB for customer
                          -- widget, agent allow-list, etc.)
)
on conflict (id) do nothing;

-- ─── (2) RLS on storage.objects for this bucket ──────────────
-- The bucket is private. Reads happen via signed URLs (no RLS check
-- required for the URL itself once issued). Writes need explicit
-- policies for authenticated users.
--
-- Path convention (per src/lib/storage/assets.ts buildStoragePath):
--   {companyId}/{YYYY}/{MM}/{fileId}.ext
--
-- The first path segment is the uploader's company_id. We use
-- (storage.foldername(name))[1] to extract it and compare against
-- auth_company_id() (from migration 0004's helper).

-- 2a. authenticated users can INSERT objects into their company's path
drop policy if exists "assets-v1: authenticated INSERT into own company path"
  on storage.objects;
create policy "assets-v1: authenticated INSERT into own company path"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'assets-v1'
    and (storage.foldername(name))[1] = auth_company_id()::text
  );

-- 2b. authenticated users can SELECT objects in their company's path
-- (used in case the application layer reads metadata; signed URLs
-- already bypass this for content download)
drop policy if exists "assets-v1: authenticated SELECT in own company path"
  on storage.objects;
create policy "assets-v1: authenticated SELECT in own company path"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'assets-v1'
    and (storage.foldername(name))[1] = auth_company_id()::text
  );

-- 2c. Service role does NOT need a policy — service_role bypasses
-- RLS unconditionally. The customer-widget upload path uses the
-- service-role client (createAdminClient) since the customer has
-- no auth.users row. That path is authorized by the conversation
-- session token check in the API route, not by storage RLS.

-- ─── (3) NO DELETE policy ────────────────────────────────────
-- Per §3.1 — append-only. Deprecated files keep their bytes; the
-- files.deprecated_at column is the soft-delete signal. If an
-- operator needs to hard-delete (legal hold release, GDPR delete),
-- they do so via the Supabase dashboard with service-role access,
-- which bypasses RLS. No application-layer DELETE path exists.

-- ─── End migration 0062. ────────────────────────────────────
