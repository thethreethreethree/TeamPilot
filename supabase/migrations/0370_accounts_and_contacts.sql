-- 0370 — accounts and contacts under the pipeline (2026-11-27; revenue stack Phase 1, docs/ELOSTATE-REVENUE-BUILD-PLAN;
-- Gong teardown M21 accounts, F20.3 deal contacts, F29.1 call → contact by hand). Re-runnable.
--
-- The deal stays the prospect (plan R1). Before this, a prospect's company was free text (0303 'organization'), so two
-- deals at one company were unrelated and a call's customer was a name typed on that call only (0343).
--   · accounts + account_events (name)      — one per company per key (rss_account_key, the only authority, §2.2)
--   · contacts + contact_events (name, title, account)
--   · deal_contacts (prospect × contact, a role; latest row per pair wins; 'removed' takes it off)
--   · call_contacts (call × contact; latest row per pair wins; linked=false takes it off)
--   · remote_prospect_events kind 'account' ({account_id}); remote_prospects_current gains account_id at the END
--   · backfill: each prospect's current organization → the account with its key, as an 'account' event by its rep
--   · erasure (§3.1.1): rss_erase_sessions (0369's body + one step) renames the contacts on the erased calls and the
--     accounts that exist only for the erased deals; rss_erasure_contact_matches / rss_erase_contacts let the admin see
--     and confirm contacts and accounts that mention the identifier, through the same route, the same request.
-- Everything append-only (§3.1); current state is security_invoker views (A30). RLS: company + who can see a deal or call
-- on it (R11, tighter than Gong's F21.5); restrictive MFA (0309); rss_not_hidden on call rows (0341).

-- 1. The key -------------------------------------------------------------------------------------------------------
-- Case, common accents, spaces and punctuation ignored. Legal suffixes are kept ("Acme" and "Acme Inc" can be two
-- companies; plan 04). Immutable so it can be indexed.
create or replace function public.rss_account_key(p_name text) returns text
  language sql immutable parallel safe as $$
  select btrim(regexp_replace(
           translate(lower(coalesce(p_name, '')),
                     'àáâãäåāăąçćčďèéêëēėęěìíîïīįłñńňòóôõöøōőřśšşťùúûüūůűųýÿžźż',
                     'aaaaaaaaacccdeeeeeeeeiiiiiilnnnoooooooorssstuuuuuuuuyyzzz'),
           '[^a-z0-9]+', ' ', 'g'))
$$;

-- 2. Accounts --------------------------------------------------------------------------------------------------------
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists accounts_company_idx on public.accounts (company_id);

create table if not exists public.account_events (
  id bigint generated always as identity primary key,
  account_id uuid not null references public.accounts(id),
  company_id uuid not null references public.companies(id),
  kind text not null check (kind in ('name')),
  value jsonb not null,
  actor_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint account_events_name check (kind <> 'name' or (jsonb_typeof(value -> 'text') = 'string' and length(btrim(value ->> 'text')) between 1 and 120))
);
create index if not exists account_events_idx on public.account_events (account_id, kind, id desc);
create index if not exists account_events_company_idx on public.account_events (company_id);

-- 3. Contacts --------------------------------------------------------------------------------------------------------
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists contacts_company_idx on public.contacts (company_id);

create table if not exists public.contact_events (
  id bigint generated always as identity primary key,
  contact_id uuid not null references public.contacts(id),
  company_id uuid not null references public.companies(id),
  kind text not null check (kind in ('name', 'title', 'account')),
  value jsonb not null,
  actor_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint contact_events_name check (kind <> 'name' or (jsonb_typeof(value -> 'text') = 'string' and length(btrim(value ->> 'text')) between 1 and 80)),
  constraint contact_events_title check (kind <> 'title' or jsonb_typeof(value -> 'text') = 'null' or (jsonb_typeof(value -> 'text') = 'string' and length(value ->> 'text') <= 80)),
  constraint contact_events_account check (kind <> 'account' or jsonb_typeof(value -> 'account_id') = 'null'
    or (jsonb_typeof(value -> 'account_id') = 'string' and (value ->> 'account_id') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'))
);
create index if not exists contact_events_idx on public.contact_events (contact_id, kind, id desc);
create index if not exists contact_events_account_idx on public.contact_events ((value ->> 'account_id')) where kind = 'account';

-- The latest account a contact is on, read past contact_events' RLS so contacts' own policy doesn't recurse through it.
-- Returns only an id the caller must then be able to see (accounts' RLS) for it to matter.
create or replace function public.rss_contact_account(p_contact uuid) returns uuid
  language sql stable security definer set search_path = public as $$
  select nullif(e.value ->> 'account_id', '')::uuid from contact_events e
   where e.contact_id = p_contact and e.kind = 'account' order by e.id desc limit 1
$$;
revoke all on function public.rss_contact_account(uuid) from public, anon;
grant execute on function public.rss_contact_account(uuid) to authenticated, service_role;

-- 4. Links -----------------------------------------------------------------------------------------------------------
create table if not exists public.deal_contacts (
  id bigint generated always as identity primary key,
  prospect_id uuid not null references public.remote_prospects(id),
  contact_id uuid not null references public.contacts(id),
  company_id uuid not null references public.companies(id),
  role text not null check (role in ('decision_maker', 'champion', 'user', 'other', 'removed')),
  actor_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists deal_contacts_idx on public.deal_contacts (prospect_id, contact_id, id desc);
create index if not exists deal_contacts_contact_idx on public.deal_contacts (contact_id);

create table if not exists public.call_contacts (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.coaching_sessions(id) on delete cascade,
  contact_id uuid not null references public.contacts(id),
  company_id uuid not null references public.companies(id),
  linked boolean not null default true,
  actor_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists call_contacts_idx on public.call_contacts (session_id, contact_id, id desc);
create index if not exists call_contacts_contact_idx on public.call_contacts (contact_id);

-- 5. A deal's account ------------------------------------------------------------------------------------------------
alter table public.remote_prospect_events drop constraint if exists remote_prospect_events_kind_check;
alter table public.remote_prospect_events add constraint remote_prospect_events_kind_check
  check (kind in ('name', 'organization', 'stage', 'amount', 'next_call', 'source', 'close_date', 'account'));
alter table public.remote_prospect_events drop constraint if exists remote_prospect_events_account;
alter table public.remote_prospect_events add constraint remote_prospect_events_account
  check (kind <> 'account' or jsonb_typeof(value -> 'account_id') = 'null'
         or (jsonb_typeof(value -> 'account_id') = 'string' and (value ->> 'account_id') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'));
create index if not exists remote_prospect_events_account_idx on public.remote_prospect_events ((value ->> 'account_id')) where kind = 'account';

-- An account event, a contact's account and every link must stay inside one company. A check can't read another table,
-- so a trigger does (definer: the account may not be visible to the writer yet; the company match is the rule).
-- One function per table: plpgsql resolves NEW's fields per row type, so a shared body that reads new.kind fails on the
-- link tables, which have no kind (found by the rolled-back probe, 2026-11-27).
create or replace function public.rss_account_same_company() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  acc uuid;
begin
  if new.kind = 'account' then
    acc := nullif(new.value ->> 'account_id', '')::uuid;
    if acc is not null and not exists (select 1 from accounts a where a.id = acc and a.company_id = new.company_id) then
      raise exception 'account belongs to another company';
    end if;
  end if;
  return new;
end $$;

create or replace function public.rss_deal_contact_same_company() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from contacts c where c.id = new.contact_id and c.company_id = new.company_id)
     or not exists (select 1 from remote_prospects p where p.id = new.prospect_id and p.company_id = new.company_id) then
    raise exception 'deal and contact must belong to the same company';
  end if;
  return new;
end $$;

create or replace function public.rss_call_contact_same_company() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from contacts c where c.id = new.contact_id and c.company_id = new.company_id)
     or not exists (select 1 from coaching_sessions s where s.id = new.session_id and s.company_id = new.company_id) then
    raise exception 'call and contact must belong to the same company';
  end if;
  return new;
end $$;

drop trigger if exists rss_revenue_same_company on public.remote_prospect_events;
create trigger rss_revenue_same_company before insert on public.remote_prospect_events for each row execute function public.rss_account_same_company();
drop trigger if exists rss_revenue_same_company on public.contact_events;
create trigger rss_revenue_same_company before insert on public.contact_events for each row execute function public.rss_account_same_company();
drop trigger if exists rss_revenue_same_company on public.deal_contacts;
create trigger rss_revenue_same_company before insert on public.deal_contacts for each row execute function public.rss_deal_contact_same_company();
drop trigger if exists rss_revenue_same_company on public.call_contacts;
create trigger rss_revenue_same_company before insert on public.call_contacts for each row execute function public.rss_call_contact_same_company();

-- 6. RLS -------------------------------------------------------------------------------------------------------------
alter table public.accounts enable row level security;
alter table public.account_events enable row level security;
alter table public.contacts enable row level security;
alter table public.contact_events enable row level security;
alter table public.deal_contacts enable row level security;
alter table public.call_contacts enable row level security;

-- An account is seen by whoever made it, or can see a deal that was ever put on it (prospects' own RLS: the rep, or a
-- manager over them in the tree). No insert policy: accounts are made only by rss_account_find_or_create, so a key is
-- never duplicated (absence as enforcement).
drop policy if exists accounts_select on public.accounts;
create policy accounts_select on public.accounts for select to authenticated
  using (company_id = auth_company_id() and (
    created_by = auth.uid()
    or exists (select 1 from remote_prospect_events e
                where e.kind = 'account' and e.value ->> 'account_id' = accounts.id::text
                  and exists (select 1 from remote_prospects p where p.id = e.prospect_id))));
drop policy if exists account_events_select on public.account_events;
create policy account_events_select on public.account_events for select to authenticated
  using (company_id = auth_company_id() and exists (select 1 from accounts a where a.id = account_events.account_id));
-- No insert policy on account_events either: a rename goes through rss_account_rename (same lock, same key rule).

-- A contact is seen by whoever made it, or can see a deal or call it is on, or the account it belongs to.
drop policy if exists contacts_select on public.contacts;
create policy contacts_select on public.contacts for select to authenticated
  using (company_id = auth_company_id() and (
    created_by = auth.uid()
    or exists (select 1 from deal_contacts dc where dc.contact_id = contacts.id)
    or exists (select 1 from call_contacts cc where cc.contact_id = contacts.id)
    or exists (select 1 from accounts a where a.id = public.rss_contact_account(contacts.id))));
drop policy if exists contacts_insert on public.contacts;
create policy contacts_insert on public.contacts for insert to authenticated
  with check (company_id = auth_company_id() and created_by = auth.uid());
drop policy if exists contact_events_select on public.contact_events;
create policy contact_events_select on public.contact_events for select to authenticated
  using (company_id = auth_company_id() and exists (select 1 from contacts c where c.id = contact_events.contact_id));
drop policy if exists contact_events_insert on public.contact_events;
create policy contact_events_insert on public.contact_events for insert to authenticated
  with check (company_id = auth_company_id() and actor_id = auth.uid()
              and exists (select 1 from contacts c where c.id = contact_events.contact_id)
              and (kind <> 'account' or nullif(value ->> 'account_id', '') is null
                   or exists (select 1 from accounts a where a.id = (contact_events.value ->> 'account_id')::uuid)));

-- Links follow the deal's and the call's own RLS (not the contact's, so the contacts policy above doesn't recurse).
drop policy if exists deal_contacts_select on public.deal_contacts;
create policy deal_contacts_select on public.deal_contacts for select to authenticated
  using (company_id = auth_company_id() and exists (select 1 from remote_prospects p where p.id = deal_contacts.prospect_id));
drop policy if exists deal_contacts_insert on public.deal_contacts;
create policy deal_contacts_insert on public.deal_contacts for insert to authenticated
  with check (company_id = auth_company_id() and actor_id = auth.uid()
              and exists (select 1 from remote_prospects p where p.id = deal_contacts.prospect_id)
              and exists (select 1 from contacts c where c.id = deal_contacts.contact_id));
drop policy if exists call_contacts_select on public.call_contacts;
create policy call_contacts_select on public.call_contacts for select to authenticated
  using (company_id = auth_company_id() and exists (select 1 from coaching_sessions s where s.id = call_contacts.session_id));
drop policy if exists call_contacts_insert on public.call_contacts;
create policy call_contacts_insert on public.call_contacts for insert to authenticated
  with check (company_id = auth_company_id() and actor_id = auth.uid()
              and exists (select 1 from coaching_sessions s where s.id = call_contacts.session_id)
              and exists (select 1 from contacts c where c.id = call_contacts.contact_id));
drop policy if exists rss_not_hidden on public.call_contacts;
create policy rss_not_hidden on public.call_contacts as restrictive for select to authenticated
  using (session_id is null or session_id not in (select public.rss_hidden_calls_for_me()));

do $$
declare t text;
begin
  foreach t in array array['accounts', 'account_events', 'contacts', 'contact_events', 'deal_contacts', 'call_contacts'] loop
    execute format('drop policy if exists mfa_required on public.%I', t);
    execute format('create policy mfa_required on public.%I as restrictive for all to authenticated using ((select public.rss_mfa_ok())) with check ((select public.rss_mfa_ok()))', t);
    -- Append-only; only legal erasure may change or remove a row (0285's pattern).
    execute format('create or replace rule %I as on update to public.%I where coalesce(current_setting(''rss.erasure'', true), '''') <> ''on'' do instead nothing', t || '_no_update', t);
    execute format('create or replace rule %I as on delete to public.%I where coalesce(current_setting(''rss.erasure'', true), '''') <> ''on'' do instead nothing', t || '_no_delete', t);
  end loop;
end $$;

-- 7. Current state (security_invoker: the caller's RLS applies, A30) ---------------------------------------------------
create or replace view public.accounts_current with (security_invoker = true) as
select a.id, a.company_id, a.created_by, a.created_at,
       (select e.value ->> 'text' from account_events e where e.account_id = a.id and e.kind = 'name' order by e.id desc limit 1) as name
from accounts a;
grant select on public.accounts_current to authenticated, service_role;

create or replace view public.contacts_current with (security_invoker = true) as
select c.id, c.company_id, c.created_by, c.created_at,
       (select e.value ->> 'text' from contact_events e where e.contact_id = c.id and e.kind = 'name' order by e.id desc limit 1) as name,
       (select e.value ->> 'text' from contact_events e where e.contact_id = c.id and e.kind = 'title' order by e.id desc limit 1) as title,
       (select nullif(e.value ->> 'account_id', '')::uuid from contact_events e where e.contact_id = c.id and e.kind = 'account' order by e.id desc limit 1) as account_id
from contacts c;
grant select on public.contacts_current to authenticated, service_role;

-- The current contacts of each deal and each call: the latest row per pair, minus the removed ones.
create or replace view public.deal_contacts_current with (security_invoker = true) as
select distinct on (dc.prospect_id, dc.contact_id) dc.prospect_id, dc.contact_id, dc.company_id, dc.role, dc.actor_id, dc.created_at
from deal_contacts dc order by dc.prospect_id, dc.contact_id, dc.id desc;
grant select on public.deal_contacts_current to authenticated, service_role;

create or replace view public.call_contacts_current with (security_invoker = true) as
select distinct on (cc.session_id, cc.contact_id) cc.session_id, cc.contact_id, cc.company_id, cc.linked, cc.actor_id, cc.created_at
from call_contacts cc order by cc.session_id, cc.contact_id, cc.id desc;
grant select on public.call_contacts_current to authenticated, service_role;

-- 0325's view, column for column, plus `account_id` last.
create or replace view public.remote_prospects_current with (security_invoker = true) as
select
  p.id, p.company_id, p.rep_id, p.created_at,
  (select e.value ->> 'text' from remote_prospect_events e where e.prospect_id = p.id and e.kind = 'name' order by e.id desc limit 1) as name,
  (select e.value ->> 'text' from remote_prospect_events e where e.prospect_id = p.id and e.kind = 'organization' order by e.id desc limit 1) as organization,
  coalesce((select e.value ->> 'status' from remote_prospect_events e where e.prospect_id = p.id and e.kind = 'stage' order by e.id desc limit 1), 'open') as status,
  (select e.value ->> 'label' from remote_prospect_events e where e.prospect_id = p.id and e.kind = 'stage' order by e.id desc limit 1) as stage_label,
  (select (e.value ->> 'amount')::numeric from remote_prospect_events e where e.prospect_id = p.id and e.kind = 'amount' order by e.id desc limit 1) as amount,
  (select e.value ->> 'date' from remote_prospect_events e where e.prospect_id = p.id and e.kind = 'next_call' order by e.id desc limit 1) as next_call_date,
  (select max(s.started_at) from remote_prospect_calls c join coaching_sessions s on s.id = c.session_id where c.prospect_id = p.id) as last_call_at,
  (select count(*) from remote_prospect_calls c where c.prospect_id = p.id) as call_count,
  (select e.value ->> 'text' from remote_prospect_events e where e.prospect_id = p.id and e.kind = 'source' order by e.id desc limit 1) as source,
  (select e.value ->> 'date' from remote_prospect_events e where e.prospect_id = p.id and e.kind = 'close_date' order by e.id desc limit 1) as close_date,
  (select e.value ->> 'time' from remote_prospect_events e where e.prospect_id = p.id and e.kind = 'next_call' order by e.id desc limit 1) as next_call_time,
  (select nullif(e.value ->> 'account_id', '')::uuid from remote_prospect_events e where e.prospect_id = p.id and e.kind = 'account' order by e.id desc limit 1) as account_id
from remote_prospects p;
grant select on public.remote_prospects_current to authenticated, service_role;

-- 8. Find or make an account, rename one (service role only; the route checks the caller first) -----------------------
create or replace function public.rss_account_lock(p_company uuid, p_key text) returns void
  language sql as $$ select pg_advisory_xact_lock(hashtextextended(p_company::text || ':' || p_key, 2701)) $$;

create or replace function public.rss_account_find_or_create(p_company uuid, p_actor uuid, p_name text) returns uuid
  language plpgsql security definer set search_path = public as $$
declare
  k text := public.rss_account_key(p_name);
  found_id uuid;
begin
  if k = '' or length(btrim(p_name)) > 120 then raise exception 'account name must be 1–120 characters'; end if;
  if not exists (select 1 from profiles pr where pr.id = p_actor and pr.company_id = p_company) then
    raise exception 'actor is not in this company';
  end if;
  perform public.rss_account_lock(p_company, k);
  select a.id into found_id from accounts_current a
   where a.company_id = p_company and public.rss_account_key(a.name) = k and a.name <> '(erased on request)'
   order by a.created_at asc limit 1;
  if found_id is not null then return found_id; end if;
  insert into accounts (company_id, created_by) values (p_company, p_actor) returning id into found_id;
  insert into account_events (account_id, company_id, kind, value, actor_id)
  values (found_id, p_company, 'name', jsonb_build_object('text', btrim(p_name)), p_actor);
  return found_id;
end $$;

-- A rename to a key another account already has is refused (it is the same company: merge is a separate step, not a
-- side effect of typing a name).
create or replace function public.rss_account_rename(p_company uuid, p_actor uuid, p_account uuid, p_name text) returns boolean
  language plpgsql security definer set search_path = public as $$
declare
  k text := public.rss_account_key(p_name);
begin
  if k = '' or length(btrim(p_name)) > 120 then raise exception 'account name must be 1–120 characters'; end if;
  if not exists (select 1 from accounts a where a.id = p_account and a.company_id = p_company) then
    raise exception 'account not found for this company';
  end if;
  perform public.rss_account_lock(p_company, k);
  if exists (select 1 from accounts_current a where a.company_id = p_company and a.id <> p_account
                and public.rss_account_key(a.name) = k and a.name <> '(erased on request)') then
    return false;
  end if;
  insert into account_events (account_id, company_id, kind, value, actor_id)
  values (p_account, p_company, 'name', jsonb_build_object('text', btrim(p_name)), p_actor);
  return true;
end $$;

-- A contact and its first facts in one transaction, as the caller (invoker: contacts' and contact_events' insert
-- policies are the gate, as rss_create_prospect, 0304).
create or replace function public.rss_create_contact(p_name text, p_title text, p_account uuid) returns uuid
  language plpgsql security invoker set search_path = public as $$
declare
  v_company uuid := auth_company_id();
  v_me uuid := auth.uid();
  v_id uuid;
begin
  insert into contacts (company_id, created_by) values (v_company, v_me) returning id into v_id;
  insert into contact_events (contact_id, company_id, kind, value, actor_id) values (v_id, v_company, 'name', jsonb_build_object('text', btrim(p_name)), v_me);
  if nullif(btrim(coalesce(p_title, '')), '') is not null then
    insert into contact_events (contact_id, company_id, kind, value, actor_id) values (v_id, v_company, 'title', jsonb_build_object('text', btrim(p_title)), v_me);
  end if;
  if p_account is not null then
    insert into contact_events (contact_id, company_id, kind, value, actor_id) values (v_id, v_company, 'account', jsonb_build_object('account_id', p_account::text), v_me);
  end if;
  return v_id;
end $$;

revoke all on function public.rss_account_lock(uuid, text) from public, anon, authenticated;
revoke all on function public.rss_account_find_or_create(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.rss_account_rename(uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.rss_create_contact(text, text, uuid) from public, anon;
grant execute on function public.rss_account_lock(uuid, text) to service_role;
grant execute on function public.rss_account_find_or_create(uuid, uuid, text) to service_role;
grant execute on function public.rss_account_rename(uuid, uuid, uuid, text) to service_role;
grant execute on function public.rss_create_contact(text, text, uuid) to authenticated;

-- 9. Backfill: each prospect's current organization becomes its account (once; skips prospects that have one) ---------
do $$
declare
  r record;
  acc uuid;
begin
  for r in
    select p.id, p.company_id, p.rep_id, p.organization
      from remote_prospects_current p
     where nullif(btrim(coalesce(p.organization, '')), '') is not null
       and p.organization <> '(erased on request)'
       and public.rss_account_key(p.organization) <> ''
       and not exists (select 1 from remote_prospect_events e where e.prospect_id = p.id and e.kind = 'account')
     order by p.created_at
  loop
    acc := public.rss_account_find_or_create(r.company_id, r.rep_id, left(btrim(r.organization), 120));
    insert into remote_prospect_events (prospect_id, company_id, kind, value, actor_id)
    values (r.id, r.company_id, 'account', jsonb_build_object('account_id', acc::text), r.rep_id);
  end loop;
end $$;

-- 10. Erasure (§3.1.1) -----------------------------------------------------------------------------------------------
-- Contacts and accounts that mention the identifier, for the admin to see and confirm (the 0323 pattern).
create or replace function public.rss_erasure_contact_matches(p_company uuid, p_kind text, p_value text)
returns table (entity text, id uuid, name text, detail text)
  language plpgsql stable security definer set search_path = public as $$
declare
  pat text := public.rss_erasure_text_pattern(p_kind, p_value);
begin
  return query
    (select 'contact'::text, c.id, c.name, c.title
       from contacts_current c
      where c.company_id = p_company and (coalesce(c.name, '') ~* pat or coalesce(c.title, '') ~* pat)
      order by c.created_at desc limit 200)
    union all
    (select 'account'::text, a.id, a.name, null::text
       from accounts_current a
      where a.company_id = p_company and coalesce(a.name, '') ~* pat
      order by a.created_at desc limit 200);
end $$;

-- The confirmed ones, if they still match: the name (and a contact's title) removed, renamed '(erased on request)'.
-- Completes the request when there are no calls (the route's order: day plans, prospects, these, then calls).
create or replace function public.rss_erase_contacts(p_company uuid, p_request uuid, p_contacts uuid[], p_accounts uuid[], p_kind text, p_value text, p_by uuid, p_complete boolean)
returns integer
  language plpgsql security definer set search_path = public as $$
declare
  pat text := public.rss_erasure_text_pattern(p_kind, p_value);
  cids uuid[];
  aids uuid[];
begin
  if not exists (select 1 from erasure_requests q where q.id = p_request and q.company_id = p_company) then
    raise exception 'RSS erasure: request not found for this company';
  end if;
  if exists (select 1 from erasure_completions e where e.request_id = p_request) then
    raise exception 'RSS erasure: this request has already been carried out';
  end if;
  select coalesce(array_agg(c.id), '{}') into cids from contacts_current c
   where c.company_id = p_company and c.id = any (coalesce(p_contacts, '{}'))
     and (coalesce(c.name, '') ~* pat or coalesce(c.title, '') ~* pat);
  select coalesce(array_agg(a.id), '{}') into aids from accounts_current a
   where a.company_id = p_company and a.id = any (coalesce(p_accounts, '{}')) and coalesce(a.name, '') ~* pat;
  perform set_config('rss.erasure', 'on', true);
  delete from contact_events where contact_id = any (cids) and kind in ('name', 'title');
  insert into contact_events (contact_id, company_id, kind, value, actor_id)
    select x, p_company, 'name', jsonb_build_object('text', '(erased on request)'), p_by from unnest(cids) x;
  delete from account_events where account_id = any (aids) and kind = 'name';
  insert into account_events (account_id, company_id, kind, value, actor_id)
    select x, p_company, 'name', jsonb_build_object('text', '(erased on request)'), p_by from unnest(aids) x;
  if p_complete then
    insert into erasure_completions (request_id, company_id, sessions_erased, erased_by) values (p_request, p_company, 0, p_by);
  end if;
  perform set_config('rss.erasure', 'off', true);
  return cardinality(cids) + cardinality(aids);
end $$;

revoke all on function public.rss_erasure_contact_matches(uuid, text, text) from public, anon, authenticated;
revoke all on function public.rss_erase_contacts(uuid, uuid, uuid[], uuid[], text, text, uuid, boolean) from public, anon, authenticated;
grant execute on function public.rss_erasure_contact_matches(uuid, text, text) to service_role;
grant execute on function public.rss_erase_contacts(uuid, uuid, uuid[], uuid[], text, text, uuid, boolean) to service_role;

-- rss_erase_sessions: 0369's exact body plus one step (marked 0370) — the contacts on the erased calls lose their name
-- and title, and an account every one of whose deals is being renamed now (it exists only for this customer) loses its
-- name. A contact on another deal of the same account, or an account with other deals, is someone else's data and stays.
create or replace function public.rss_erase_sessions(p_company uuid, p_request uuid, p_sessions uuid[], p_by uuid)
returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  n_sessions integer;
  pitch_ids uuid[];
  ft_ids uuid[];
  task_ids uuid[];
  item_ids uuid[];
  chat_ids uuid[];
  subjects text[];
  task_subjects text[];
  brief_ids uuid[];
  prospect_ids uuid[];
  mm_task_ids uuid[];
  contact_ids uuid[];
  account_ids uuid[];
  c jsonb := '{}'::jsonb;
  k integer;
begin
  if p_sessions is null or cardinality(p_sessions) = 0 then
    raise exception 'RSS erasure: no calls to erase';
  end if;
  if not exists (select 1 from erasure_requests r where r.id = p_request and r.company_id = p_company) then
    raise exception 'RSS erasure: request not found for this company';
  end if;
  -- 0369 (review 2026-11-26): take each call's transcript lock — the one copy_transcript_version (0284) and
  -- rss_transcript_version_with_texts (0368) take — so a re-apply or trim running at the same moment can't add a new
  -- version of the lines after they're deleted here. In a fixed order, so two erasures can't deadlock.
  perform pg_advisory_xact_lock(hashtextextended(s::text, 2690)) from (select distinct unnest(p_sessions) as s order by 1) x;
  if exists (select 1 from erasure_completions e where e.request_id = p_request) then
    raise exception 'RSS erasure: this request has already been carried out';
  end if;
  select count(*) into n_sessions from coaching_sessions s where s.id = any (p_sessions) and s.company_id = p_company;
  if n_sessions <> cardinality(p_sessions) then
    raise exception 'RSS erasure: every call must belong to the requesting company';
  end if;

  perform set_config('rss.erasure', 'on', true);

  select coalesce(array_agg(id), '{}') into pitch_ids from pitch_scores where session_id = any (p_sessions);
  select coalesce(array_agg(id), '{}') into ft_ids from session_follow_through where session_id = any (p_sessions);
  select coalesce(array_agg(task_id), '{}') into task_ids from callback_tasks where follow_through_id = any (ft_ids);
  select coalesce(array_agg(id), '{}') into item_ids from library_items where session_id = any (p_sessions);
  select coalesce(array_agg(id), '{}') into chat_ids from ask_coach_chats where company_id = p_company and session_ids && p_sessions;
  select array_agg('sales_session:' || x::text) into subjects from unnest(p_sessions) x;
  select coalesce(array_agg('task:' || x::text), '{}') into task_subjects from unnest(task_ids) x;
  -- 0316: Macro Mode and call notes.
  select coalesce(array_agg(id), '{}') into brief_ids from remote_call_briefs where company_id = p_company and session_id = any (p_sessions);
  select coalesce(array_agg(distinct prospect_id), '{}') into prospect_ids from remote_prospect_calls where company_id = p_company and session_id = any (p_sessions);
  select coalesce(array_agg(distinct x), '{}') into mm_task_ids from (
    select (item ->> 'task_id')::uuid as x
      from remote_checklist_reviews r, jsonb_array_elements(r.kept) item
     where r.brief_id = any (brief_ids) and (item ->> 'task_id') ~ '^[0-9a-f-]{36}$'
    union
    select task_id from remote_prospect_tasks where prospect_id = any (prospect_ids)
  ) t where x is not null;
  -- 0370: the contacts on these calls; the accounts that exist only for the deals being renamed.
  select coalesce(array_agg(distinct contact_id), '{}') into contact_ids from call_contacts where company_id = p_company and session_id = any (p_sessions);
  select coalesce(array_agg(distinct acc), '{}') into account_ids from (
    select nullif(e.value ->> 'account_id', '')::uuid as acc
      from remote_prospect_events e
     where e.kind = 'account' and e.prospect_id = any (prospect_ids)
  ) a
  where acc is not null
    and not exists (select 1 from remote_prospect_events o
                     where o.kind = 'account' and o.value ->> 'account_id' = a.acc::text and o.prospect_id <> all (prospect_ids));

  -- DELETED: the customer's words.
  delete from coaching_transcript_segments where session_id = any (p_sessions);
  get diagnostics k = row_count; c := c || jsonb_build_object('transcript_lines', k);
  delete from coaching_cue_outcomes where session_id = any (p_sessions);
  delete from coaching_cues where session_id = any (p_sessions);
  delete from coaching_retranscribe_cache where session_id = any (p_sessions);
  delete from after_pitch_summaries where session_id = any (p_sessions);
  -- 0350: by subject alone. Every subject is one of THIS company's calls (checked above), so an event about it is erased
  -- even if it was filed under another company's id (233 such rows on production, OPEN.md 2026-11-26).
  delete from events where subject = any (subjects);
  get diagnostics k = row_count; c := c || jsonb_build_object('ai_reads', k);
  delete from callback_tasks where follow_through_id = any (ft_ids);
  delete from session_follow_through where id = any (ft_ids);
  delete from tracker_hits where session_id = any (p_sessions);
  delete from library_item_removals where item_id = any (item_ids);
  delete from library_items where id = any (item_ids);
  delete from snippets where session_id = any (p_sessions);
  delete from ask_coach_turns where chat_id = any (chat_ids);
  delete from ask_coach_chats where id = any (chat_ids);
  c := c || jsonb_build_object('ask_coach_chats', cardinality(chat_ids));
  -- 0316
  delete from call_notes where company_id = p_company and session_id = any (p_sessions);
  get diagnostics k = row_count; c := c || jsonb_build_object('call_notes', k);
  delete from remote_checklist_reviews where brief_id = any (brief_ids);
  delete from remote_call_briefs where id = any (brief_ids);
  -- 0364: custom brief answers quote the customer.
  delete from custom_briefs where company_id = p_company and session_id = any (p_sessions);
  c := c || jsonb_build_object('call_briefs', cardinality(brief_ids));
  delete from remote_followup_drafts where company_id = p_company and session_id = any (p_sessions);
  get diagnostics k = row_count; c := c || jsonb_build_object('followup_drafts', k);
  -- 0343: names given to the call's speakers — a customer's name is personal data.
  delete from call_speaker_names where company_id = p_company and session_id = any (p_sessions);
  get diagnostics k = row_count; c := c || jsonb_build_object('speaker_names', k);

  -- BLANKED, ROW KEPT: the facts (that the call happened, its rep, its outcome, its grades and points) stay.
  update coaching_sessions
     set client_label = null, territory = null, approach = null, offer = null, audio_asset_url = null
   where id = any (p_sessions) and company_id = p_company;
  update pitch_scores set transcript = null, audio_url = null where id = any (pitch_ids);
  update pitch_score_elements set evidence = null where pitch_id = any (pitch_ids) and evidence is not null;
  update pitch_score_events set evidence = null where pitch_id = any (pitch_ids) and evidence is not null;
  -- 0366 (founder picker 2026-11-26, "Blank the text"): typed notes about these calls' scores can quote the customer.
  -- The words go; that a dispute or answer happened, who wrote it, when, and the score stay (the callback-task rule).
  update events set payload = rss_scrub_keys(payload, array['note'])
   where subject = any (array(select 'pitch:' || p::text from unnest(pitch_ids) p))
     and kind in ('coach.pitch_score_disputed', 'coach.pitch_score_answered');
  update pitch_score_overrides set reason = '[erased]' where pitch_id = any (pitch_ids) and reason <> '[erased]';
  update pitch_score_archive
     set archived_payload = rss_scrub_keys(archived_payload, array['evidence', 'transcript', 'audio_url', 'quote'])
   where pitch_score_id = any (pitch_ids);
  update tasks set title = 'Call back (details erased on request)', description = null where id = any (task_ids);
  update events set payload = rss_scrub_keys(payload, array['title', 'description'])
   where subject = any (task_subjects); -- 0350: task ids are this company's (from its calls), whatever the row's company
  update signals set payload = rss_scrub_keys(payload, array['title', 'description'])
   where source = any (task_subjects); -- 0351: as the task-event scrub above (0350), whatever the row's company
  c := c || jsonb_build_object('tasks_blanked', cardinality(task_ids));
  -- 0316: Tasks the call's checklist or the prospect's to-dos created; the prospect's name and organization.
  update tasks set title = 'To-do (details erased on request)', description = null where id = any (mm_task_ids);
  c := c || jsonb_build_object('prospect_tasks_blanked', cardinality(mm_task_ids));
  delete from remote_prospect_events where prospect_id = any (prospect_ids) and kind in ('name', 'organization');
  insert into remote_prospect_events (prospect_id, company_id, kind, value, actor_id)
    select p, p_company, 'name', jsonb_build_object('text', '(erased on request)'), p_by from unnest(prospect_ids) p;
  c := c || jsonb_build_object('prospects_renamed', cardinality(prospect_ids));
  -- 0370: the contacts on these calls (name and title) and the accounts only these deals were on (name).
  delete from contact_events where contact_id = any (contact_ids) and kind in ('name', 'title');
  insert into contact_events (contact_id, company_id, kind, value, actor_id)
    select x, p_company, 'name', jsonb_build_object('text', '(erased on request)'), p_by from unnest(contact_ids) x;
  delete from account_events where account_id = any (account_ids) and kind = 'name';
  insert into account_events (account_id, company_id, kind, value, actor_id)
    select x, p_company, 'name', jsonb_build_object('text', '(erased on request)'), p_by from unnest(account_ids) x;
  c := c || jsonb_build_object('contacts_renamed', cardinality(contact_ids), 'accounts_renamed', cardinality(account_ids));
  -- 0316: a rep's feedback-request message about the call, and notification text that quotes it or names the client.
  update feedback_requests set message = null where company_id = p_company and session_id = any (p_sessions) and message is not null;
  get diagnostics k = row_count; c := c || jsonb_build_object('feedback_messages_blanked', k);
  update manager_notifications set payload = rss_scrub_keys(payload, array['client_label', 'excerpt'])
   where company_id = p_company and session_id = any (p_sessions);
  get diagnostics k = row_count; c := c || jsonb_build_object('notifications_scrubbed', k);
  -- 0317 (founder picker 2026-11-23, "Retire them"): practice scenarios a manager built from an erased call may describe
  -- the customer. They are immutable by design (0282); retiring is the one change their guard allows. Retired scenarios
  -- leave Training and can't be assigned; past attempts keep their scores (non-personal facts, §3.1.1(3)).
  update training_scenarios set retired_at = now()
   where company_id = p_company and source_session_id = any (p_sessions) and retired_at is null;
  get diagnostics k = row_count; c := c || jsonb_build_object('scenarios_retired', k);

  insert into erasure_completions (request_id, company_id, sessions_erased, erased_by)
  values (p_request, p_company, n_sessions, p_by);
  perform set_config('rss.erasure', '', true);
  return c || jsonb_build_object('sessions', n_sessions);
end $$;

revoke all on function public.rss_erase_sessions(uuid, uuid, uuid[], uuid) from public, anon, authenticated;
grant execute on function public.rss_erase_sessions(uuid, uuid, uuid[], uuid) to service_role;
