-- 0193_care_acms_knowledge.sql
--
-- ACMS (Adaptive Customer Management System) — client-uploaded knowledge documents.
--
-- WHAT. A per-tenant store of markdown knowledge a business uploads so their
-- customer-facing C.A.R.E AI answers from THEIR facts (services, hours, pricing,
-- policies, FAQs). Founder-scoped decisions (2026-07-25), locked before build:
--   ① KNOWLEDGE ONLY — this content is DATA the AI answers from, never
--      instructions that change how it behaves. The prompt layer fences it as
--      untrusted reference (src/lib/care/prompt.ts). This migration stores it;
--      it does NOT grant it behavioral authority.
--   ② APPEND-ONLY VERSIONS (§3.1) — every upload is an immutable version row.
--      "Current knowledge" = the latest version per company; a company turns
--      knowledge off by uploading a version with status='retracted'. Content is
--      never edited in place — you append a new version.
--   ③ Upload-driven (the route validates + inserts). ④ Customer-facing AI first.
--
-- APPEND-ONLY ENFORCEMENT — deliberately a CONTENT-IMMUTABILITY TRIGGER, NOT a
-- blanket `do instead nothing` rule. On 2026-07-25 the blanket append-only RULES
-- on other event tables were found to COLLIDE with `on delete set null` FKs to
-- profiles and block user deletion (GDPR erasure) across five tables. This table
-- FKs `created_by -> profiles(id) on delete set null`; the trigger below freezes
-- the content columns but PERMITS `created_by` to be nulled, so deleting a user
-- anonymizes the author without the append-only guard blocking the cascade. This
-- mirrors the decision_dialogues immutability trigger (0003), not the rule (0035).
--
-- Idempotent by construction (A12): create-if-not-exists, or-replace, drop-if-exists.

create extension if not exists pgcrypto;

create table if not exists care_knowledge_documents (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies(id) on delete cascade,
  version       integer not null,
  title         text not null,
  filename      text,
  -- The business's markdown. UNTRUSTED reference DATA — the prompt layer fences
  -- it and the AI's honesty/handoff rules are reasserted after it. Never treated
  -- as instructions. Capped at ~200k chars to bound prompt-token cost.
  content       text not null check (char_length(content) <= 200000),
  content_hash  text not null,
  byte_size     integer not null,
  status        text not null default 'active' check (status in ('active', 'retracted')),
  created_by    uuid references profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  unique (company_id, version)
);

create index if not exists care_knowledge_documents_current_idx
  on care_knowledge_documents (company_id, version desc);

-- Content-immutability trigger (append-only, §3.1) — freezes the content columns
-- but allows created_by -> NULL so user deletion / erasure is never blocked.
create or replace function check_care_knowledge_immutability()
returns trigger language plpgsql as $$
begin
  if (NEW.content      is distinct from OLD.content)
     or (NEW.title       is distinct from OLD.title)
     or (NEW.filename    is distinct from OLD.filename)
     or (NEW.company_id  is distinct from OLD.company_id)
     or (NEW.version     is distinct from OLD.version)
     or (NEW.content_hash is distinct from OLD.content_hash)
     or (NEW.byte_size   is distinct from OLD.byte_size)
     or (NEW.status      is distinct from OLD.status)
     or (NEW.created_at  is distinct from OLD.created_at)
  then
    raise exception 'care_knowledge_documents is append-only — upload a new version instead of editing (id=%)', OLD.id;
  end if;
  return NEW; -- only created_by may change (to NULL, on user deletion)
end $$;

drop trigger if exists care_knowledge_documents_immutable on care_knowledge_documents;
create trigger care_knowledge_documents_immutable
  before update on care_knowledge_documents
  for each row execute function check_care_knowledge_immutability();

-- RLS. Any company member reads their tenant's knowledge; only admins upload
-- (managing what the AI knows is a config-grade action — mirrors care_tenant_config
-- from 0038). No UPDATE/DELETE policy on purpose: append-only is enforced at the
-- RLS layer too (end users cannot mutate), while the trigger is defense-in-depth.
-- Service-role reads (the session-less reply path) bypass RLS by design.
alter table care_knowledge_documents enable row level security;

drop policy if exists "care_knowledge_documents - select" on care_knowledge_documents;
create policy "care_knowledge_documents - select" on care_knowledge_documents
  for select using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.company_id = care_knowledge_documents.company_id
    )
  );

drop policy if exists "care_knowledge_documents - insert" on care_knowledge_documents;
create policy "care_knowledge_documents - insert" on care_knowledge_documents
  for insert with check (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.company_id = care_knowledge_documents.company_id
        and p.role in ('CEO', 'COO', 'admin')
    )
  );

comment on table care_knowledge_documents is
  'ACMS: per-tenant, append-only, client-uploaded markdown KNOWLEDGE (not instructions). Current = latest version per company; retract = append a status=retracted version. Fenced as untrusted reference data at the prompt layer (src/lib/care/prompt.ts). 0193.';
