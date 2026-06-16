-- 0038 — C.A.R.E white-label layer.
--
-- Customer Assistance and Response Engine. Until now the widget
-- was hardcoded to ELOSTATE; this migration lets any company we
-- onboard run their own customer support through our system —
-- their own branding, their own AI personality, their own product
-- context, their own allowed origins.
--
-- The companies table is still the tenant model (a business that
-- signs up to use C.A.R.E IS a company in our system). This
-- migration adds the support-specific config alongside.
--
-- Schema additions:
--   - care_tenant_config — per-tenant widget + AI configuration,
--     embed token, allowed origins
--   - care_widget_load_events — telemetry on widget bootstraps so
--     tenants and we can see traffic / wrong-origin attempts
--
-- A12 idempotent.

-- ─── Tenant config table ──────────────────────────────────────
create table if not exists care_tenant_config (
  company_id              uuid primary key references companies(id) on delete cascade,
  -- The embed token is the customer-side identifier. Embed
  -- snippets ship with the token; the widget passes it on every
  -- request; the server validates it against allowed_origins and
  -- looks up the tenant.
  embed_token             text not null unique default replace(gen_random_uuid()::text, '-', ''),
  -- Allowed CORS origins. Empty array = no embedding allowed
  -- (tenant exists but widget isn't live yet). Wildcard allowed
  -- via "*" only for pilot / development; enforce at the server
  -- side.
  allowed_origins         text[] not null default '{}',
  active                  boolean not null default true,
  -- ─── Widget appearance ────────────────────────────────────
  widget_color            text not null default '#FACC15',
  widget_greeting         text not null default 'We''re here to help',
  widget_subtitle         text not null default 'Typical reply: a few seconds',
  widget_position         text not null default 'bottom-right'
                          check (widget_position in ('bottom-right', 'bottom-left')),
  widget_logo_url         text,
  -- ─── Branding ─────────────────────────────────────────────
  company_display_name    text,
  reply_signature         text,
  -- ─── AI personality ───────────────────────────────────────
  ai_product_context      text,
  ai_tone                 text not null default 'warm'
                          check (ai_tone in ('warm', 'formal', 'casual', 'direct')),
  ai_response_length      text not null default 'medium'
                          check (ai_response_length in ('short', 'medium', 'long')),
  -- ─── Plan & quota (Sprint 7 wires Stripe) ─────────────────
  plan                    text not null default 'pilot'
                          check (plan in ('pilot', 'starter', 'pro', 'enterprise')),
  monthly_conversation_quota int not null default 200,
  -- ─── Lifecycle ────────────────────────────────────────────
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index if not exists care_tenant_config_embed_token_idx
  on care_tenant_config (embed_token) where active = true;

-- Auto-touch updated_at
create or replace function touch_care_tenant_config_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_touch_care_tenant_config on care_tenant_config;
create trigger trg_touch_care_tenant_config
  before update on care_tenant_config
  for each row execute function touch_care_tenant_config_updated_at();

-- ─── Widget load events ───────────────────────────────────────
-- Telemetry: every time the embedded widget bootstraps on a third-
-- party site we log the origin + tenant + a result code (ok /
-- origin_rejected / tenant_inactive / quota_exceeded). Lets
-- tenants see their traffic and lets us catch wrong-origin
-- embedding attempts.
create table if not exists care_widget_load_events (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid references companies(id) on delete set null,
  embed_token     text,
  origin          text,
  result          text not null check (result in (
                    'ok',
                    'origin_rejected',
                    'tenant_inactive',
                    'tenant_unknown',
                    'quota_exceeded'
                  )),
  user_agent      text,
  created_at      timestamptz not null default now()
);

create index if not exists care_widget_load_events_company_idx
  on care_widget_load_events (company_id, created_at desc);

create index if not exists care_widget_load_events_result_idx
  on care_widget_load_events (result, created_at desc)
  where result <> 'ok';

-- ─── Backfill ELOSTATE's tenant config ────────────────────────
-- Make sure the default tenant has a row so the widget continues
-- working on elostate.com without manual setup. Idempotent —
-- only inserts if there isn't already a row.
insert into care_tenant_config (
  company_id, allowed_origins, company_display_name, ai_product_context
)
select
  c.id,
  array['https://elostate.com', 'https://www.elostate.com', 'http://localhost:4321'],
  'ELOSTATE',
  'You are representing ELOSTATE, a team problem-solving and customer experience platform. Customers typically ask about pricing (pilot-stage, invite-only), how the product works, the measurement window, security, and onboarding.'
from companies c
where c.id = 'c3e7f389-3df6-48c8-876b-0cd4baf5c2a7'::uuid
on conflict (company_id) do nothing;

-- ─── RLS ──────────────────────────────────────────────────────
alter table care_tenant_config enable row level security;
alter table care_widget_load_events enable row level security;

-- Tenant config: company admins manage their own config; all team
-- members can read it
drop policy if exists "care_tenant_config - select" on care_tenant_config;
create policy "care_tenant_config - select" on care_tenant_config
  for select using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.company_id = care_tenant_config.company_id
    )
  );

drop policy if exists "care_tenant_config - mutate" on care_tenant_config;
create policy "care_tenant_config - mutate" on care_tenant_config
  for all using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.company_id = care_tenant_config.company_id
        and p.role in ('CEO', 'COO', 'admin')
    )
  );

-- Widget load events: read by company members; never written from
-- client (server-side only via service role)
drop policy if exists "care_widget_load_events - select" on care_widget_load_events;
create policy "care_widget_load_events - select" on care_widget_load_events
  for select using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.company_id = care_widget_load_events.company_id
    )
  );

-- ─── Comments ─────────────────────────────────────────────────
comment on table care_tenant_config is
  'White-label tenant configuration. Each company that signs up for
   C.A.R.E gets a row here with their embed token, allowed
   origins, AI personality, widget branding, and plan / quota.
   The customer-side widget identifies itself with embed_token;
   the server validates against allowed_origins and looks up the
   tenant to scope conversations.';

comment on column care_tenant_config.embed_token is
  'The customer-side identifier. Embedded into the widget snippet
   the tenant copies onto their site. NEVER exposed via the
   tenant config GET — only returned to admins inside the tenant
   itself.';

comment on column care_tenant_config.allowed_origins is
  'CORS whitelist. The widget bootstrap rejects any origin not in
   this array (except wildcard "*" which is pilot-only). Empty
   array means the tenant exists but the widget isn''t live.';

comment on column care_tenant_config.ai_product_context is
  'Per-tenant product grounding the C.A.R.E AI uses when drafting
   replies. Replaces the hardcoded ELOSTATE context for tenant-
   owned conversations. Refuses to answer questions outside
   what''s grounded in this context — hand-off to human is the
   honest move when the AI doesn''t have the answer.';
