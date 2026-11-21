-- TEST FIXTURE ONLY. Never apply this to any real database.
--
-- A minimal stand-in for the parts of the live ELOSTATE schema that the RSS migrations touch,
-- so RLS can be tested in PGlite. Column names come from the file:line evidence in the
-- Gong vs ELOSTATE comparison (commit 0214913). Where the live shape is unknown, the RSS
-- migrations run a PREFLIGHT that fails loudly instead of guessing - see each 02xx file.

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
grant usage on schema auth to authenticated, anon, service_role;

-- Supabase's auth.uid(): the JWT 'sub' claim.
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create table public.companies (id uuid primary key, name text not null);

-- [OBSERVED] profiles.company_id single-valued (auth-helpers.ts:22), status 'removed' soft-delete,
-- role ladder (roles.ts:30), sales_coach_role admin|staff (0072_sales_coach_role.sql:18).
create table public.profiles (
  id uuid primary key,
  company_id uuid not null references public.companies(id),
  role text not null default 'member',
  sales_coach_role text check (sales_coach_role in ('admin', 'staff')),
  status text not null default 'active'
);

-- [OBSERVED] 0265_admin_roles_single_source.sql:56 - single source of admin roles.
create function public.admin_roles() returns text[] language sql immutable as $$
  select array['ceo', 'cfo', 'coo', 'admin']::text[]
$$;

-- [OBSERVED] 0070, 0077, 0237: agent_id, context in_person|video, session_kind, outcome, deal_value.
create table public.coaching_sessions (
  id uuid primary key,
  company_id uuid not null references public.companies(id),
  agent_id uuid not null references public.profiles(id),
  context text not null default 'in_person' constraint coaching_sessions_context_check check (context in ('in_person', 'video')),
  session_kind text not null default 'sales',
  outcome text,
  deal_value numeric
);

-- [OBSERVED] 0252: pitch_scores with rep_id, rubric_version FK to rubric_config, one active rubric per company.
create table public.rubric_config (
  version text primary key,
  company_id uuid not null references public.companies(id),
  active boolean not null default true,
  config jsonb not null default '{}'
);
create unique index rubric_config_one_active_per_company on public.rubric_config (company_id) where active;

create table public.pitch_scores (
  id uuid primary key,
  company_id uuid not null references public.companies(id),
  rep_id uuid not null references public.profiles(id),
  session_id uuid not null references public.coaching_sessions(id),
  rubric_version text not null references public.rubric_config(version),
  total numeric not null
);

grant usage on schema public to authenticated, anon, service_role;
grant select on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;

-- Supabase's default privileges: every new table is fully granted to anon/authenticated/service_role,
-- so RLS policies (and their ABSENCE) are the only gate. The RSS tests rely on this being true.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
