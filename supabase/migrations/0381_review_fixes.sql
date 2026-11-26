-- 0381 — fixes from the independent review of the revenue and Engage builds (2026-11-27;
-- docs/tbc/2026-11-27-review-revenue-engage-fixes). Re-runnable. No erasure function changes: each fix below removes
-- customer words from a table instead of teaching erasure a new one.
--
--   · accounts_select (0370) followed any deal EVER put on an account (every 'account' event), so moving a deal off an
--     account kept it readable, and naming an account the same as another rep's let a rep reach it. It now follows a
--     deal's CURRENT account (remote_prospects_current, under the reader's RLS) or the creator.
--   · contacts_select (0370) also opened every contact of any account the reader could see, so a shared account showed
--     other reps' contacts on deals the reader can't open. That branch is dropped: a contact is readable by its creator,
--     or through a deal or call the reader can see.
--   · agent_runs gains session_id and tracker_id: a tracker agent fires once per call and tracker, even when the same
--     transcript version is scanned again (unique, so two scans racing can't both record).
--   · forecast_submissions.note: a free-text note could quote a customer and erasure doesn't reach it. Notes are no
--     longer taken (the route and screen drop them) and the column must stay empty. Production had 0 notes (probe).
--   · 'agent_ran' notifications and 'agent.ran' webhooks no longer carry the deal's name (a customer's name erasure
--     can't reach in those payloads); the deal id is enough to open it. Production had 0 of either (probe).

drop policy if exists accounts_select on public.accounts;
create policy accounts_select on public.accounts for select to authenticated
  using (company_id = auth_company_id() and (
    created_by = auth.uid()
    or exists (select 1 from remote_prospects_current p where p.account_id = accounts.id)));

drop policy if exists contacts_select on public.contacts;
create policy contacts_select on public.contacts for select to authenticated
  using (company_id = auth_company_id() and (
    created_by = auth.uid()
    or exists (select 1 from deal_contacts dc where dc.contact_id = contacts.id)
    or exists (select 1 from call_contacts cc where cc.contact_id = contacts.id)));

alter table public.agent_runs add column if not exists session_id uuid references public.coaching_sessions(id);
alter table public.agent_runs add column if not exists tracker_id uuid;
create unique index if not exists agent_runs_once_per_call on public.agent_runs (agent_id, session_id, tracker_id)
  where session_id is not null and tracker_id is not null and not test;

alter table public.forecast_submissions drop constraint if exists forecast_submissions_no_note;
alter table public.forecast_submissions add constraint forecast_submissions_no_note check (note is null);

alter table public.manager_notifications drop constraint if exists manager_notifications_agent_ran_no_name;
alter table public.manager_notifications add constraint manager_notifications_agent_ran_no_name
  check (type <> 'agent_ran' or not (payload ? 'deal_name'));
alter table public.webhook_deliveries drop constraint if exists webhook_deliveries_agent_ran_no_name;
alter table public.webhook_deliveries add constraint webhook_deliveries_agent_ran_no_name
  check (event <> 'agent.ran' or not coalesce(payload -> 'deal' ? 'name', false));
