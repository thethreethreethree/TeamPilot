-- 0172 acceptance — SCHEDULED REPORT DELIVERY. Staging, 0116–0172 applied.
--
-- This feature is not "email a report on a cron". It is a STANDING INSTRUCTION TO EXFILTRATE FINANCIAL
-- DATA, set up once and then executed forever by a machine with nobody watching. Every other read path in
-- this system has an authenticated human on the end of it at the moment the data is read. This one does
-- not — and that is what the tests below are about.

begin;

do $$ begin
  -- THE SINGLE MOST IMPORTANT STRUCTURAL ASSERTION IN THIS FILE.
  -- An `email text` column here would let anyone who can create a schedule mail the company's P&L to any
  -- address on earth, monthly, with an audit trail that looks like a report subscription rather than an
  -- attack. The recipient must be a MEMBER — a user_id — so that you cannot address what you cannot name.
  if not exists (
    select 1 from information_schema.columns
     where table_name = 'fin_report_schedules'
       and column_name in ('email','recipient_email','to_address','cc')
  ) then raise notice 'SCHED PASS: no free-text email column — a schedule can only be addressed to a MEMBER of the company';
  else raise notice 'SCHED FAIL: a schedule can be addressed to an arbitrary email — this is a recurring exfiltration primitive with a clean audit trail';
  end if;

  if exists (select 1 from pg_rules
              where tablename = 'fin_report_deliveries' and rulename = 'fin_report_deliv_no_update')
  then raise notice 'SCHED PASS: the delivery log is append-only — the worker (service role) cannot erase a failure it caused';
  else raise notice 'SCHED FAIL: the delivery log can be rewritten';
  end if;
end $$;

rollback;

-- ══ APP-LAYER ═══════════════════════════════════════════════════════════════════════════════
--
-- 1 · AUTHORITY IS RE-CHECKED AT SEND TIME.  ***THE ASSERTION THIS FILE EXISTS FOR.***
--     A controller creates a schedule in March to recipient R. In June, R leaves the company (profiles.
--     status → removed, or their fin_roles row is deleted).
--     → From that moment, the schedule MUST NOT appear in fin_report_schedules_due.
--
--     The failing behaviour has no error message and no symptom: the schedule keeps firing, and the general
--     ledger arrives in a former employee's inbox every month for years. Nobody notices, because from the
--     inside everything is working exactly as configured.
--
--     Note WHERE the check lives: in the due-list VIEW, not in the worker. The worker cannot send what it
--     is not told about, so even a buggy or compromised worker cannot mail a former employee — the database
--     never hands it the address. A check in the worker would be one `if` away from this failure.
--
-- 2 · A SCHEDULE CANNOT GRANT A VIEW.  Attempt to create a schedule whose recipient has NO fin_roles row.
--     → MUST be denied by the RLS INSERT policy. Otherwise "subscribe them to the P&L" becomes a way to
--     show finance data to someone who was never given finance access.
--
-- 3 · THE RECIPIENT IS FROZEN.  Create a schedule to R (who has access). Then UPDATE it to point at
--     someone else.
--     → The freeze trigger MUST keep recipient_id (and report_id) unchanged.
--     Without this, an existing schedule — already created, already legitimate — could be silently
--     re-pointed at a different person, INHERITING its legitimacy and skipping the INSERT check in test 2.
--     Changing recipient must mean delete-and-recreate, which re-runs that check.
--
-- 4 · A FAILED SEND IS LOUD AND PERMANENT.  Record a delivery with status 'failed'.
--     → It MUST appear in fin_report_delivery_failures.
--     → An attempt to UPDATE or DELETE that row MUST be a no-op (the append-only rules).
--     A delivery that silently stops is worse than one that never existed: the recipient believes no news
--     is good news and quietly stops looking at numbers they were relying on.
--
-- 5 · THE SCHEDULE DOES NOT DRIFT.  A monthly schedule due on the 1st runs late, on the 3rd.
--     → next_run_on MUST advance from the 1st (→ the 1st of next month), NOT from today (→ the 3rd).
--     Advancing from today lets a worker that runs late walk a monthly report out of the month it is
--     supposed to cover, one day at a time, with nothing ever looking wrong.
--
-- 6 · NO DOUBLE-SEND.  Two identical schedules (same report, same recipient) MUST be rejected by the unique
--     constraint. A recipient who gets the same report twice learns to ignore the mail.
--
-- 7 · THE LOG CANNOT BE FORGED.  A client (non-service-role) attempts to INSERT into fin_report_deliveries.
--     → MUST be denied — there is no insert policy. Writes come only from the DEFINER RPC. A client that
--     could write the log could forge a 'sent' for a delivery that never happened.
