-- 0378 — the public read API's keys and usage (2026-11-27; docs/ELOSTATE-ENGAGE-PLATFORM-BUILD-PLAN Phase E3; Gong M31
-- F31.1–F31.6, F31.9). Re-runnable.
--
--   · api_keys — a company's read-only keys. The key is shown once when made; only its SHA-256 hash and a short prefix
--     (to tell keys apart) are stored. Made and revoked by a company admin, through the settings route with the service
--     role after its admin check (no insert or update policy: absence as enforcement). Revoking is the one change
--     (revoked_at), and a revoked key never works again.
--   · api_usage — one row per API request (key, route, status): the usage report and the daily limit.
-- A key reads its company's deals, accounts, contacts and calls, never another company's (every API statement pins
-- company_id), and never a call with an active hide (an outside reader is nobody the hide exempts).

create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  name text not null check (length(btrim(name)) between 1 and 60),
  prefix text not null check (prefix ~ '^els_[A-Za-z0-9_-]{4,8}$'),
  key_hash text not null unique check (key_hash ~ '^[0-9a-f]{64}$'),
  scopes text[] not null default array['read'] check (scopes <@ array['read', 'mcp']::text[] and cardinality(scopes) >= 1),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index if not exists api_keys_company_idx on public.api_keys (company_id, created_at desc);

create table if not exists public.api_usage (
  id bigint generated always as identity primary key,
  key_id uuid not null references public.api_keys(id),
  company_id uuid not null references public.companies(id),
  route text not null check (length(route) <= 80),
  status integer not null,
  at timestamptz not null default now()
);
create index if not exists api_usage_key_idx on public.api_usage (key_id, at desc);
create index if not exists api_usage_company_idx on public.api_usage (company_id, at desc);

create or replace function public.rss_guard_api_key_update() returns trigger
  language plpgsql set search_path = public as $$
begin
  if (to_jsonb(new) - 'revoked_at') is distinct from (to_jsonb(old) - 'revoked_at') or old.revoked_at is not null then
    raise exception 'an API key never changes — revoke it and make a new one';
  end if;
  return new;
end $$;
drop trigger if exists rss_guard_api_key_update on public.api_keys;
create trigger rss_guard_api_key_update before update on public.api_keys for each row execute function public.rss_guard_api_key_update();
create or replace rule api_keys_no_delete as on delete to public.api_keys do instead nothing;
create or replace rule api_usage_no_update as on update to public.api_usage do instead nothing;
create or replace rule api_usage_no_delete as on delete to public.api_usage do instead nothing;

alter table public.api_keys enable row level security;
alter table public.api_usage enable row level security;
-- Admins of the company see its keys (never the key itself: it isn't stored) and their usage.
drop policy if exists api_keys_select on public.api_keys;
create policy api_keys_select on public.api_keys for select to authenticated
  using (company_id = auth_company_id() and exists (select 1 from profiles p where p.id = auth.uid() and p.role = any (admin_roles())));
drop policy if exists api_usage_select on public.api_usage;
create policy api_usage_select on public.api_usage for select to authenticated
  using (company_id = auth_company_id() and exists (select 1 from profiles p where p.id = auth.uid() and p.role = any (admin_roles())));
do $$
declare t text;
begin
  foreach t in array array['api_keys', 'api_usage'] loop
    execute format('drop policy if exists mfa_required on public.%I', t);
    execute format('create policy mfa_required on public.%I as restrictive for all to authenticated using ((select public.rss_mfa_ok())) with check ((select public.rss_mfa_ok()))', t);
  end loop;
end $$;
