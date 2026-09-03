-- 0242 — Gamification Phase 1: the append-only points ledger + manager notifications.
--
-- CONTEXT (docs/gamification/FINDINGS.md + DECISIONS.md): this repo ALREADY scores every session on dimensions
-- (src/lib/coach/v5/salesScore.ts → after_pitch_summaries.payload.scores, rep-private per A18). Founder decisions:
--   • REUSE those scores as the points source — NO new session_scores table, NO second LLM judge.
--   • GAMIFY WITHIN PRIVACY — the ledger's per-row detail stays owner+manager-readable; the leaderboard (Phase 5)
--     reads company-wide rank+totals from a VIEW that exposes no per-session detail (NOT built here).
-- So Phase 1 adds exactly two tables: an append-only point ledger, and manager notifications.

-- ── 1. agent_point_ledger — append-only (SUM(points) is the truth; corrections are new offsetting rows) ──────
create table if not exists agent_point_ledger (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  agent_id    uuid not null references profiles(id),
  -- nullable: a manual correction may not attach to a session. score_ref carries the after-pitch reference the
  -- points were derived from (there is no session_scores table — the after-pitch summary IS the score source).
  session_id  uuid references coaching_sessions(id),
  points      integer not null,                       -- may be NEGATIVE (a correction offsets a prior row)
  reason      text not null check (reason in ('session_score','correction','rescore')),
  detail      jsonb not null default '{}'::jsonb,     -- snapshot (band, per-dimension points) so history is auditable
  created_by  uuid references profiles(id),           -- null = the system
  created_at  timestamptz not null default now()
);

-- No double-bank: at most one 'session_score' row per session (a retried scoring run cannot bank twice).
create unique index if not exists agent_point_ledger_session_score_uniq
  on agent_point_ledger (session_id) where reason = 'session_score';
create index if not exists agent_point_ledger_agent_created on agent_point_ledger (agent_id, created_at desc);
create index if not exists agent_point_ledger_company_created on agent_point_ledger (company_id, created_at desc);

-- Append-only, enforced LOUDLY (mirrors fin_entries_immutable, 0118 — a raising trigger, not a silent
-- do-instead-nothing rule: a silent no-op would let an app "update a balance" and believe it worked, hiding the
-- bug an angry agent later finds). Corrections are new offsetting rows, never edits.
create or replace function agent_point_ledger_immutable()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  raise exception 'agent_point_ledger is append-only — bank a new offsetting row, never % an existing one', lower(TG_OP);
end; $$;
drop trigger if exists agent_point_ledger_no_mutate on agent_point_ledger;
create trigger agent_point_ledger_no_mutate before update or delete on agent_point_ledger
  for each row execute function agent_point_ledger_immutable();

alter table agent_point_ledger enable row level security;
-- Read: the owning agent, OR a company manager (role in CEO/COO/admin OR sales_coach_role='admin'), same company.
-- Peers CANNOT read each other's ledger rows — per-session detail stays private (A18). The company-wide
-- rank+totals board (Phase 5) will read from a dedicated aggregate view, not from this table directly.
create policy "agent_point_ledger - owner or manager read" on agent_point_ledger
  for select using (
    company_id = auth_company_id() and (
      agent_id = auth.uid()
      or exists (select 1 from profiles p where p.id = auth.uid() and p.company_id = agent_point_ledger.company_id
                 and (p.role in ('CEO','COO','admin') or p.sales_coach_role = 'admin'))
    )
  );
-- No INSERT/UPDATE/DELETE policy → clients cannot write; the ledger is written by service-role code only (Phase 2/3).

-- ── 2. manager_notifications — in-app only, exactly two types (RUBRIC-SPEC 8) ────────────────────────────────
create table if not exists manager_notifications (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references companies(id) on delete cascade,
  recipient_id uuid not null references profiles(id),  -- the manager (a company admin; no per-agent FK exists — fan out)
  agent_id     uuid not null references profiles(id),
  session_id   uuid references coaching_sessions(id),
  type         text not null check (type in ('strong_session','deal_closed')),
  payload      jsonb not null default '{}'::jsonb,     -- enough to render without a join
  created_at   timestamptz not null default now(),
  read_at      timestamptz
);
-- The same event must not notify a recipient twice (a re-score / retry / double webhook is idempotent).
create unique index if not exists manager_notifications_dedupe
  on manager_notifications (recipient_id, type, session_id);
create index if not exists manager_notifications_unread on manager_notifications (recipient_id, read_at);

alter table manager_notifications enable row level security;
-- A manager reads ONLY their own notifications. Mark-as-read goes through a service-role route (Phase 4), so no
-- client UPDATE policy here — consistent with the ledger's service-role-write rule.
create policy "manager_notifications - recipient read" on manager_notifications
  for select using (company_id = auth_company_id() and recipient_id = auth.uid());
