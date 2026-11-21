-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 0286 — RSS Phase 9: signed outbound webhooks (scaffold 0279_rss_p9_webhooks.sql, renumbered; Gong F31.8)
-- ═════════════════════════════════════════════════════════════════════════════════════════════
--
--   webhook_endpoints — a company admin's https URL and the events it wants. Never edited; turned off once (the
--     guard trigger allows only active true → false). A new URL is a new endpoint.
--   webhook_deliveries — one row per (endpoint, event occurrence): what will be sent. Append-only.
--   webhook_attempts — one row per try, with the status or error. Append-only. "Delivered" = an attempt with ok.
--   Enqueue is a TRIGGER on the tables where the facts land, not a call in each route: a session is closed from at
--   least three places (the session route, finalize, the stale-session cron) and a score is stored from three
--   callers; a trigger covers every path, including ones written later (§2.2: one source for the decision).
--     · session.closed — coaching_sessions.status becomes 'ended' (sales calls only)
--     · deal.closed    — coaching_sessions.outcome becomes 'sold'
--     · session.scored — a pitch_scores row is inserted for a session
--   Payloads carry ids, times, outcome, value and score — never the transcript and never the client label: a
--   customer's details sent to another system are out of reach of erasure (§3.1.1).
--
-- DIFFERENCES FROM THE SCAFFOLD: attempts are rows (the scaffold updated attempts/last_status in place, §3.1);
-- policies use auth_company_id() + admin_roles() (the scaffold's helpers are revoked from `authenticated`, 0272:180);
-- no client write policy (the route writes after its admin check); enqueue triggers (the scaffold had none).
-- Signing: still no secret in the database, but NOT one shared secret for every company as the plan said — a
-- receiver must know the secret to verify, so a shared one would let any customer forge another's webhooks. Each
-- endpoint's secret is HMAC(RSS_WEBHOOK_SIGNING_SECRET, endpoint id), derived in the app (webhooks.ts).
-- Idempotent (A12).
-- ═════════════════════════════════════════════════════════════════════════════════════════════

create table if not exists public.webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  url text not null check (url like 'https://%' and length(url) <= 500),
  events text[] not null check (cardinality(events) > 0 and events <@ array['session.scored', 'session.closed', 'deal.closed']),
  active boolean not null default true,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists webhook_endpoints_company_idx on public.webhook_endpoints (company_id) where active;
create or replace function public.rss_guard_endpoint_update() returns trigger
  language plpgsql set search_path = public as $$
begin
  if (to_jsonb(new) - 'active') is distinct from (to_jsonb(old) - 'active') or old.active = false or new.active = true then
    raise exception 'RSS: a webhook endpoint never changes — turn it off and add a new one';
  end if;
  return new;
end $$;
drop trigger if exists rss_guard_endpoint_update on public.webhook_endpoints;
create trigger rss_guard_endpoint_update before update on public.webhook_endpoints
  for each row execute function public.rss_guard_endpoint_update();
create or replace rule webhook_endpoints_no_delete as on delete to public.webhook_endpoints do instead nothing;

create table if not exists public.webhook_deliveries (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id),
  endpoint_id uuid not null references public.webhook_endpoints(id),
  event text not null check (event in ('session.scored', 'session.closed', 'deal.closed', 'ping')),
  payload jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists webhook_deliveries_recent_idx on public.webhook_deliveries (created_at desc);
create index if not exists webhook_deliveries_endpoint_idx on public.webhook_deliveries (endpoint_id, created_at desc);
create or replace rule webhook_deliveries_no_update as on update to public.webhook_deliveries do instead nothing;
create or replace rule webhook_deliveries_no_delete as on delete to public.webhook_deliveries do instead nothing;

create table if not exists public.webhook_attempts (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id),
  delivery_id bigint not null references public.webhook_deliveries(id),
  attempt_no smallint not null check (attempt_no between 1 and 10),
  ok boolean not null,
  status integer,
  error text check (length(error) <= 300),
  created_at timestamptz not null default now(),
  constraint webhook_attempts_once unique (delivery_id, attempt_no)
);
create or replace rule webhook_attempts_no_update as on update to public.webhook_attempts do instead nothing;
create or replace rule webhook_attempts_no_delete as on delete to public.webhook_attempts do instead nothing;

alter table public.webhook_endpoints enable row level security;
alter table public.webhook_deliveries enable row level security;
alter table public.webhook_attempts enable row level security;
drop policy if exists rss_wh_select on public.webhook_endpoints;
create policy rss_wh_select on public.webhook_endpoints for select to authenticated
  using (company_id = auth_company_id() and exists (
    select 1 from profiles p where p.id = auth.uid() and p.role = any (admin_roles()) and p.status <> 'removed'));
drop policy if exists rss_whd_select on public.webhook_deliveries;
create policy rss_whd_select on public.webhook_deliveries for select to authenticated
  using (company_id = auth_company_id() and exists (
    select 1 from profiles p where p.id = auth.uid() and p.role = any (admin_roles()) and p.status <> 'removed'));
drop policy if exists rss_wha_select on public.webhook_attempts;
create policy rss_wha_select on public.webhook_attempts for select to authenticated
  using (company_id = auth_company_id() and exists (
    select 1 from profiles p where p.id = auth.uid() and p.role = any (admin_roles()) and p.status <> 'removed'));

-- ── enqueue ──────────────────────────────────────────────────────────────────────────────────
create or replace function public.rss_webhook_enqueue(p_company uuid, p_event text, p_payload jsonb) returns integer
  language plpgsql security definer set search_path = public as $$
declare
  k integer;
begin
  insert into webhook_deliveries (company_id, endpoint_id, event, payload)
  select e.company_id, e.id, p_event, p_payload
  from webhook_endpoints e
  where e.company_id = p_company and e.active and p_event = any (e.events);
  get diagnostics k = row_count;
  return k;
end $$;
revoke all on function public.rss_webhook_enqueue(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.rss_webhook_enqueue(uuid, text, jsonb) to service_role;

-- A webhook must never break the write it reports on: any failure here is swallowed with a warning.
create or replace function public.rss_webhook_on_session() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  begin
    if not exists (select 1 from webhook_endpoints e where e.company_id = new.company_id and e.active) then
      return new;
    end if;
    if coalesce(new.session_kind, 'sales') not in ('meeting', 'huddle') then
      if new.status = 'ended' and old.status is distinct from 'ended' then
        perform rss_webhook_enqueue(new.company_id, 'session.closed', jsonb_build_object(
          'sessionId', new.id, 'repId', new.agent_id, 'channel', new.context,
          'startedAt', new.started_at, 'endedAt', new.ended_at, 'outcome', new.outcome));
      end if;
      if new.outcome = 'sold' and old.outcome is distinct from 'sold' then
        perform rss_webhook_enqueue(new.company_id, 'deal.closed', jsonb_build_object(
          'sessionId', new.id, 'repId', new.agent_id, 'channel', new.context,
          'dealValue', new.deal_value, 'closedAt', now()));
      end if;
    end if;
  exception when others then
    raise warning 'rss_webhook_on_session skipped for session %: %', new.id, sqlerrm;
  end;
  return new;
end $$;
drop trigger if exists rss_webhook_on_session on public.coaching_sessions;
create trigger rss_webhook_on_session after update of status, outcome on public.coaching_sessions
  for each row execute function public.rss_webhook_on_session();

create or replace function public.rss_webhook_on_score() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  begin
    if new.session_id is null or not exists (select 1 from webhook_endpoints e where e.company_id = new.company_id and e.active) then
      return new;
    end if;
    perform rss_webhook_enqueue(new.company_id, 'session.scored', jsonb_build_object(
      'sessionId', new.session_id, 'pitchId', new.id, 'repId', new.rep_id,
      'total', new.total, 'band', new.band, 'qualifying', new.qualifying, 'scoredAt', now()));
  exception when others then
    raise warning 'rss_webhook_on_score skipped for pitch %: %', new.id, sqlerrm;
  end;
  return new;
end $$;
drop trigger if exists rss_webhook_on_score on public.pitch_scores;
create trigger rss_webhook_on_score after insert on public.pitch_scores
  for each row execute function public.rss_webhook_on_score();

-- ── what the sender should try now ───────────────────────────────────────────────────────────
-- Not delivered, fewer than 6 attempts, created in the last 3 days, and past its backoff (2^n minutes after the
-- last try: 1, 2, 4, 8, 16). Oldest first. Inactive endpoints are skipped (turning one off stops its retries).
create or replace function public.rss_webhook_due(p_limit integer) returns table (
  delivery_id bigint, company_id uuid, endpoint_id uuid, url text, event text, payload jsonb, created_at timestamptz, attempts integer)
  language sql stable security definer set search_path = public as $$
  select d.id, d.company_id, d.endpoint_id, e.url, d.event, d.payload, d.created_at, coalesce(a.n, 0)::integer
  from webhook_deliveries d
  join webhook_endpoints e on e.id = d.endpoint_id and e.active
  left join lateral (
    select count(*) as n, bool_or(x.ok) as delivered, max(x.created_at) as last_at
    from webhook_attempts x where x.delivery_id = d.id
  ) a on true
  where d.created_at > now() - interval '3 days'
    and not coalesce(a.delivered, false)
    and coalesce(a.n, 0) < 6
    and (a.last_at is null or a.last_at < now() - (power(2, coalesce(a.n, 0) - 1) * interval '1 minute'))
  order by d.created_at
  limit greatest(1, least(p_limit, 200))
$$;
revoke all on function public.rss_webhook_due(integer) from public, anon, authenticated;
grant execute on function public.rss_webhook_due(integer) to service_role;
