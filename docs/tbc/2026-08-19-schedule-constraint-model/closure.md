# Phase 2 — Closure

## Verdict
Phase 2 (Coverage Requirements & Constraint Model) is **SHIPPABLE as a foundation**. The hard/soft
predicates are pure, boundary-tested, and distinct; the standalone roster table exists. Layer-1 logic
proven before Phase 3 (the verdict authority) consumes it.

## Acceptance (build plan Phase 2) — met
- ✅ `coverage_requirement` event-sourced — COVERAGE_REQ_DEFINED/CHANGED are projected by Phase 1's deriveState.
- ✅ Eligibility (role/skill/cert) + labor limits (max hours) as pure predicates.
- ✅ `meetsCoverage` / `isEligible` / `withinLimits` — deterministic, unit-tested incl. boundaries
  (exactly-at-minimum coverage MEETS; exactly-at-max hours WITHIN).
- ✅ Hard vs soft NOT conflated — hard return pass/fail, soft (`fairnessScore`) returns a score; a test asserts
  the soft function returns a number in [0,1], never a verdict.

## Changed
- Migration `0221` (schedule_employee) applied via `npm run db:apply` (ledger-recorded, additive). Founder
  approval: SOUGHT (RQ5 resolved via the 2026-08-19 picker — standalone employee model).

## Residual queue (A36 — read from the TOP of the confidence ranking)

```json
[
  {
    "id": "S1",
    "item": "The other section-4 hard constraints (no double-booking, no assignment during approved time-off, required rest between shifts) are not in Phase 2.",
    "why_skipped": "Most sure this is fine, so opened per A36. The plan's Phase-2 step 3 names exactly meetsCoverage/isEligible/withinLimits; the state-dependent composite checks belong to Phase 3's evaluateChange (which reads the full ScheduleState + roster).",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-19T02:00:00Z",
    "outcome": "OPENED + confirmed spec-faithful: re-read plan section 4 + Phase-2 step 3. Phase 2 is the three named PURE predicates; double-booking / time-off-overlap / rest-between-shifts are inherently state-dependent (need the employee's OTHER assignments + shift times), which is exactly what Phase 3's single authority composes over these predicates. Deferring them to Phase 3 is the plan, not an omission. Phase 3 must implement them."
  },
  {
    "id": "S2",
    "item": "schedule_employee has no write path (Phase 5 management UI + PDF/Excel/CSV import) and no read path (Phase 3 eligibility resolver) yet.",
    "why_skipped": "Founder-directed foundation table (RQ5); its consumers are the next phases. Disclosed in build.md reachability, not claimed as a complete reachable feature.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": null
  },
  {
    "id": "S3",
    "item": "File upload (PDF / Excel / CSV) for staff + schedule-template bulk entry (new founder requirement 2026-08-19).",
    "why_skipped": "A Phase-5 (interface) deliverable — a parser that turns a staff×date shift-code grid (validated vs real samples HUB SCHED.pdf / frendz.xlsx) into schedule events + roster rows. Not part of the constraint model.",
    "confidence_it_does_not_matter": "low",
    "opened_at": null
  },
  {
    "id": "S4",
    "item": "Manager-only WRITE authorization on schedule_employee (a staff member must not be editable by any company member).",
    "why_skipped": "The table RLS is company-scoped (Phase-2 correct); the manager-only write gate is the same RQ6 role-gate class, enforced at the API layer when the Phase-5 management UI ships.",
    "confidence_it_does_not_matter": "low",
    "opened_at": null
  }
]
```

## Checkpoint (build plan Phase 2)
> "Constraints proven deterministic before the AI layer consumes them."

Confirmed: pure predicates, boundary-tested, hard/soft distinct. **Phase 3 (the single verdict authority,
A40) is next** — it composes these predicates + the state-dependent checks (S1) into ONE `evaluateChange`
verdict. Ready to proceed on your go.

## Verification
See `check.md` — the `npm run check` block (coverage + exit code, A38).
