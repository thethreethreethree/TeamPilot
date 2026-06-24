-- 0064 — Per-tenant AI name customization + public widget-logos bucket.
-- (Renumbered from a draft 0063 after the urgent RLS-recursion fix
-- took 0063 on 2026-06-20.)
--
-- Per 2026-06-19 founder direction: Haqqy Life (pilot tenant) needs
-- to (a) rename the AI agent from the default "Jeff" to whatever
-- they want, and (b) upload a brand logo / icon to display in
-- their widget. Brand color is already configurable via
-- care_tenant_config.widget_color from 0038.
--
-- Constitutional sources (§0.1 precondition):
--   • §A12 — every CREATE / ALTER / INSERT is idempotent.
--     ADD COLUMN IF NOT EXISTS, ON CONFLICT DO NOTHING.
--   • §3.4 (no instant results) — the agent name is per-tenant
--     data; not a hardcoded behavior. Each tenant gets a default
--     ('Jeff') that they can rewrite. Day-one behavior derives
--     from the tenant's own data once they edit it.
--   • §A11 (System counts; user decides) — the AI name affects
--     how the AI introduces itself; per-tenant naming makes the
--     introduction a tenant choice, not a System assertion.
--
-- Pre-ship outside-perspective audit (per the 2026-06-19
-- addendum) surfaced a HIGH-severity adversary finding: a
-- tenant admin could rename their AI to a string containing
-- newlines + 'FORGET PRIOR INSTRUCTIONS' to inject into the
-- LLM system prompt. The CHECK constraint below is the
-- defense-in-depth at the data layer; the API layer also
-- sanitizes (see the save endpoint).

-- ─── (1) ai_name column on care_tenant_config ────────────────
alter table care_tenant_config
  add column if not exists ai_name text not null default 'Jeff';

-- Prompt-injection defense: reject newlines / tabs / control
-- characters in the AI name, and cap at 50 chars. A tenant who
-- needs a longer agent name in v2 can come ask; the principle
-- is that this column embeds into an LLM system prompt and
-- must therefore stay inert at the data layer.
alter table care_tenant_config
  drop constraint if exists care_tenant_config_ai_name_safe;
alter table care_tenant_config
  add constraint care_tenant_config_ai_name_safe
  check (
    char_length(ai_name) between 1 and 50
    and ai_name !~ '[[:cntrl:]]'
  );

comment on column care_tenant_config.ai_name is
  'Per-tenant name for the customer-facing AI agent. Used in the
   widget greeting ("Hi, my name is <ai_name>.") and woven into
   the LLM system prompt so the AI introduces itself consistently.
   Default Jeff (ELOSTATE''s pilot name); white-label tenants
   rename via /dashboard/care/settings/widget.';

-- ─── (2) Create the widget-logos PUBLIC bucket ───────────────
-- This bucket holds tenant brand logos / icons that get shown in
-- the customer-facing widget. Because the widget runs on the
-- tenant's customer site (unauthenticated visitor), the bucket
-- must be public so the icon URL works without a signed token.
--
-- Path convention: {companyId}/{filename}
-- 2 MB max — icons should be small (PNG/SVG/JPG).
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) values (
  'widget-logos',
  'widget-logos',
  true,                     -- public read; customer widget loads via direct URL
  2097152,                  -- 2 MB; icons should be small
  array[
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/svg+xml',
    'image/webp',
    'image/x-icon',
    'image/vnd.microsoft.icon'
  ]
)
on conflict (id) do nothing;

-- ─── (3) RLS on widget-logos ─────────────────────────────────
-- Public bucket = anyone (anon) can SELECT objects (no policy
-- needed for public read; Supabase handles it automatically when
-- bucket.public = true).
-- Writes need authenticated user whose company_id matches the
-- first path segment.

-- 3a. Authenticated users INSERT into their own company's path
drop policy if exists "widget-logos: authenticated INSERT into own company path"
  on storage.objects;
create policy "widget-logos: authenticated INSERT into own company path"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'widget-logos'
    and (storage.foldername(name))[1] = auth_company_id()::text
  );

-- 3b. Authenticated users UPDATE objects in their own company's path
-- (used by the upsert: upload helper to replace an existing logo
-- when a tenant uploads a new one without removing the old object
-- separately)
drop policy if exists "widget-logos: authenticated UPDATE own company path"
  on storage.objects;
create policy "widget-logos: authenticated UPDATE own company path"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'widget-logos'
    and (storage.foldername(name))[1] = auth_company_id()::text
  );

-- 3c. Authenticated users DELETE objects in their own company's path
-- (used when tenant clears their logo)
drop policy if exists "widget-logos: authenticated DELETE own company path"
  on storage.objects;
create policy "widget-logos: authenticated DELETE own company path"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'widget-logos'
    and (storage.foldername(name))[1] = auth_company_id()::text
  );

-- ─── End migration 0064. ────────────────────────────────────
