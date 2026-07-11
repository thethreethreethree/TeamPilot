-- 0122 — Financial System, Phase-2 foundation: the subledger→GL posting primitive
--
-- Decision-INDEPENDENT of the AR direction (B / A' / Hybrid): AP, AR, and Expenses all post to the
-- Phase-1 GL through ONE primitive, and all link their source document to the resulting GL entry
-- for drill-down + reconciliation. Built to Decision 1 (system-post, no second human SoD — the SoD
-- that mattered happened on the bill/invoice/expense approval).
--
-- Idempotent (A12). Acceptance: docs/financial-system/tests/0122_subledger_foundation.test.sql.

-- Link any subledger document → the GL entry(ies) it produced. Enables "drill from a bill to its
-- journal entry" and control-account reconciliation. Generic across AP/AR/expenses.
create table if not exists fin_source_postings (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  source_type text not null,                 -- 'ap_bill' | 'ar_invoice' | 'expense' | 'payment' | ...
  source_id   uuid not null,                 -- the subledger document id (may be a fin_ or crm_ id)
  entry_id    uuid not null references fin_journal_entries(id) on delete restrict,
  kind        text not null,                 -- 'issue' | 'payment' | 'reversal' | ...
  created_at  timestamptz not null default now()
);
create index if not exists fin_source_postings_source_idx on fin_source_postings (company_id, source_type, source_id);
create index if not exists fin_source_postings_entry_idx on fin_source_postings (entry_id);

alter table fin_source_postings enable row level security;
drop policy if exists "fin_source_postings - select" on fin_source_postings;
create policy "fin_source_postings - select" on fin_source_postings
  for select using (company_id = auth_company_id() and fin_can_view());
-- No client write policy → default-deny; only the SECURITY DEFINER posting functions insert.

-- Resolve a control account by code within a company (AR=1100, AP=2000, Cash=1000, Revenue=4000,
-- Tax Payable=2100, FX=7900 — the fin_init_company seed). Subledgers use this to find the accounts
-- to debit/credit. SECURITY DEFINER so it resolves regardless of the caller's RLS on fin_accounts.
create or replace function fin_account_by_code(p_company uuid, p_code text)
returns uuid language sql stable
security definer set search_path = public as $$
  select id from fin_accounts where company_id = p_company and code = p_code limit 1;
$$;

-- The subledger→GL posting primitive. Atomically creates a balanced, POSTED journal entry from a
-- set of lines. System-post (Decision 1): no human-to-human SoD (approved_by = the system caller is
-- allowed), because the approval that mattered happened on the source document. Balance, >=2 lines,
-- and open-period are still enforced here AND by the Phase-1 deferred balance triggers at commit.
--
-- NOT client-callable: execute is revoked from authenticated/anon below, so ONLY the sanctioned
-- subledger DEFINER functions (AP/AR/expense posting) can invoke it — a member cannot call this
-- directly to bypass the interactive SoD on manual journal entries.
create or replace function fin_post_system_entry(
  p_company     uuid,
  p_entry_date  date,
  p_period_id   uuid,
  p_description text,
  p_source      text,
  p_lines       jsonb            -- [{account_id, debit, credit, currency?, memo?}, ...]
) returns uuid language plpgsql
security definer set search_path = public as $$
declare v_entry uuid; v_line jsonb; v_ln int := 0; v_d numeric(19,4); v_c numeric(19,4); v_n int; v_no bigint;
begin
  if not fin_can_enter() then
    raise exception 'Not authorized to post finance entries';
  end if;
  if (select status from fin_periods where id = p_period_id) is distinct from 'open' then
    raise exception 'Cannot post into a non-open period';
  end if;

  insert into fin_journal_entries (company_id, entry_date, period_id, description, source, created_by, status)
    values (p_company, p_entry_date, p_period_id, p_description, p_source, auth.uid(), 'draft')
    returning id into v_entry;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_ln := v_ln + 1;
    insert into fin_journal_lines (company_id, entry_id, line_no, account_id, debit, credit, currency, memo)
      values (
        p_company, v_entry, v_ln,
        (v_line->>'account_id')::uuid,
        coalesce((v_line->>'debit')::numeric, 0),
        coalesce((v_line->>'credit')::numeric, 0),
        v_line->>'currency',
        v_line->>'memo'
      );
  end loop;

  select coalesce(sum(base_debit),0), coalesce(sum(base_credit),0), count(*)
    into v_d, v_c, v_n from fin_journal_lines where entry_id = v_entry;
  if v_n < 2 then raise exception 'system entry needs at least 2 lines'; end if;
  if v_d <> v_c then raise exception 'system entry does not balance (% <> %)', v_d, v_c; end if;

  insert into fin_entry_counters (company_id, next_entry_no) values (p_company, 1)
    on conflict (company_id) do nothing;
  update fin_entry_counters set next_entry_no = next_entry_no + 1
    where company_id = p_company returning next_entry_no - 1 into v_no;
  update fin_journal_entries
    set status = 'posted', approved_by = auth.uid(), posted_at = now(), entry_no = v_no
    where id = v_entry;

  return v_entry;
end $$;

-- Not directly client-callable — only the subledger DEFINER functions (running as owner) invoke it.
revoke execute on function fin_post_system_entry(uuid, date, uuid, text, text, jsonb) from authenticated, anon;
