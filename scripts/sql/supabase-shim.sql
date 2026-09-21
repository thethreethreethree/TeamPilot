-- scripts/sql/supabase-shim.sql
--
-- The smallest stand-in for what Supabase provides BEFORE any project migration runs, so the
-- whole migration history can be applied to a plain Postgres and checked.
--
-- WHAT THIS IS NOT: a Supabase clone. It is exactly the surface the 252 migrations in this repo
-- actually touch — established by grepping them, not by guessing:
--
--     448  auth.uid()          98  auth.users        17  storage.objects
--       9  storage.foldername   6  storage.buckets    3  auth.jwt()
--
-- WHY IT EXISTS. On 2026-09-21 migration 0252 created a `pitches` table that migration 0215 had
-- already created three months earlier for a different feature. `create table if not exists`
-- made the second one a silent no-op, and the migration then died on a column that did not
-- exist — meaning the whole Pitch Score system could never have deployed.
--
-- It was verified against real Postgres. Twice. With a hand-written prelude containing the tables
-- that migration REFERENCED, which by construction could not contain the one it collided with.
-- The only prelude that can catch that class is the real history, which is what this file makes
-- possible.
--
-- KEEPING IT HONEST: this shim is itself a hand-written approximation, so it can drift from real
-- Supabase. The mitigation is that it is small, its contents are justified by a grep of what the
-- migrations use, and a missing piece fails LOUDLY (a migration errors) rather than quietly.
-- Four migrations failed on the first run because `storage.buckets` was missing
-- `file_size_limit`; that is the failure mode working.

create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";

create schema if not exists auth;
create schema if not exists storage;
create schema if not exists extensions;

-- auth.users — the FK target for ~98 references. Only the columns the migrations name.
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- storage.buckets — the columns matter: four migrations set file_size_limit and
-- allowed_mime_types, and omitting them is what made the first run of this script fail.
create table if not exists storage.buckets (
  id text primary key,
  name text,
  owner uuid,
  public boolean default false,
  avif_autodetection boolean default false,
  file_size_limit bigint,
  allowed_mime_types text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text,
  owner uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  last_accessed_at timestamptz default now(),
  metadata jsonb
);

create or replace function storage.foldername(name text) returns text[]
  language sql immutable as $$ select string_to_array(name, '/') $$;

do $shim$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
  if not exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then create role supabase_auth_admin nologin; end if;
end $shim$;

-- The JWT helpers. Every RLS policy in the repo routes through auth.uid(); these read the same
-- GUCs PostgREST sets, so a policy can be exercised by setting request.jwt.claim.sub.
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;

create or replace function auth.role() returns text language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon') $$;
