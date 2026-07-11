-- 0129 — Financial System integrity: config that postings depend on becomes immutable once used
--
-- Adversarial audit found a class: configuration values that already-posted figures were computed
-- from can still be changed by a configure-level user, silently corrupting the ledger's derived
-- amounts. Two instances, guarded here at the DB level:
--   1. fin_settings.base_currency — every posted base_debit/base_credit was converted to the base
--      at post time. Changing the base afterwards does NOT recompute them → the whole ledger's base
--      figures become meaningless. Immutable once any journal entry exists.
--   2. fin_accounts.type / normal_balance / currency — the balance views sign + group by these.
--      Changing them after the account has lines flips/re-groups already-posted balances. Immutable
--      once the account has journal lines. (code/name/parent/is_active remain editable.)
--
-- Idempotent.

create or replace function fin_settings_guard()
returns trigger language plpgsql
security definer set search_path = public as $$
begin
  if NEW.base_currency is distinct from OLD.base_currency
     and exists (select 1 from fin_journal_entries where company_id = OLD.company_id) then
    raise exception 'fin_settings: base_currency cannot change once journal entries exist (it would leave every posted base amount computed against the old base)';
  end if;
  return NEW;
end $$;

drop trigger if exists fin_settings_guard_trg on fin_settings;
create trigger fin_settings_guard_trg
  before update on fin_settings
  for each row execute function fin_settings_guard();

create or replace function fin_accounts_guard()
returns trigger language plpgsql
security definer set search_path = public as $$
begin
  if (NEW.type is distinct from OLD.type
      or NEW.normal_balance is distinct from OLD.normal_balance
      or NEW.currency is distinct from OLD.currency)
     and exists (select 1 from fin_journal_lines where account_id = OLD.id) then
    raise exception 'fin_accounts: type/normal_balance/currency of account % cannot change once it has journal lines', OLD.code;
  end if;
  return NEW;
end $$;

drop trigger if exists fin_accounts_guard_trg on fin_accounts;
create trigger fin_accounts_guard_trg
  before update on fin_accounts
  for each row execute function fin_accounts_guard();
