-- verify_0190_understanding_gate_fail_closed.sql
--
-- Founder-runnable verification for migration 0190 (Understanding Gate → fail-closed).
-- SAFE ON PRODUCTION: everything runs inside a single transaction that ROLLS BACK
-- at the end, so no data is changed. Run it AFTER applying 0190:
--
--   psql "$SUPABASE_DB_URL" -f supabase/tests/verify_0190_understanding_gate_fail_closed.sql
--
-- Expected output (in order):
--   NOTICE:  [1/2] normal path: '*' default present, gate evaluates as before  -> PASS
--   NOTICE:  [2/2] fail-closed: no threshold rows -> surfacing RAISES           -> PASS
--   ...then a ROLLBACK. If either check prints FAIL (or the script errors out on
--   check 1), stop and investigate — 0190 is not behaving as intended.
--
-- This does NOT re-test the happy-path threshold math (that is unchanged from 0002);
-- it isolates the ONE behavior 0190 introduces: missing-config must REFUSE, not allow.

begin;

-- ── [1/2] Normal path: with the '*' default present, the gate still refuses an
--         under-supported problem exactly as it did before 0190. (Sanity: 0190
--         did not accidentally neuter the gate.) ────────────────────────────────
do $$
declare
  v_has_default boolean;
  v_raised      boolean := false;
  v_company     uuid;
begin
  select exists(select 1 from problem_thresholds where kind = '*') into v_has_default;
  if not v_has_default then
    raise exception '[1/2] PRECONDITION FAILED: no ''*'' default threshold row exists. '
      'Seed it (see 0002) before trusting the gate — this is exactly the fail-open state 0190 guards.';
  end if;

  -- Grab any company to satisfy the NOT NULL FK; we roll back regardless.
  select id into v_company from companies limit 1;
  if v_company is null then
    raise notice '[1/2] SKIPPED: no companies row to anchor a test problem (empty DB).';
    return;
  end if;

  -- Insert a problem straight to a surfacing status with ZERO supporting signals.
  -- The gate must reject it (needs >= min_signals). If it does NOT raise, the gate
  -- is broken.
  begin
    insert into problems (company_id, kind, title, status, diagnosis)
      values (v_company, 'bottleneck', 'verify-0190 under-supported', 'surfaced',
              repeat('x', 200));
  exception when others then
    v_raised := true;
  end;

  if v_raised then
    raise notice '[1/2] normal path: 0-signal problem was REJECTED by the gate            -> PASS';
  else
    raise warning '[1/2] normal path: a 0-signal problem SURFACED without error           -> FAIL';
  end if;
end $$;

-- ── [2/2] Fail-closed: remove ALL threshold rows, then attempt to surface a
--         problem. Pre-0190 this silently succeeded (threshold NULL -> no raise);
--         0190 must RAISE instead. ─────────────────────────────────────────────
do $$
declare
  v_raised  boolean := false;
  v_company uuid;
begin
  -- Inside this rolled-back txn only: strip the config the gate depends on.
  delete from problem_thresholds;

  select id into v_company from companies limit 1;
  if v_company is null then
    raise notice '[2/2] SKIPPED: no companies row to anchor a test problem (empty DB).';
    return;
  end if;

  begin
    insert into problems (company_id, kind, title, status, diagnosis)
      values (v_company, 'bottleneck', 'verify-0190 no-threshold', 'surfaced',
              repeat('x', 200));
  exception when others then
    v_raised := true;
  end;

  if v_raised then
    raise notice '[2/2] fail-closed: surfacing with NO threshold rows RAISED             -> PASS';
  else
    raise warning '[2/2] fail-closed: surfacing with NO threshold rows SUCCEEDED         -> FAIL (still fail-open!)';
  end if;
end $$;

-- No data was harmed in the making of this verification.
rollback;
