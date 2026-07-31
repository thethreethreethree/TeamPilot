# CLOSURE — verify:live §3.2 trigger-wired assertion

## What shipped

`verify:live`'s §3.2 check now asserts the Understanding Gate is WIRED (a BEFORE INSERT-OR-UPDATE trigger
running `check_understanding_gate` on `problems`), not merely that the gate function exists. This closes
a blind spot where a dropped/narrowed trigger would let a direct INSERT bypass the §3.2 constitutional
interrupt while the guard still reported healthy. Detection-tested; all 18 invariants pass.

## What I relied on that is NOT self-evident (the un-named-reliance half)

- **The tgtype bitmask semantics** (2=BEFORE, 4=INSERT, 16=UPDATE) are Postgres internals, verified this
  session against the live trigger (the real trigger returns 1; demanding a bit it lacks returns 0). If a
  future Postgres major changed these bits the check could mis-evaluate — but that is a controlled,
  visible dependency, and the detection test would catch it on the next run.
- **The trigger + fn NAMES** (`problems_understanding_gate` / `check_understanding_gate`) are the live
  names this session. A rename migration would (correctly) fail this check until the query is updated —
  the safe direction (a rename that also silently changed behavior should be reviewed).

## Residual (A36)

```json
[
  {
    "id": "RES-01",
    "item": "H2 finance immutability check (verify-invariants-live.mjs ~line 73) has the SAME class of blind spot: it asserts fin_entries_immutable + fin_lines_immutable FUNCTIONS exist, but not that their TRIGGERS are attached to fin_entries / fin_lines.",
    "why_skipped": "Scope discipline: this build fixes the §3.2 gate I empirically exercised this session. Extending the same trigger-wired assertion to the finance immutability check is a parallel, separate hardening on the finance-verification surface — worth doing deliberately, and it needs the live finance trigger names confirmed first (as I did for the gate trigger).",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-07-31T11:48:00Z",
    "outcome": "OPENED + named on the record so the finance-immutability guard's identical fn-checked-not-trigger gap is not silently left. Filed as the obvious next verify:live hardening; not bundled here to keep this change focused + off the finance surface."
  },
  {
    "id": "RES-02",
    "item": "The check asserts the trigger fires on INSERT AND UPDATE, but not that it is enabled (a trigger can be DISABLED via ALTER TABLE ... DISABLE TRIGGER while still present in pg_trigger).",
    "why_skipped": "A disabled trigger is an unusual, deliberate admin action (not a migration accident), and pg_trigger.tgenabled would need an extra clause. The dominant failure mode (dropped/narrowed by a migration) is covered.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-07-31T11:48:00Z",
    "outcome": "OPENED + judged low-value: DISABLE TRIGGER is not a migration-drift accident. Could add `and tg.tgenabled <> 'D'` later if ever warranted; named so the boundary is explicit."
  }
]
```

## Verification

verify:live 18/18 + detection test (see check.md), exit 0. Full `npm run check` is the CI gate.
