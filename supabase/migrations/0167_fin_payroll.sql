-- 0167 — PHASE 8 (Part A): PAYROLL — posted to the ledger, NOT computed here.
--
-- Built against the CONFIRMED Phase-8 model, and against the founder's explicit decision: payroll is
-- INTEGRATED, not rebuilt. This migration therefore does exactly one thing — it takes what a payroll
-- provider (Gusto / Deel / a local bureau) has already computed and puts it into the ledger correctly.
--
-- WHAT THIS DELIBERATELY DOES NOT DO, AND WHY THAT IS THE RIGHT CALL
-- It does not compute gross-to-net. It does not hold statutory tax tables. It does not file anything.
-- Building tax-accurate payroll is a regulated product: withholding tables change by jurisdiction and by
-- year, and being wrong is not a bug, it is a liability with a statutory penalty attached. A company that
-- owns that surface owns that risk forever. So the provider computes; we record. That division is the
-- feature, not a limitation of it.
--
-- ── THE IDENTITY THAT MAKES THE ENTRY BALANCE ─────────────────────────────────────────────────
--
--     gross = net_pay + withholdings
--
-- The posted entry is:
--     Dr Salary Expense          gross
--     Dr Employer Tax Expense    employer_tax
--     Cr Net Pay Payable         net_pay              (what the employee is owed)
--     Cr Withholdings Payable    withholdings         (what the tax authority is owed, on the employee's behalf)
--     Cr Employer Tax Payable    employer_tax         (what the tax authority is owed, by the company)
--
-- Debits  = gross + employer_tax
-- Credits = net_pay + withholdings + employer_tax
-- These are equal ONLY IF gross = net_pay + withholdings.
--
-- So that identity is enforced as a CHECK, and the posting function re-asserts it before touching the
-- ledger. This matters more than it looks: if a provider's CSV is misread (a column swapped, a figure
-- truncated) and the identity is violated, the naive move is to let the ledger's balance assertion catch
-- it. It would — but with an opaque "entry does not balance" error, and the person reading that error is
-- an accountant looking at a payroll run, not a database. Failing HERE says the useful thing instead:
-- "gross (10,000) must equal net (7,500) + withholdings (2,000) — the figures do not add up."
--
-- Employer tax is NOT part of gross. It is an additional cost the company bears ON TOP of the salary. A
-- system that folds it into gross understates the true cost of an employee — the single most common
-- payroll-modelling error, and one that makes every unit-economics and cost-per-project number wrong.
--
-- Idempotent (§A12). Posted runs are append-only. NOT VERIFIED against a live database. BUILT, not TESTED.

-- ─── Required accounts (seeded idempotently, not assumed) ─────────────
insert into fin_accounts (company_id, code, name, type, subtype, normal_balance, is_system)
select c.id, v.code, v.name, v.type, v.subtype, v.nb, true
from companies c
cross join (values
  ('6000','Salary Expense','expense','payroll','debit'),
  ('6100','Employer Tax Expense','expense','payroll','debit'),
  ('2300','Net Pay Payable','liability','payroll','credit'),
  ('2400','Withholdings Payable','liability','payroll','credit'),
  ('2500','Employer Tax Payable','liability','payroll','credit')
) as v(code,name,type,subtype,nb)
where exists (select 1 from fin_accounts a where a.company_id = c.id)
on conflict (company_id, code) do nothing;

-- ─── A pay period as the provider computed it ─────────────────────────
create table if not exists fin_payroll_runs (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references companies(id) on delete cascade,
  provider       text,                                   -- 'gusto' | 'deel' | 'manual' | …
  external_id    text,                                   -- the provider's own run id
  period_start   date not null,
  period_end     date not null,
  pay_date       date not null,
  gross          numeric(19,4) not null check (gross > 0),
  withholdings   numeric(19,4) not null default 0 check (withholdings >= 0),
  net_pay        numeric(19,4) not null check (net_pay > 0),
  employer_tax   numeric(19,4) not null default 0 check (employer_tax >= 0),
  benefits       numeric(19,4) not null default 0 check (benefits >= 0),  -- employer-paid benefits (in employer_tax bucket for posting)
  headcount      int,
  status         text not null default 'draft' check (status in ('draft','posted')),
  posted_entry_id uuid references fin_journal_entries(id) on delete restrict,
  cost_center_id uuid references fin_cost_centers(id) on delete set null,
  created_by     uuid not null default auth.uid() references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),

  -- THE IDENTITY. Without it the posted entry cannot balance, and the failure would surface as an opaque
  -- "entry does not balance" to an accountant staring at a payroll run.
  constraint fin_payroll_identity_ck check (gross = net_pay + withholdings),
  constraint fin_payroll_period_ck   check (period_end >= period_start),
  -- Re-importing the same provider run must not post payroll twice — a second posting would double an
  -- entire month's salary expense and the entry would balance perfectly.
  constraint fin_payroll_external_uq unique (company_id, provider, external_id)
);
create index if not exists fin_payroll_runs_idx
  on fin_payroll_runs (company_id, status, pay_date desc);

-- ─── Post it ──────────────────────────────────────────────────────────
create or replace function fin_post_payroll_run(p_run_id uuid, p_period_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_company uuid; v_status text; v_gross numeric(19,4); v_net numeric(19,4);
  v_wh numeric(19,4); v_emp_tax numeric(19,4); v_ben numeric(19,4); v_pay_date date;
  v_cc uuid; v_base char(3); v_pstatus text;
  v_sal uuid; v_etax uuid; v_netp uuid; v_whp uuid; v_etaxp uuid;
  v_lines jsonb; v_entry uuid; v_employer_total numeric(19,4);
begin
  if not fin_can_approve() then raise exception 'Not authorized to post payroll'; end if;

  -- Lock: a retried import and a human clicking Post must not both post the same run. A double-posted
  -- payroll doubles an entire month of salary expense — and balances perfectly while doing it.
  select company_id, status, gross, net_pay, withholdings, employer_tax, benefits, pay_date, cost_center_id
    into v_company, v_status, v_gross, v_net, v_wh, v_emp_tax, v_ben, v_pay_date, v_cc
    from fin_payroll_runs where id = p_run_id for update;

  if v_company is null or v_company <> auth_company_id() then
    raise exception 'Payroll run not found in your company';
  end if;
  if v_status <> 'draft' then
    raise exception 'This payroll run is already posted';
  end if;

  -- Re-assert the identity here, with a message an ACCOUNTANT can act on. The ledger's balance assertion
  -- would also catch a violation, but it would say "entry does not balance" — true, useless, and aimed at
  -- the wrong reader.
  if v_gross <> v_net + v_wh then
    raise exception 'Payroll does not add up: gross (%) must equal net pay (%) + withholdings (%). Check the figures from your provider.',
      v_gross, v_net, v_wh;
  end if;

  select status into v_pstatus from fin_periods where id = p_period_id;
  if v_pstatus is distinct from 'open' then
    raise exception 'Payroll must post into an OPEN period (period is %)', coalesce(v_pstatus,'missing');
  end if;

  v_sal   := fin_account_by_code(v_company, '6000');
  v_etax  := fin_account_by_code(v_company, '6100');
  v_netp  := fin_account_by_code(v_company, '2300');
  v_whp   := fin_account_by_code(v_company, '2400');
  v_etaxp := fin_account_by_code(v_company, '2500');
  if v_sal is null or v_netp is null or v_whp is null then
    raise exception 'Payroll accounts missing (6000 Salary / 2300 Net Pay Payable / 2400 Withholdings Payable)';
  end if;

  select base_currency into v_base from fin_settings where company_id = v_company;

  -- Employer tax + employer-paid benefits are the company's own cost, ON TOP of gross — never inside it.
  -- Folding them into gross would understate the true cost of an employee, which is the most common
  -- payroll-modelling error and quietly corrupts every unit-economics and per-project cost figure.
  v_employer_total := v_emp_tax + v_ben;

  v_lines := jsonb_build_array(
    jsonb_build_object('account_id', v_sal, 'debit', v_gross, 'credit', 0,
                       'currency', v_base, 'memo', 'Gross salary', 'cost_center_id', v_cc),
    jsonb_build_object('account_id', v_netp, 'debit', 0, 'credit', v_net,
                       'currency', v_base, 'memo', 'Net pay owed to employees'),
    jsonb_build_object('account_id', v_whp, 'debit', 0, 'credit', v_wh,
                       'currency', v_base, 'memo', 'Withholdings owed to the tax authority')
  );

  if v_employer_total > 0 then
    if v_etax is null or v_etaxp is null then
      raise exception 'Employer Tax Expense (6100) or Employer Tax Payable (2500) account missing';
    end if;
    v_lines := v_lines || jsonb_build_array(
      jsonb_build_object('account_id', v_etax, 'debit', v_employer_total, 'credit', 0,
                         'currency', v_base, 'memo', 'Employer taxes + benefits', 'cost_center_id', v_cc),
      jsonb_build_object('account_id', v_etaxp, 'debit', 0, 'credit', v_employer_total,
                         'currency', v_base, 'memo', 'Employer taxes + benefits owed')
    );
  end if;

  -- Same posting path as every subledger: inherits the open-period gate, the balance assertion and
  -- gap-free numbering. Not a second idiom.
  v_entry := fin_post_system_entry(
    v_company, v_pay_date, p_period_id,
    'Payroll ' || v_pay_date::text, 'payroll', v_lines
  );

  update fin_payroll_runs
     set status = 'posted', posted_entry_id = v_entry
   where id = p_run_id;

  return v_entry;
end $$;

-- ─── RLS ──────────────────────────────────────────────────────────────
alter table fin_payroll_runs enable row level security;

drop policy if exists "fin_payroll - select" on fin_payroll_runs;
create policy "fin_payroll - select" on fin_payroll_runs
  for select using (company_id = auth_company_id() and fin_can_view());
drop policy if exists "fin_payroll - insert" on fin_payroll_runs;
create policy "fin_payroll - insert" on fin_payroll_runs
  for insert with check (company_id = auth_company_id() and fin_can_enter() and created_by = auth.uid());
drop policy if exists "fin_payroll - update" on fin_payroll_runs;
create policy "fin_payroll - update" on fin_payroll_runs
  for update using (company_id = auth_company_id() and fin_can_enter())
  with check (company_id = auth_company_id() and fin_can_enter());
drop policy if exists "fin_payroll - delete" on fin_payroll_runs;
create policy "fin_payroll - delete" on fin_payroll_runs
  for delete using (company_id = auth_company_id() and fin_can_configure());

drop trigger if exists fin_freeze_creator on fin_payroll_runs;
create trigger fin_freeze_creator before update on fin_payroll_runs
  for each row execute function fin_freeze_created_by();

drop trigger if exists fin_audit_trg on fin_payroll_runs;
create trigger fin_audit_trg after insert or update or delete on fin_payroll_runs
  for each row execute function fin_audit();
