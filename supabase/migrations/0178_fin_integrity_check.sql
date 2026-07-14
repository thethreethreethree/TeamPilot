-- 0178 — PHASE 9: LEDGER INTEGRITY CHECK (what makes a backup into a recovery).
--
-- ── WHAT I AM NOT BUILDING, STATED PLAINLY ───────────────────────────────────────────────────
--
-- Backups themselves are Supabase's (daily snapshots, and point-in-time recovery on paid plans). I am not
-- going to reimplement them, and a row in a manifest saying "backup: BUILT" because I wrote a pg_dump
-- wrapper would be a worse system pretending to be a better one.
--
-- ── WHAT IS ACTUALLY MISSING, AND IT IS THE PART THAT MATTERS ────────────────────────────────
--
-- Every company has backups. Almost none can tell you whether a restore WORKED.
--
-- The failure is not "the backup didn't exist". It is: the restore ran, the database came up, the app
-- served pages, everybody exhaled — and the ledger came back subtly wrong. A few journal lines lost their
-- entry. A period reopened. The audit log has a hole in it. The trial balance is out by £3.40.
--
-- Nothing announces this. The app works. The pages render. The numbers look like numbers. And the company
-- proceeds to file accounts, pay dividends and make decisions on a ledger that quietly lost its integrity
-- at 3am on a Tuesday, six weeks ago.
--
-- AN UNVERIFIED RESTORE IS NOT A RECOVERY. IT IS A HOPE WITH A GREEN CHECKMARK.
--
-- So this migration is the thing you run AFTER a restore — and, more usefully, on a schedule, so that a
-- corruption that arrives some other way is caught in days rather than at year-end. It asserts the
-- invariants the entire financial system depends on, and it names any that have broken.
--
-- Each check is a FACT, not a heuristic. Every one of them should be impossible — they are enforced by
-- constraints and triggers. If any of them EVER fails, something has bypassed the database's own guarantees,
-- and that is worth knowing on the day it happens rather than the day an auditor finds it.
--
-- Idempotent (§A12). NOT VERIFIED against a live database. BUILT, not TESTED.

create or replace function fin_integrity_check()
returns table (check_name text, passed boolean, detail text)
language plpgsql stable security definer set search_path = public as $$
declare v_co uuid;
begin
  v_co := auth_company_id();
  if not fin_can_view() then
    raise exception 'Not authorized to run the integrity check';
  end if;

  -- 1 · THE TRIAL BALANCE BALANCES.
  -- The one invariant the whole double-entry system rests on. If this fails, every report in the product is
  -- wrong and none of them will say so.
  return query
  select 'Trial balance balances'::text,
         coalesce(abs(sum(l.base_debit) - sum(l.base_credit)) < 0.005, true),
         case when coalesce(abs(sum(l.base_debit) - sum(l.base_credit)) < 0.005, true)
              then 'Debits equal credits across every posted entry.'
              else 'OUT BY ' || to_char(abs(sum(l.base_debit) - sum(l.base_credit)), 'FM999,999,990.00')
                   || '. The ledger does not balance. Every report in this product is currently wrong, and '
                   || 'none of them will tell you so.'
         end
    from fin_journal_lines l
    join fin_journal_entries e on e.id = l.entry_id and e.status = 'posted'
   where l.company_id = v_co;

  -- 2 · EVERY POSTED ENTRY BALANCES ON ITS OWN.
  -- The whole ledger can balance while individual entries do not — two opposite errors cancelling out. That
  -- is arguably worse than a single imbalance, because check 1 would pass and report perfect health.
  return query
  select 'Every entry balances individually'::text,
         count(*) = 0,
         case when count(*) = 0
              then 'Each posted entry has equal debits and credits.'
              else count(*)::text || ' posted entries do not balance internally. The ledger total may still '
                   || 'be correct — two opposite errors cancel — which is WORSE, because the trial balance '
                   || 'would report perfect health.'
         end
    from (
      select l.entry_id
        from fin_journal_lines l
        join fin_journal_entries e on e.id = l.entry_id and e.status = 'posted'
       where l.company_id = v_co
       group by l.entry_id
      having abs(sum(l.base_debit) - sum(l.base_credit)) >= 0.005
    ) bad;

  -- 3 · NO ORPHANED LINES.
  -- A journal line whose entry vanished is money in the ledger that belongs to no transaction. FKs prevent
  -- this; a bad restore does not respect FKs it never replayed.
  return query
  select 'No orphaned journal lines'::text,
         count(*) = 0,
         case when count(*) = 0
              then 'Every line belongs to an entry.'
              else count(*)::text || ' journal lines have no parent entry — money in the ledger belonging '
                   || 'to no transaction.'
         end
    from fin_journal_lines l
   where l.company_id = v_co
     and not exists (select 1 from fin_journal_entries e where e.id = l.entry_id);

  -- 4 · CLOSED PERIODS ARE STILL CLOSED.
  -- A closed period is a promise to everyone who has already reported on it. An entry appearing inside one
  -- means someone (or something) wrote history after it was signed.
  return query
  select 'No entries inside a closed period'::text,
         count(*) = 0,
         case when count(*) = 0
              then 'Closed periods contain no new activity.'
              else count(*)::text || ' entries sit inside a CLOSED period. History has been rewritten after '
                   || 'it was reported on.'
         end
    from fin_journal_entries e
    join fin_periods p on p.id = e.period_id
   where e.company_id = v_co
     and p.status in ('closed','locked')
     and e.created_at > p.closed_at;

  -- 5 · THE AUDIT LOG IS INTACT.
  -- It is append-only by trigger. Zero rows against a non-empty ledger means the log was truncated, or
  -- never replayed by the restore — and the audit trail is the one thing you cannot reconstruct afterwards.
  return query
  select 'Audit trail present'::text,
         (select count(*) from fin_audit_log where company_id = v_co) > 0
           or (select count(*) from fin_journal_entries where company_id = v_co) = 0,
         case when (select count(*) from fin_audit_log where company_id = v_co) > 0
                or (select count(*) from fin_journal_entries where company_id = v_co) = 0
              then 'The audit log has entries.'
              else 'THE AUDIT LOG IS EMPTY but the ledger is not. The trail was lost — and unlike the '
                   || 'balances, it cannot be reconstructed from anything.'
         end;

  -- 6 · EVERY SUBLEDGER DOCUMENT THAT CLAIMS TO BE POSTED HAS ITS ENTRY.
  -- An approved bill with no journal entry is an expense the P&L has never heard of. The books balance
  -- perfectly without it — that is exactly why nothing else would notice.
  return query
  select 'Posted documents have their ledger entries'::text,
         count(*) = 0,
         case when count(*) = 0
              then 'Every approved bill is reflected in the ledger.'
              else count(*)::text || ' approved bills have no posted entry. That expense does not exist in '
                   || 'the P&L — and the books BALANCE without it, which is why nothing else would notice.'
         end
    from fin_bills b
   where b.company_id = v_co
     and b.status in ('approved','paid')
     and b.posted_entry_id is null;

  -- 7 · NO FUTURE-DATED POSTINGS.
  -- Not a corruption signature, but a common restore artifact (clock skew) and a common data-entry error —
  -- and a future-dated entry silently inflates the current period.
  return query
  select 'No entries dated in the future'::text,
         count(*) = 0,
         case when count(*) = 0
              then 'No posted entry is dated after today.'
              else count(*)::text || ' posted entries are dated in the FUTURE, inflating the current period.'
         end
    from fin_journal_entries e
   where e.company_id = v_co
     and e.status = 'posted'
     and e.entry_date > current_date;
end $$;
