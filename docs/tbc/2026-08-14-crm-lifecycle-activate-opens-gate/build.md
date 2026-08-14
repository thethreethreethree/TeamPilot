# BUILD — lifecycle-stage activation opens the AI gate (sibling seam)

### accounts/[id]/route.ts PATCH calls activateAccountGuidance on a live-stage change
read-path: `src/app/api/admin/crm/accounts/[id]/route.ts` PATCH (vendor-admin gated), after `updateAccount`.
write-path: `if (body.lifecycleStage === "activated" || body.lifecycleStage === "paying") await activateAccountGuidance(id)`
— best-effort; the stage is already saved by `updateAccount`. Reuses the service-role fn from the subscription seam
(no new DB logic): opens `companies.ai_guidance_enabled` (+ `_at`), never downgrades a further-along stage,
`billing_status` untouched.

## Test coverage
`src/app/api/admin/crm/__tests__/activationOpensGate.coverage.test.ts` (2): asserts BOTH activation seams
(`subscription/route.ts` on status→active AND `[id]/route.ts` on lifecycle→activated/paying) reference
`activateAccountGuidance`. Source-level structural guard matching `vendorGate.coverage.test.ts`; the DATA behavior
(gate opens, no downgrade) stays locked by `crm/__tests__/activateAccount.test.ts` (3).

## Notes
- Completes the A26 class sweep of `63761801` — that fix wired ONE activation control (subscription status);
  this wires the OTHER (lifecycle stage), which is the one the founder's "6 in Control month" view actually flips.
- Pure code, no migration. Same deliberate §3.4 vendor override, on the record via the lifecycle event + timestamp.
