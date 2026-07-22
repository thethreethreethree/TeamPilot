-- 0190_understanding_gate_fail_closed.sql
--
-- Hardens the §3.2 Understanding Gate (originally 0002) to fail CLOSED.
--
-- ── The defect (fail-open) ────────────────────────────────────────────────
-- The gate looks up a per-kind threshold, falling back to the global '*' row.
-- If NEITHER exists (the '*' seed was deleted, or a partially-seeded DB), the
-- `select … into threshold` matches no row, so `threshold` is NULL. Every
-- subsequent comparison is then `count < NULL` → NULL → the `if` branch is not
-- taken → NO raise → the problem surfaces UNGATED. A structural invariant whose
-- entire purpose is to be un-bypassable ("the schema itself must prevent
-- half-understood problems from reaching a human") silently waved everything
-- through the moment its configuration went missing.
--
-- ── Why fail-closed is correct here ───────────────────────────────────────
-- For an integrity gate, "I cannot determine the threshold" must mean REFUSE,
-- not ALLOW — the same fail-closed discipline this codebase already enforces on
-- every paid/auth gate (extensionAuth, extensionEntitlement: "fail closed for a
-- paid feature"). The gate is the thesis-core; it is the one place fail-open is
-- least acceptable. When the '*' row exists (it is seeded idempotently in 0002
-- and normally always present) behavior is byte-for-byte unchanged — this only
-- changes the pathological missing-config case from silent-allow to loud-refuse.
--
-- Append-only: 0002 is left intact; this redefines the function in place.

create or replace function check_understanding_gate()
returns trigger
language plpgsql
as $$
declare
  signal_count int;
  source_count int;
  threshold    record;
  is_surfacing boolean;
begin
  -- Only check when leaving 'draft'.
  is_surfacing := (TG_OP = 'INSERT' and NEW.status <> 'draft')
               or (TG_OP = 'UPDATE' and OLD.status = 'draft' and NEW.status <> 'draft');

  if not is_surfacing then
    return NEW;
  end if;

  -- Dismissal is allowed without meeting the gate: explicitly rejecting a draft
  -- without enough evidence is correct behavior, not a violation.
  if NEW.status = 'dismissed' then
    return NEW;
  end if;

  -- Find the threshold for this kind, falling back to the '*' default.
  select min_signals, min_distinct_sources, min_diagnosis_chars
    into threshold
    from problem_thresholds
    where kind = NEW.kind;

  if not found then
    select min_signals, min_distinct_sources, min_diagnosis_chars
      into threshold
      from problem_thresholds
      where kind = '*';
  end if;

  -- FAIL CLOSED: no per-kind row AND no '*' default means the gate cannot be
  -- evaluated. Refuse to surface rather than silently letting an unmeasured
  -- problem through. This is the structural guarantee of §3.2 — an
  -- un-configurable gate must block, not wave through.
  if threshold.min_signals is null then
    raise exception
      'Understanding Gate: no threshold configured for kind=% and no ''*'' default row exists — refusing to surface problem % (fail-closed)',
      NEW.kind, NEW.id
      using errcode = 'check_violation';
  end if;

  -- Count supporting signals.
  select count(*)::int, count(distinct s.source)::int
    into signal_count, source_count
    from problem_signals ps
    join signals s on s.id = ps.signal_id
    where ps.problem_id = NEW.id;

  if signal_count < threshold.min_signals then
    raise exception
      'Understanding Gate: problem % (kind=%) needs >=% signals, has %',
      NEW.id, NEW.kind, threshold.min_signals, signal_count
      using errcode = 'check_violation';
  end if;

  if source_count < threshold.min_distinct_sources then
    raise exception
      'Understanding Gate: problem % (kind=%) needs >=% distinct sources, has %',
      NEW.id, NEW.kind, threshold.min_distinct_sources, source_count
      using errcode = 'check_violation';
  end if;

  if coalesce(length(NEW.diagnosis), 0) < threshold.min_diagnosis_chars then
    raise exception
      'Understanding Gate: problem % (kind=%) needs a diagnosis of >=% chars, has %',
      NEW.id, NEW.kind, threshold.min_diagnosis_chars, coalesce(length(NEW.diagnosis), 0)
      using errcode = 'check_violation';
  end if;

  -- Stamp surfaced_at when transitioning to 'surfaced'.
  if NEW.status = 'surfaced' and NEW.surfaced_at is null then
    NEW.surfaced_at := now();
  end if;

  NEW.updated_at := now();
  return NEW;
end;
$$;
