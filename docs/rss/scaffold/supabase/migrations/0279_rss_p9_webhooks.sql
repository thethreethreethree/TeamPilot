-- 0279_rss_p9_webhooks.sql
-- ELOSTATE Remote Sales System - Phase 9: signed outbound webhooks (F31.8).
-- Signing secret is deployment-wide (RSS_WEBHOOK_SIGNING_SECRET); no secret is stored in the DB.

create table public.webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  url text not null check (url like 'https://%'),
  events text[] not null check (cardinality(events) > 0 and events <@ array['session.scored', 'session.closed', 'deal.closed']),
  active boolean not null default true,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create table public.webhook_deliveries (
  id bigint generated always as identity primary key,
  endpoint_id uuid not null references public.webhook_endpoints(id) on delete cascade,
  event text not null,
  payload jsonb not null,
  attempts smallint not null default 0,
  last_status integer,
  last_error text,
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);
create function public.rss_endpoint_company(eid uuid) returns uuid
  language sql stable security definer set search_path = public as $$ select company_id from webhook_endpoints where id = eid $$;

alter table public.webhook_endpoints enable row level security;
alter table public.webhook_deliveries enable row level security;
create policy rss_wh_admin on public.webhook_endpoints for all to authenticated
  using (company_id = rss_company_of(auth.uid()) and rss_is_company_admin(auth.uid()))
  with check (company_id = rss_company_of(auth.uid()) and rss_is_company_admin(auth.uid()) and created_by = auth.uid());
create policy rss_whd_select on public.webhook_deliveries for select to authenticated
  using (rss_endpoint_company(endpoint_id) = rss_company_of(auth.uid()) and rss_is_company_admin(auth.uid()));
-- Deliberately NO write policies on deliveries: the sender (service role) writes them.
