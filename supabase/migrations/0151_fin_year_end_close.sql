-- 0151 — Financial System, PHASE 7 (part 2): year-end close (founder-confirmed: build it now).
--
-- Posts the standard closing entry: zero every revenue + expense account for the fiscal year into
-- Retained Earnings (3900), then lock the year's periods. Real double-entry, balanced by construction
-- (Dr revenue balances + Cr expense balances + RE = net income). Reversible via fin_reopen_year.
-- Idempotent (guarded against double-close). Also cleans up the ranged-Balance-Sheet caveat: after
-- close, prior-year P&L lives in Retained Earnings, so an as-of balance sheet reads correctly.

create table if not exists fin_year_closes (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references companies(id) on delete cascade,
  fiscal_year  int not null,
  entry_id     uuid references fin_journal_entries(id) on delete restrict,
  closed_by    uuid default auth.uid() references auth.users(id) on delete set null,
  closed_at    timestamptz not null default now(),
  constraint fin_year_closes_uq unique (company_id, fiscal_year)
);

alter table fin_year_closes enable row level security;
drop policy if exists "fin_year_closes - select" on fin_year_closes;
create policy "fin_year_closes - select" on fin_year_closes
  for select using (company_id = auth_company_id() and fin_can_view());
-- writes only via the DEFINER close/reopen functions.

create or replace function fin_close_year(p_fiscal_year int)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_company uuid; v_re uuid; v_base char(3); v_period uuid; v_date date;
  v_lines jsonb; v_rev numeric(19,4); v_exp numeric(19,4); v_net numeric(19,4); v_entry uuid;
begin
  v_company := auth_company_id();
  if not fin_can_configure() then raise exception 'Not authorized to close the year (controller/CFO)'; end if;
  if exists (select 1 from fin_year_closes where company_id = v_company and fiscal_year = p_fiscal_year) then
    raise exception 'Fiscal year % is already closed — reopen it first to re-close', p_fiscal_year;
  end if;

  v_date := make_date(p_fiscal_year, 12, 31);
  select base_currency into v_base from fin_settings where company_id = v_company;
  v_re := fin_account_by_code(v_company, '3900');
  if v_re is null then raise exception 'Retained Earnings (3900) missing — initialize finance'; end if;

  -- Per-account P&L balances for the year, as closing lines (Dr revenue balance / Cr expense balance).
  select coalesce(jsonb_agg(l.line), '[]'::jsonb),
         coalesce(sum(case when accts.t = 'revenue' then accts.bal else 0 end), 0),
         coalesce(sum(case when accts.t = 'expense' then accts.bal else 0 end), 0)
    into v_lines, v_rev, v_exp
  from (
    select a.type as t, l.account_id,
           case when a.type = 'revenue' then sum(l.base_credit - l.base_debit)
                else sum(l.base_debit - l.base_credit) end as bal
    from fin_journal_lines l
    join fin_journal_entries e on e.id = l.entry_id
    join fin_accounts a on a.id = l.account_id
    where l.company_id = v_company and e.status = 'posted'
      and a.type in ('revenue','expense') and extract(year from e.entry_date) = p_fiscal_year
    group by a.type, l.account_id
    having (case when a.type = 'revenue' then sum(l.base_credit - l.base_debit)
                 else sum(l.base_debit - l.base_credit) end) <> 0
  ) accts,
  lateral (select jsonb_build_object(
    'account_id', accts.account_id,
    'debit',  case when accts.t = 'revenue' then accts.bal else 0 end,
    'credit', case when accts.t = 'expense' then accts.bal else 0 end,
    'currency', v_base, 'memo', 'Year-end close ' || p_fiscal_year) as line) l;

  if v_rev = 0 and v_exp = 0 then
    raise exception 'Nothing to close for % — no posted revenue or expense activity', p_fiscal_year;
  end if;

  -- Net income to Retained Earnings (Cr if profit, Dr if loss) — the balancing line. ONLY when net
  -- is non-zero: a debit=0/credit=0 line would violate the debit-XOR-credit CHECK (0118). When net is
  -- exactly 0 (revenue = expense), the revenue debits + expense credits already balance with no RE line.
  v_net := v_rev - v_exp;
  if v_net <> 0 then
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'account_id', v_re, 'debit', greatest(-v_net, 0), 'credit', greatest(v_net, 0),
      'currency', v_base, 'memo', 'Net income to Retained Earnings ' || p_fiscal_year));
  end if;

  -- Post into the open period covering Dec 31 (then we lock the year below).
  select id into v_period from fin_periods
    where company_id = v_company and status = 'open' and v_date between start_date and end_date
    order by start_date desc limit 1;
  if v_period is null then raise exception 'The period covering % must be OPEN to post the closing entry', v_date; end if;

  v_entry := fin_post_system_entry(v_company, v_date, v_period, 'Year-end close ' || p_fiscal_year, 'close', v_lines);
  insert into fin_year_closes (company_id, fiscal_year, entry_id) values (v_company, p_fiscal_year, v_entry);

  -- Lock every period of the fiscal year (year-end hard freeze).
  update fin_periods set status = 'locked'
    where company_id = v_company and status <> 'locked'
      and start_date >= make_date(p_fiscal_year, 1, 1) and end_date <= make_date(p_fiscal_year, 12, 31);
  return v_entry;
end $$;

-- Reopen: unlock the year, POST a direct reversal of the closing entry (undoing it immediately so a
-- later re-close can't double-count), then clear the mark. Reversal is symmetric to the close — a
-- configure-level action posted through the system primitive, not a draft (which would leave the
-- close half-undone while the mark is gone).
create or replace function fin_reopen_year(p_fiscal_year int)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_company uuid; v_entry uuid; v_period uuid; v_date date; v_lines jsonb; v_rev uuid;
begin
  v_company := auth_company_id();
  if not fin_can_configure() then raise exception 'Not authorized to reopen the year'; end if;
  select entry_id into v_entry from fin_year_closes where company_id = v_company and fiscal_year = p_fiscal_year;
  if v_entry is null then raise exception 'Fiscal year % is not closed', p_fiscal_year; end if;

  -- Unlock the year's periods so the reversal can post.
  update fin_periods set status = 'open'
    where company_id = v_company and status = 'locked'
      and start_date >= make_date(p_fiscal_year, 1, 1) and end_date <= make_date(p_fiscal_year, 12, 31);

  -- Reversal lines = the closing entry's lines with debit/credit flipped.
  select coalesce(jsonb_agg(jsonb_build_object(
           'account_id', l.account_id, 'debit', l.base_credit, 'credit', l.base_debit,
           'currency', l.currency, 'memo', 'Reopen ' || p_fiscal_year) order by l.line_no), '[]'::jsonb)
    into v_lines from fin_journal_lines l where l.entry_id = v_entry;

  v_date := make_date(p_fiscal_year, 12, 31);
  select id into v_period from fin_periods
    where company_id = v_company and status = 'open' and v_date between start_date and end_date
    order by start_date desc limit 1;
  if v_period is null then raise exception 'The period covering % must be open to post the reversal', v_date; end if;

  v_rev := fin_post_system_entry(v_company, v_date, v_period, 'Reopen year ' || p_fiscal_year, 'close', v_lines);
  delete from fin_year_closes where company_id = v_company and fiscal_year = p_fiscal_year;
  return v_rev;
end $$;
