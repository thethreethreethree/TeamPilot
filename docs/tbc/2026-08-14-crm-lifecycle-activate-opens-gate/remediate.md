# REMEDIATE — lifecycle-stage activation opens the AI gate

## F1 — wire the AI gate to the lifecycle-stage activation control
Remediation: `accounts/[id]/route.ts` PATCH now calls `activateAccountGuidance(id)` when `lifecycleStage` is
advanced to a live stage (`activated` or `paying`), reusing the same service-role helper the subscription-status
seam uses. So BOTH ways a vendor admin marks an account live open the §3.4 AI gate — matching the founder's
"active must mean all AI functional" for the control (the "Control month" stage view) they actually click.
gate-or-promise: gate. `activationOpensGate.coverage.test.ts` pins that BOTH activation seams
(`subscription/route.ts` + `[id]/route.ts`) reference `activateAccountGuidance`; dropping the wiring from either
reddens CI. The DATA behavior (gate opens, no stage downgrade) stays locked by `activateAccount.test.ts`.
class: route-changed-but-the-implied-seam-left-open (A26 sibling of 63761801). severity: high. Fixed.

## Constitutional posture (§3.4)
A deliberate vendor override of the control window, on the record via the lifecycle-change event + the
`ai_guidance_enabled_at` timestamp; billing honesty preserved (`billing_status` untouched); the 0111 guard is
respected (service-role permitted). NOTE: after the controlExempt root fix (c7e719f6 / AMD-010), Sales Coach AI
no longer depends on this gate at all — it is control-exempt everywhere. This seam remains correct + valuable for
the NON-exempt Elostate diagnostic AI, which the gate legitimately governs.
