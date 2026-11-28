-- 0397 — the sandbox company (2026-11-28; revenue plan phase 11; Gong F2.9; founder picker "Sandbox company").
-- Re-runnable.
--
--   · companies.is_sandbox — a company of sample data for trials, demos and training. Only the server sets it: a
--     signed-in user can neither create a company with it nor change it (guard below). Every page in it says "Sample
--     data" (the app reads the flag).
--   · rss_sandbox_seed(company, admin, reps) — the sample itself, in one transaction: three accounts, four contacts,
--     six deals across the reps (open, won and lost; stages, amounts, close dates around today; one split), three short
--     sample calls on deals with their transcripts, and who was on them. It REFUSES a company that isn't a sandbox
--     (§3.4: sample data never enters a real company) and one that already has deals (seeded once). Service role only.
--     Everything it writes is plainly fictional and labelled "Sample".

alter table public.companies add column if not exists is_sandbox boolean not null default false;

create or replace function public.guard_company_sandbox_flag() returns trigger
  language plpgsql set search_path = public as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if tg_op = 'INSERT' and new.is_sandbox then
    raise exception 'companies.is_sandbox is set by the server only';
  end if;
  if tg_op = 'UPDATE' and new.is_sandbox is distinct from old.is_sandbox then
    raise exception 'companies.is_sandbox is set by the server only';
  end if;
  return new;
end $$;
drop trigger if exists companies_guard_sandbox_flag on public.companies;
create trigger companies_guard_sandbox_flag before insert or update on public.companies
  for each row execute function public.guard_company_sandbox_flag();

create or replace function public.rss_sandbox_seed(p_company uuid, p_admin uuid, p_reps uuid[]) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  acc uuid[] := '{}';
  con uuid[] := '{}';
  deal uuid[] := '{}';
  sess uuid[] := '{}';
  a uuid; c uuid; d uuid; s uuid;
  rep uuid;
  i integer;
  names text[] := array['Northwind Sample Co', 'Contoso Sample Ltd', 'Fabrikam Sample Inc'];
  people text[] := array['Sam Sample', 'Jordan Example', 'Riley Demo', 'Casey Placeholder'];
  titles text[] := array['VP Operations', 'IT Manager', 'CFO', 'Office Manager'];
  person_acc integer[] := array[1, 1, 2, 3];
  -- deals: name, account index, rep index, status, stage, amount, close in days, next call in days
  d_name text[] := array['Sample: Northwind fleet upgrade', 'Sample: Northwind support renewal', 'Sample: Contoso rollout', 'Sample: Contoso pilot', 'Sample: Fabrikam starter plan', 'Sample: Fabrikam multi-site'];
  d_acc integer[] := array[1, 1, 2, 2, 3, 3];
  d_rep integer[] := array[1, 2, 1, 3, 2, 3];
  d_status text[] := array['open', 'won', 'open', 'lost', 'open', 'open'];
  d_stage text[] := array['Proposal', 'Closed won', 'Discovery', 'Closed lost', 'Demo', 'Negotiation'];
  d_amount numeric[] := array[48000, 12500, 30000, 9000, 6000, 72000];
  d_close integer[] := array[21, -10, 45, -20, 14, 30];
  d_next integer[] := array[1, null, 3, null, 2, 5];
  n_reps integer;
begin
  if not exists (select 1 from companies where id = p_company and is_sandbox) then
    raise exception 'sandbox seed: this company is not a sandbox — sample data never goes into a real company';
  end if;
  if exists (select 1 from remote_prospects where company_id = p_company) then
    raise exception 'sandbox seed: this sandbox already has deals (it is seeded once)';
  end if;
  n_reps := coalesce(array_length(p_reps, 1), 0);
  if n_reps < 1 then raise exception 'sandbox seed: at least one sample rep'; end if;
  if exists (select 1 from unnest(array[p_admin] || p_reps) u left join profiles p on p.id = u where p.id is null or p.company_id is distinct from p_company) then
    raise exception 'sandbox seed: the admin and reps must be people of this sandbox';
  end if;

  for i in 1 .. 3 loop
    insert into accounts (company_id, created_by) values (p_company, p_admin) returning id into a;
    insert into account_events (account_id, company_id, kind, value, actor_id) values (a, p_company, 'name', jsonb_build_object('text', names[i]), p_admin);
    acc := acc || a;
  end loop;
  for i in 1 .. 4 loop
    insert into contacts (company_id, created_by) values (p_company, p_admin) returning id into c;
    insert into contact_events (contact_id, company_id, kind, value, actor_id) values
      (c, p_company, 'name', jsonb_build_object('text', people[i]), p_admin),
      (c, p_company, 'title', jsonb_build_object('text', titles[i]), p_admin),
      (c, p_company, 'account', jsonb_build_object('account_id', acc[person_acc[i]]), p_admin);
    con := con || c;
  end loop;
  for i in 1 .. 6 loop
    rep := p_reps[((d_rep[i] - 1) % n_reps) + 1];
    insert into remote_prospects (company_id, rep_id, created_by) values (p_company, rep, rep) returning id into d;
    insert into remote_prospect_events (prospect_id, company_id, kind, value, actor_id) values
      (d, p_company, 'name', jsonb_build_object('text', d_name[i]), rep),
      (d, p_company, 'organization', jsonb_build_object('text', names[d_acc[i]]), rep),
      (d, p_company, 'account', jsonb_build_object('account_id', acc[d_acc[i]]), rep),
      (d, p_company, 'amount', jsonb_build_object('amount', d_amount[i]), rep),
      (d, p_company, 'stage', jsonb_build_object('status', d_status[i], 'label', d_stage[i]), rep),
      (d, p_company, 'close_date', jsonb_build_object('date', to_char(current_date + d_close[i], 'YYYY-MM-DD')), rep);
    if d_next[i] is not null then
      insert into remote_prospect_events (prospect_id, company_id, kind, value, actor_id)
        values (d, p_company, 'next_call', jsonb_build_object('date', to_char(current_date + d_next[i], 'YYYY-MM-DD')), rep);
    end if;
    deal := deal || d;
  end loop;
  -- People on the deals.
  insert into deal_contacts (prospect_id, contact_id, company_id, role, actor_id) values
    (deal[1], con[1], p_company, 'decision_maker', p_admin),
    (deal[1], con[2], p_company, 'champion', p_admin),
    (deal[3], con[3], p_company, 'decision_maker', p_admin),
    (deal[6], con[4], p_company, 'champion', p_admin);
  -- One split, when there are two reps: deal 6 shared 70/30.
  if n_reps >= 2 then
    insert into deal_splits (company_id, prospect_id, shares, set_by) values
      (p_company, deal[6], jsonb_build_array(
        jsonb_build_object('user_id', (select rep_id from remote_prospects where id = deal[6])::text, 'pct', 70),
        jsonb_build_object('user_id', (case when (select rep_id from remote_prospects where id = deal[6]) = p_reps[1] then p_reps[2] else p_reps[1] end)::text, 'pct', 30)),
      p_admin);
  end if;
  -- Three short sample calls on deals 1, 3 and 6, with transcripts, linked to their deals.
  for i in 1 .. 3 loop
    d := deal[(array[1, 3, 6])[i]];
    rep := (select rep_id from remote_prospects where id = d);
    insert into coaching_sessions (company_id, agent_id, context, client_label, status, started_at, ended_at, session_kind, outcome)
      values (p_company, rep, 'phone', names[(array[1, 2, 3])[i]], 'ended', now() - make_interval(days => 3 + i), now() - make_interval(days => 3 + i) + interval '14 minutes', 'sales', 'follow_up')
      returning id into s;
    insert into coaching_transcript_segments (session_id, speaker, text, seq, spoken_at, version, source)
    select s, x.speaker, x.text, x.seq, now() - make_interval(days => 3 + i) + make_interval(secs => x.seq * 20), 1, 'manual'
    from (values
      (1, 'agent', 'Thanks for making time today. This is a sample call for the demo company.'),
      (2, 'customer', 'Sure. We are looking at options before the end of the quarter.'),
      (3, 'agent', 'What is driving the timing on your side?'),
      (4, 'customer', 'Our current provider raised the price and support has been slow.'),
      (5, 'agent', 'Who else is involved in the decision?'),
      (6, 'customer', 'Our finance lead signs off on anything over budget.'),
      (7, 'agent', 'Would it help if I sent a proposal and we booked a call with your finance lead?'),
      (8, 'customer', 'Yes, send it over and we will find a time next week.')
    ) as x(seq, speaker, text);
    insert into remote_prospect_calls (prospect_id, session_id, company_id, linked_by) values (d, s, p_company, rep);
    sess := sess || s;
  end loop;
  insert into call_contacts (session_id, contact_id, company_id, linked, actor_id) values
    (sess[1], con[1], p_company, true, p_admin),
    (sess[2], con[3], p_company, true, p_admin),
    (sess[3], con[4], p_company, true, p_admin);

  return jsonb_build_object('accounts', array_length(acc, 1), 'contacts', array_length(con, 1), 'deals', array_length(deal, 1), 'calls', array_length(sess, 1));
end $$;
revoke all on function public.rss_sandbox_seed(uuid, uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.rss_sandbox_seed(uuid, uuid, uuid[]) to service_role;
