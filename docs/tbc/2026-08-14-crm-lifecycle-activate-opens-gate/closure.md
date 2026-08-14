# CLOSURE — lifecycle-stage activation opens the AI gate

## What shipped
The A26 class sweep of `63761801` found a SECOND activation control: `accounts/[id]/route.ts` PATCH sets
`lifecycleStage` directly (the "Control month" stage view the founder actually flips), and it left the AI gate
closed. Now advancing the stage to `activated`/`paying` calls `activateAccountGuidance(id)` — the same
service-role helper the subscription-status seam uses — so both activation paths open `ai_guidance_enabled` (and
never downgrade a further-along stage). A `activationOpensGate.coverage.test.ts` guard pins that both seams call
the helper.

## Verification (A38) — full gate output
```
$ npm run check   (validated build dir: docs/tbc/2026-08-14-crm-lifecycle-activate-opens-gate)
typecheck ✓ · lint ✓ · theme-leak audit ✓ · RLS audit ✓ · Invariant audit — Violations: 0 ✓
tbc:docs ✓ · tbc:manifest ✓ · tbc:artifacts ✓ · tbc:residual ✓ · tbc:freshness ✓
exit 0  (see the run pasted at commit time)
```

## Residual (A36)
```json
[
  { "id": "R1", "item": "The gate coverage test is source-level (asserts both seams reference activateAccountGuidance), not a runtime route test.", "why_skipped": "No runtime route harness exists for these CRM routes; the house pattern is source-level coverage (vendorGate.coverage.test.ts) backed by the behavioral activateAccount.test.ts. A runtime harness is a larger, separate investment.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-14T14:06:00Z", "outcome": "Flagged." },
  { "id": "R2", "item": "After the controlExempt root fix, Sales Coach no longer needs this gate; the seam's value is now only the non-exempt Elostate diagnostic AI.", "why_skipped": "Still correct + worth shipping (activation should open the diagnostic gate too), but its urgency dropped once Sales Coach became truly exempt.", "confidence_it_does_not_matter": "high", "opened_at": "2026-08-14T14:06:30Z", "outcome": "Noted." },
  { "id": "R3", "item": "Clock-drift artifact: started_at 14:00Z ahead of the real clock to sort newest for the TBC dir-selector (after the 13:00Z AMD-010 dir).", "why_skipped": "Ordering honest; absolute value tracks the session's drifted clock (reference_tbc_build_dir memory).", "confidence_it_does_not_matter": "high", "opened_at": "2026-08-14T14:07:00Z", "outcome": "Noted." }
]
```

## Un-named reliance
Relies on `crm_accounts.lifecycle_stage` accepting `activated`/`paying` as valid `crm_lifecycle_stage` enum
values (0049) and on `activateAccountGuidance` being idempotent when the stage is already advanced by
`updateAccount` (its internal control_month/trial→activated branch no-ops on an already-live stage).

## Status
Complete at gate exit 0. Both vendor activation controls — subscription status and lifecycle stage — now open
the AI gate, closing the R1 residual flagged in the 63761801 (subscription-seam) closure.
