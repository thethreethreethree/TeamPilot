-- 0192 — C.A.R.E Live Monitor: anonymous visitor presence (founder 2026-07-24, "build the live monitor").
--
-- SPEC: the Monitor page (src/app/dashboard/care/monitor/page.tsx) shows a live view of "who's on the site
-- and what they're looking at." Founder decision (2026-07-24): ANONYMOUS, presence-only — a random per-session
-- visitor id, the page they're on, and a heartbeat. NO PII, nothing retained long-term.
--
-- ARCHITECTURE — follows the EXISTING C.A.R.E presence precedent (care_agent_state, 0042), NOT a new
-- realtime-channel mechanism. The stub comment said "wires to Supabase realtime channels," but the codebase
-- precedent for presence is a heartbeat-into-a-row polled by the client (A16 compose-don't-contradict, A28
-- align-to-precedent). The embedded widget is fetch-based (no Supabase client), so a heartbeat POST is also the
-- lowest-surprise, no-new-surface path. Rows are EPHEMERAL: reads filter to a short window; the read path
-- opportunistically deletes long-stale rows so nothing accumulates (honours "nothing retained").
--
-- ADDITIVE ONLY — one new table. It changes NO existing column, read, write, policy, or trigger. Every existing
-- C.A.R.E query keeps working byte-for-byte. The data layer (src/lib/data/care.ts touchVisitorPresence /
-- fetchLiveVisitors) degrades gracefully if this table is absent (try/catch → no-op write, empty read), so code
-- and schema can land in either order without an outage (the migration-coupling discipline, A34 / A12).

create table if not exists public.care_visitor_presence (
  -- Composite natural key: one live row per (tenant, anonymous visitor). Upsert-to-touch keeps it bounded —
  -- a returning visitor updates their own row rather than creating new ones.
  company_id       uuid not null references public.companies(id) on delete cascade,
  -- Anonymous, client-generated per browser session (crypto.randomUUID in the widget). NOT a user id, NOT
  -- linked to any PII. Opaque text so the widget owns its format.
  visitor_id       text not null,
  -- The host page the visitor is on ("what they're looking at"). Best-effort: the embedded iframe reports the
  -- host page via document.referrer on load. Nullable — presence is valid even if the page is unknown.
  page_path        text,
  -- If this visitor has an open support conversation, link it so the agent can jump straight in. SET NULL on
  -- conversation delete so a stale link never dangles.
  conversation_id  uuid references public.support_conversations(id) on delete set null,
  first_seen_at    timestamptz not null default now(),
  last_seen_at     timestamptz not null default now(),
  primary key (company_id, visitor_id)
);

-- Read path: "present visitors for this tenant, most-recent first" + the stale-purge both filter on
-- (company_id, last_seen_at). Index it.
create index if not exists care_visitor_presence_company_seen_idx
  on public.care_visitor_presence (company_id, last_seen_at desc);

-- RLS: enabled with NO policies. All access is via service-role API routes (POST /api/care/widget/presence to
-- write, GET /api/care/monitor/visitors to read), and service-role bypasses RLS. Enabling it with no policy
-- denies every direct anon/authenticated client read/write — defense-in-depth for a table that never needs
-- direct client access (A23: authz-bearing data DB-frozen against direct end-user access). Safer than the
-- care_agent_state precedent, and changes no behaviour because nothing reaches this table off the service role.
alter table public.care_visitor_presence enable row level security;

comment on table public.care_visitor_presence is
  'Ephemeral anonymous visitor presence for the C.A.R.E Live Monitor. No PII. Rows are transient operational '
  'state (not §3.1 domain events) — same class as care_agent_state; the read path purges long-stale rows.';
