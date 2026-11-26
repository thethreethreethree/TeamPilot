-- 0383 — a date trigger claims its fire before acting (2026-11-27; review of 92249504). Re-runnable.
--
-- 0382 recorded a close-date run (agent_runs.fire_key) only AFTER its actions, so two overlapping runs both acted, and a
-- run killed between acting and recording acted again the next night. agent_fires is the claim: the nightly job inserts
-- (agent, fire key) first — the primary key lets exactly one run win — and only the winner acts. At most once: a claim
-- whose run then fails is not retried (a missed action, never a doubled one). A transient failure BEFORE the claim
-- (reading the deal, checking who the agent acts for) claims nothing, so the next night tries again.
-- Written by the service role only (no policies: nobody reads or writes it through the API). Append-only. No customer
-- words (ids and a key made of a deal id, a date and a day count).

create table if not exists public.agent_fires (
  agent_id uuid not null references public.agents(id),
  fire_key text not null check (length(fire_key) <= 200),
  company_id uuid not null references public.companies(id),
  created_at timestamptz not null default now(),
  primary key (agent_id, fire_key)
);
create or replace rule agent_fires_no_update as on update to public.agent_fires do instead nothing;
create or replace rule agent_fires_no_delete as on delete to public.agent_fires do instead nothing;
alter table public.agent_fires enable row level security;
