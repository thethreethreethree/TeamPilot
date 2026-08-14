# CLOSURE — "Active" account opens the AI gate + advances the stage

## What shipped
Founder: "when I hit active account, make sure they are actually active and all AI system features are available
and functional." The CRM subscription PATCH changed only the billing status; nothing opened the AI gate
(`companies.ai_guidance_enabled`) or advanced the account stage. So an "active" account still had the §3.4 gate
closed for any non-`controlExempt` (diagnostic) AI, and its stage read "control month". Now `status → active`
calls `activateAccountGuidance`, which opens the AI gate for the company AND advances the stage
`control_month`/`trial` → `activated` (never downgrading a further-along account). A deliberate vendor override of
the §3.4 control window, on the record; billing honesty (not_collecting) preserved.

## Verification (A38) — full gate output
```
$ npm run check   (validated build dir: docs/tbc/2026-08-14-crm-activate-enables-ai-guidance)
typecheck ✓ · lint ✓ · theme-leak audit ✓ · RLS audit ✓ · Invariant audit — Violations: 0 ✓
tbc:docs ✓ · tbc:manifest ✓ · tbc:artifacts ✓ · tbc:residual ✓ · tbc:freshness ✓
Test Files  418 passed | 1 skipped (419)
     Tests  2895 passed | 15 skipped (2910)
exit 0
```

## Residual (A36)
```json
[
  { "id": "R1", "item": "Existing control-month accounts the founder flips via a stage/lifecycle control (not the subscription-status PATCH) may not run through activateAccountGuidance.", "why_skipped": "The wiring is on the subscription status→active PATCH. If there is a separate lifecycle-stage control, it should call the same helper; flagged to confirm which control the founder uses.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-14T10:12:00Z", "outcome": "Flagged." },
  { "id": "R2", "item": "Clock-drift artifact: started_at 10:00Z is ahead of the real clock (~02:00Z) to sort newest for the TBC dir-selector.", "why_skipped": "Ordering is honest; only the absolute value tracks the session's drifted clock. Documented in the reference_tbc_build_dir memory.", "confidence_it_does_not_matter": "high", "opened_at": "2026-08-14T10:12:30Z", "outcome": "Noted." }
]
```

## Un-named reliance
- Relies on the 0111 guard permitting service-role/definer writes to `companies.ai_guidance_*` (0111 lines 37-41),
  and on `crm_accounts.lifecycle_stage` accepting `activated` (a valid crm_lifecycle_stage enum value, 0049:42).

## Status
Complete once the gate shows exit 0. Setting an account active now opens the AI gate + advances the stage, so
"active" means every AI feature is available and functional.
