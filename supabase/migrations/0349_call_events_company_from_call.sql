-- 0349 — an event about a call carries the CALL's company (2026-11-26; docs/residuals/OPEN.md call-events-access).
-- record_event() (0004) stamps the AUTHOR's company at write time. Production holds 233 events about one company's
-- calls stamped with four other companies (Aug 2026) — readable by those companies until 0348. An event about a call
-- (subject 'sales_session:<call>') or a score ('pitch:<pitch>') belongs to that call's / score's company, so this
-- BEFORE INSERT trigger sets company_id from it. Insert-time only: no stored row changes (§3.1); the 233 existing rows
-- are a founder decision (OPEN.md).
--   · service-role writes: corrected to the call's company;
--   · a signed-in writer: events' WITH CHECK (company_id = auth_company_id()) then refuses a write about another
--     company's call, instead of storing it under the writer's company.
-- A subject that isn't a well-formed id, or names no existing call/score, is left as written.
create or replace function public.rss_events_company_from_call() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  ref text;
  owner uuid;
begin
  if new.subject is null then return new; end if;
  if new.subject like 'sales_session:%' then
    ref := substring(new.subject from 15);
    if ref ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      select s.company_id into owner from coaching_sessions s where s.id = ref::uuid;
    end if;
  elsif new.subject like 'pitch:%' then
    ref := substring(new.subject from 7);
    if ref ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      select p.company_id into owner from pitch_scores p where p.id = ref::uuid;
    end if;
  end if;
  if owner is not null then new.company_id := owner; end if;
  return new;
end $$;
drop trigger if exists rss_events_company_from_call on public.events;
create trigger rss_events_company_from_call before insert on public.events
  for each row execute function public.rss_events_company_from_call();
