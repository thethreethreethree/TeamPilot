# REMEDIATE — "Active" account opens the AI gate + advances the stage

## F1 — wire the AI gate + the stage to the activate action
Remediation: `activateAccountGuidance(accountId)` (service-role) opens `companies.ai_guidance_enabled=true` and
advances `crm_accounts.lifecycle_stage` out of `control_month`/`trial` to `activated` (never downgrades); the
subscription PATCH calls it when `status === "active"`. So an "active" account is functionally active — every AI
feature works, not just the day-1 `controlExempt` Sales Coach engines — and the dashboard stage reflects it.
gate-or-promise: gate. `activateAccount.test.ts` locks: active → ai_guidance_enabled + stage 'activated'; a
further-along stage is not downgraded but still gets the gate. Dropping the wiring reddens CI.
class: route-changed-but-the-implied-seam-left-open. severity: high. Fixed.

## Constitutional posture (§3.4)
A deliberate vendor override of the control window, on the record (lifecycle event + timestamp), billing honesty
preserved (billing_status not_collecting), 0111 guard respected (service-role permitted).
