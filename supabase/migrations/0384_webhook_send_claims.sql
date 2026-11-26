-- 0384 — a webhook send claims its attempt before sending (2026-11-27; OPEN.md 2026-11-20 review item "two overlapping
-- webhook sends of one delivery can both go out"; 0383's pattern). Re-runnable.
--
-- The sender recorded an attempt (webhook_attempts, unique per delivery and attempt number) only AFTER sending, so two
-- overlapping cron runs could both send the same delivery. webhook_send_claims is inserted first; the primary key lets
-- one run win each (delivery, attempt), and only the winner sends. Service role only (no policies). Append-only. No
-- customer words (ids and a number).

create table if not exists public.webhook_send_claims (
  delivery_id bigint not null references public.webhook_deliveries(id),
  attempt_no int not null check (attempt_no between 1 and 100),
  company_id uuid not null references public.companies(id),
  created_at timestamptz not null default now(),
  primary key (delivery_id, attempt_no)
);
create or replace rule webhook_send_claims_no_update as on update to public.webhook_send_claims do instead nothing;
create or replace rule webhook_send_claims_no_delete as on delete to public.webhook_send_claims do instead nothing;
alter table public.webhook_send_claims enable row level security;
