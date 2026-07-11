-- 0120 — Financial System, Increment 5: Immutable audit trail (completes Phase 1)
--
-- The last Phase-1 non-negotiable: "who changed what, when, and the prior value", append-only.
-- A single generic AFTER trigger (fin_audit) captures every insert/update/delete on the fin_
-- tables into fin_audit_log with before/after jsonb. The log is append-only: no client write path,
-- and a hard trigger rejects UPDATE/DELETE even from the service role.
--
-- Idempotent (A12). Acceptance: docs/financial-system/tests/0120_audit.test.sql.

create table if not exists fin_audit_log (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid references companies(id) on delete cascade,
  actor        uuid references auth.users(id) on delete set null,
  action       text not null,                 -- INSERT | UPDATE | DELETE
  table_name   text not null,
  record_id    uuid,
  before_value jsonb,
  after_value  jsonb,
  occurred_at  timestamptz not null default now()
);
create index if not exists fin_audit_company_time_idx on fin_audit_log (company_id, occurred_at desc);
create index if not exists fin_audit_record_idx on fin_audit_log (table_name, record_id);

-- Generic audit capture. Uses to_jsonb(...)->>'key' so it works uniformly across tables with
-- different key shapes (id / user_id / company_id) without referencing a column that may not exist.
create or replace function fin_audit()
returns trigger language plpgsql
security definer set search_path = public as $$
declare v_new jsonb; v_old jsonb; v_company uuid; v_record uuid;
begin
  v_new := case when TG_OP <> 'DELETE' then to_jsonb(NEW) else null end;
  v_old := case when TG_OP <> 'INSERT' then to_jsonb(OLD) else null end;
  v_company := coalesce((v_new->>'company_id')::uuid, (v_old->>'company_id')::uuid);
  v_record  := coalesce((v_new->>'id')::uuid, (v_old->>'id')::uuid,
                        (v_new->>'user_id')::uuid, (v_old->>'user_id')::uuid, v_company);
  insert into fin_audit_log (company_id, actor, action, table_name, record_id, before_value, after_value)
    values (v_company, auth.uid(), TG_OP, TG_TABLE_NAME, v_record, v_old, v_new);
  return coalesce(NEW, OLD);
end $$;

-- Attach to every audited fin_ table (NOT to fin_audit_log itself, nor the internal counter).
drop trigger if exists fin_audit_trg on fin_settings;
create trigger fin_audit_trg after insert or update or delete on fin_settings
  for each row execute function fin_audit();
drop trigger if exists fin_audit_trg on fin_roles;
create trigger fin_audit_trg after insert or update or delete on fin_roles
  for each row execute function fin_audit();
drop trigger if exists fin_audit_trg on fin_accounts;
create trigger fin_audit_trg after insert or update or delete on fin_accounts
  for each row execute function fin_audit();
drop trigger if exists fin_audit_trg on fin_periods;
create trigger fin_audit_trg after insert or update or delete on fin_periods
  for each row execute function fin_audit();
drop trigger if exists fin_audit_trg on fin_journal_entries;
create trigger fin_audit_trg after insert or update or delete on fin_journal_entries
  for each row execute function fin_audit();
drop trigger if exists fin_audit_trg on fin_journal_lines;
create trigger fin_audit_trg after insert or update or delete on fin_journal_lines
  for each row execute function fin_audit();
drop trigger if exists fin_audit_trg on fin_exchange_rates;
create trigger fin_audit_trg after insert or update or delete on fin_exchange_rates
  for each row execute function fin_audit();

-- ── Append-only enforcement: fin_audit_log can only ever be inserted (by the trigger). ──
create or replace function fin_audit_log_immutable()
returns trigger language plpgsql as $$
begin
  raise exception 'fin_audit_log is append-only — % is not allowed', TG_OP;
end $$;

drop trigger if exists fin_audit_log_no_change on fin_audit_log;
create trigger fin_audit_log_no_change
  before update or delete on fin_audit_log
  for each row execute function fin_audit_log_immutable();

-- ── RLS: the audit trail is oversight data — readable by configure-level (controller/cfo); no
-- client write path (the SECURITY DEFINER fin_audit trigger inserts, bypassing RLS). ──
alter table fin_audit_log enable row level security;

drop policy if exists "fin_audit - select" on fin_audit_log;
create policy "fin_audit - select" on fin_audit_log
  for select using (company_id = auth_company_id() and fin_can_configure());
-- No insert/update/delete policy → default-deny for end users (writes come only from the trigger).
