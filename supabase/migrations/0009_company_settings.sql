-- 0009 — Company-level settings (audit Tier 1 #3)
--
-- Adds columns to the companies table for the things the (formerly fake) Settings
-- page promised to manage. This is the production replacement for the §3.3 fake-
-- affordance violation flagged in the 2026-06-02 audit.
--
-- Why columns on companies rather than a separate settings table:
-- the values are 1:1 with the company and rarely change. A separate table would
-- have added an indirection without adding capability.

alter table companies
  add column if not exists goals jsonb not null default '[]'::jsonb,
  add column if not exists timezone text not null default 'UTC',
  -- LLM provider preference, per AMD-003. NULL = use the global env default
  -- (DeepSeek if configured, else Anthropic, else error). 'deepseek' | 'anthropic'.
  add column if not exists llm_provider_preference text
    check (llm_provider_preference in ('deepseek','anthropic')),
  -- The control-window expiry can also be set per-company. The default 30d
  -- from migration 0007 still applies if this is null.
  add column if not exists updated_at timestamptz not null default now();

-- Touch updated_at on any UPDATE so callers can show "last saved" honestly.
create or replace function bump_company_updated_at()
returns trigger language plpgsql as $$
begin
  NEW.updated_at = now();
  return NEW;
end $$;

drop trigger if exists companies_updated_at on companies;
create trigger companies_updated_at
  before update on companies
  for each row execute function bump_company_updated_at();
