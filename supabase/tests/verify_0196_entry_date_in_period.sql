-- verify_0196_entry_date_in_period.sql
--
-- Founder-runnable verification for migration 0196 (H1 fix: a posted entry's date must fall within its
-- period). SAFE ON PRODUCTION: everything runs inside ONE transaction that ROLLS BACK at the end, so no
-- data is changed. Run it AFTER applying 0196:
--
--   psql "$SUPABASE_DB_URL" -f supabase/tests/verify_0196_entry_date_in_period.sql
--
-- Expected output (in order):
--   NOTICE:  [detection] existing posted entries with a date outside their period: <N>
--            (N should be 0 on a clean ledger; if > 0, the pre-fix gap already produced mis-dated rows —
--             they are NOT auto-fixed by 0196 and may warrant a reversal cleanup.)
--   NOTICE:  [1/2] negative: posting an entry DATED OUTSIDE its period was REJECTED  -> PASS
--   NOTICE:  [2/2] positive: posting an entry DATED INSIDE its period SUCCEEDED      -> PASS
--   ...then a ROLLBACK. Any FAIL (or SKIPPED because the DB has no open period / no user) means investigate.

begin;

-- ── [detection] Any ALREADY-posted entries whose date is outside their own period? ───────────────────
do $$
declare v_bad bigint;
begin
  select count(*) into v_bad
    from fin_journal_entries e
    join fin_periods p on p.id = e.period_id
    where e.status = 'posted'
      and (e.entry_date < p.start_date or e.entry_date > p.end_date);
  raise notice '[detection] existing posted entries with a date outside their period: %', v_bad;
  if v_bad > 0 then
    raise notice '[detection] NOTE: 0196 does not retroactively fix these — reverse + re-post them into the correct period if needed.';
  end if;
end $$;

-- ── [1/2] NEGATIVE: an entry posted with a date OUTSIDE its referenced period must be REJECTED. ───────
--         This is the H1 bug being closed. We insert directly as status='posted' to isolate the new
--         trigger (a bare entry with no lines doesn't invoke the balance trigger). ──────────────────
do $$
declare
  v_period  uuid; v_company uuid; v_start date; v_end date; v_user uuid;
  v_raised  boolean := false;
begin
  select id, company_id, start_date, end_date into v_period, v_company, v_start, v_end
    from fin_periods where status = 'open' order by start_date desc limit 1;
  select id into v_user from auth.users limit 1;
  if v_period is null or v_user is null then
    raise notice '[1/2] SKIPPED: needs at least one OPEN period and one user to build a test entry.';
    return;
  end if;

  begin
    -- entry_date = end_date + 1 day → guaranteed OUTSIDE this period's range, while period_id points AT
    -- this open period. Pre-0196 this posts; 0196 must reject it.
    insert into fin_journal_entries (company_id, entry_date, period_id, description, status, source, created_by)
      values (v_company, v_end + 1, v_period, 'verify-0196 mis-dated', 'posted', 'manual', v_user);
  exception when others then
    v_raised := true;
  end;

  if v_raised then
    raise notice '[1/2] negative: posting an entry DATED OUTSIDE its period was REJECTED  -> PASS';
  else
    raise warning '[1/2] negative: a mis-dated posted entry was ACCEPTED                  -> FAIL (H1 still open!)';
  end if;
end $$;

-- ── [2/2] POSITIVE: an entry posted with a date INSIDE its period must SUCCEED (no false positives). ──
do $$
declare
  v_period  uuid; v_company uuid; v_start date; v_end date; v_user uuid;
  v_raised  boolean := false;
begin
  select id, company_id, start_date, end_date into v_period, v_company, v_start, v_end
    from fin_periods where status = 'open' order by start_date desc limit 1;
  select id into v_user from auth.users limit 1;
  if v_period is null or v_user is null then
    raise notice '[2/2] SKIPPED: needs at least one OPEN period and one user to build a test entry.';
    return;
  end if;

  begin
    -- entry_date = start_date → INSIDE the period range. Must post without error.
    insert into fin_journal_entries (company_id, entry_date, period_id, description, status, source, created_by)
      values (v_company, v_start, v_period, 'verify-0196 in-period', 'posted', 'manual', v_user);
  exception when others then
    v_raised := true;
    raise notice '[2/2] (unexpected error: %)', SQLERRM;
  end;

  if not v_raised then
    raise notice '[2/2] positive: posting an entry DATED INSIDE its period SUCCEEDED      -> PASS';
  else
    raise warning '[2/2] positive: an in-period posted entry was REJECTED                 -> FAIL (0196 is too strict!)';
  end if;
end $$;

-- No data was harmed in the making of this verification.
rollback;
