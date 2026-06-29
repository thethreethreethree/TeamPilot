-- 0074: editable methodology corpus for the Sales Coach.
--
-- WHY: admins can give the post-call REVIEW coach a company-specific
-- methodology (their own books/strategy/tactics) that overrides the
-- built-in books KB / starter. Each company gets its own (§5 — each
-- company has its own personality).
--
-- §3.1 (append-only): a corpus is not a mutable row — every save APPENDS
-- a new version; the current corpus is the latest version for the
-- company. Full edit history is preserved as an asset (§1.1). Enforced by
-- do-instead-nothing rules on update/delete, like coaching_cues.

create table if not exists sales_coach_corpus_versions (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  content     text not null,
  -- Who saved this version (nullable so a removed profile doesn't cascade
  -- away the history).
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists sales_coach_corpus_company_idx
  on sales_coach_corpus_versions (company_id, created_at desc);

-- Append-only (§3.1).
create or replace rule sales_coach_corpus_no_update as
  on update to sales_coach_corpus_versions do instead nothing;
create or replace rule sales_coach_corpus_no_delete as
  on delete to sales_coach_corpus_versions do instead nothing;

alter table sales_coach_corpus_versions enable row level security;

-- Read: any same-company member (the review engine reads via service role
-- and bypasses this; this gates the Settings editor's GET). Mirrors 0070.
drop policy if exists "sales_coach_corpus - select" on sales_coach_corpus_versions;
create policy "sales_coach_corpus - select" on sales_coach_corpus_versions
  for select using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.company_id = sales_coach_corpus_versions.company_id
    )
  );

-- Write: only a company admin OR a Sales Coach admin in that company.
-- The endpoint also gates this; the policy is defense in depth.
drop policy if exists "sales_coach_corpus - insert" on sales_coach_corpus_versions;
create policy "sales_coach_corpus - insert" on sales_coach_corpus_versions
  for insert with check (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.company_id = sales_coach_corpus_versions.company_id
        and (p.role in ('CEO', 'COO', 'admin') or p.sales_coach_role = 'admin')
    )
  );
