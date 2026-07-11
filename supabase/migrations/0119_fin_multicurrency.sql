-- 0119 — Financial System, Increment 4: Multi-currency (rates + authoritative FX + init)
--
-- Manual rate entry now, API-ready (decision #4). Delivers:
--   • fin_exchange_rates (per-company, dated, source=manual|api)
--   • fin_get_rate(company, from, to, as_of): most-recent rate on/before the date (1 if from=to)
--   • upgrades fin_lines_compute_base to use the AUTHORITATIVE rate from the table (not a client-
--     supplied fx_rate) — line currency -> company base, as of the entry date. Single-currency
--     entries are unaffected (currency=base -> rate 1 -> base=face), so Increment 3 behaviour holds.
--   • fin_init_company(base_currency): bootstrap a company's finances (settings + a standard COA,
--     incl. the is_system FX Gain/Loss account). Gated to configure-level (a platform admin
--     qualifies via the bridge).
--
-- FX GAIN/LOSS (realized) is generated at SETTLEMENT (AP/AR payment, Phase 2) when the payment
-- rate differs from the booking rate; the structure (system account + dated rates) is in place
-- now. Period-end unrealized revaluation is FLAGGED for a later increment.
--
-- Idempotent (A12). Acceptance: docs/financial-system/tests/0119_multicurrency.test.sql.

create table if not exists fin_exchange_rates (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies(id) on delete cascade,
  from_currency char(3) not null,
  to_currency   char(3) not null,
  rate          numeric(19,8) not null check (rate > 0),
  as_of_date    date not null,
  source        text not null default 'manual' check (source in ('manual','api')),
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  constraint fin_rates_uq unique (company_id, from_currency, to_currency, as_of_date),
  constraint fin_rates_diff_ck check (from_currency <> to_currency)
);
create index if not exists fin_rates_lookup_idx
  on fin_exchange_rates (company_id, from_currency, to_currency, as_of_date desc);

-- Most-recent rate on/before p_as_of; 1 when from=to; null if none exists (caller decides).
create or replace function fin_get_rate(p_company uuid, p_from char(3), p_to char(3), p_as_of date)
returns numeric language sql stable
security definer set search_path = public as $$
  select case when p_from = p_to then 1::numeric(19,8)
    else (select rate from fin_exchange_rates
           where company_id = p_company and from_currency = p_from and to_currency = p_to
             and as_of_date <= p_as_of
           order by as_of_date desc limit 1)
  end;
$$;

-- Upgrade base-amount computation to use the AUTHORITATIVE rate (client fx_rate is ignored/overwritten).
create or replace function fin_lines_compute_base()
returns trigger language plpgsql
security definer set search_path = public as $$
declare v_base char(3); v_date date; v_rate numeric(19,8);
begin
  select base_currency into v_base from fin_settings where company_id = NEW.company_id;
  v_base := coalesce(v_base, 'USD');
  if NEW.currency is null then NEW.currency := v_base; end if;

  if NEW.currency = v_base then
    NEW.fx_rate := 1;
  elsif current_setting('fin.trust_provided_rate', true) = '1' then
    -- System operation (e.g. a reversal): trust the PROVIDED fx_rate so the base amount matches
    -- the original exactly. Only reachable from SECURITY DEFINER functions that set this flag —
    -- a client PostgREST insert never sets it, so manual entries always take the authoritative
    -- lookup path below.
    if NEW.fx_rate is null or NEW.fx_rate <= 0 then
      raise exception 'fin: system line missing a valid fx_rate';
    end if;
    -- keep NEW.fx_rate as provided
  else
    -- Manual path: the rate is AUTHORITATIVE from the table (client fx_rate is ignored).
    select entry_date into v_date from fin_journal_entries where id = NEW.entry_id;
    v_rate := fin_get_rate(NEW.company_id, NEW.currency, v_base, v_date);
    if v_rate is null then
      raise exception 'fin: no exchange rate for %->% as of % (enter a rate first)', NEW.currency, v_base, v_date;
    end if;
    NEW.fx_rate := v_rate;
  end if;

  NEW.base_debit  := round(NEW.debit  * NEW.fx_rate, 4);
  NEW.base_credit := round(NEW.credit * NEW.fx_rate, 4);
  return NEW;
end $$;
-- (trigger fin_lines_compute_base_trg from 0118 already points at this function name.)

-- Bootstrap a company's finances: base currency + a minimal standard COA.
create or replace function fin_init_company(p_base_currency char(3) default 'USD')
returns void language plpgsql
security definer set search_path = public as $$
declare v_company uuid;
begin
  v_company := auth_company_id();
  if v_company is null then raise exception 'No company in context'; end if;
  if not fin_can_configure() then raise exception 'Not authorized to initialize finance'; end if;

  insert into fin_settings (company_id, base_currency, created_by)
    values (v_company, upper(p_base_currency), auth.uid())
    on conflict (company_id) do nothing;

  insert into fin_accounts (company_id, code, name, type, normal_balance, is_system) values
    (v_company, '1000', 'Cash',                'asset',     'debit',  false),
    (v_company, '1100', 'Accounts Receivable', 'asset',     'debit',  false),
    (v_company, '1500', 'Fixed Assets',        'asset',     'debit',  false),
    (v_company, '2000', 'Accounts Payable',    'liability', 'credit', false),
    (v_company, '2100', 'Taxes Payable',       'liability', 'credit', false),
    (v_company, '3000', 'Retained Earnings',   'equity',    'credit', true),
    (v_company, '3100', 'Owner Equity',        'equity',    'credit', false),
    (v_company, '4000', 'Revenue',             'revenue',   'credit', false),
    (v_company, '5000', 'Cost of Goods Sold',  'expense',   'debit',  false),
    (v_company, '6000', 'Operating Expenses',  'expense',   'debit',  false),
    (v_company, '7900', 'FX Gain/Loss',        'expense',   'debit',  true)
    on conflict (company_id, code) do nothing;
end $$;

-- ── RLS on rates: view with finance access; write requires configure-level (per the matrix,
-- rates are configuration — controller/cfo). ──
alter table fin_exchange_rates enable row level security;

drop policy if exists "fin_rates - select" on fin_exchange_rates;
create policy "fin_rates - select" on fin_exchange_rates
  for select using (company_id = auth_company_id() and fin_can_view());
drop policy if exists "fin_rates - write" on fin_exchange_rates;
create policy "fin_rates - write" on fin_exchange_rates
  for all using (company_id = auth_company_id() and fin_can_configure())
  with check (company_id = auth_company_id() and fin_can_configure());
