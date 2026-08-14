# BUILD — "Active" account opens the AI gate + advances the stage

### activateAccountGuidance — open the AI gate + advance the stage (service-role)
read-path: `src/lib/crm/data.ts` `activateAccountGuidance(accountId)` reads the account's `company_id` +
`lifecycle_stage` (service-role).
write-path: sets `companies.ai_guidance_enabled=true` (+ `_at`) for the account's company; advances
`crm_accounts.lifecycle_stage` from `control_month`/`trial` → `activated` (never downgrades a further-along
stage). Service-role bypasses the 0111 guard (definer/service context) + RLS. `billing_status` untouched
(`not_collecting`).

### subscription PATCH calls it on status→active
read-path: `src/app/api/admin/crm/accounts/[id]/subscription/route.ts` (vendor-admin gated) after
`updateSubscription`.
write-path: `if (body.status === "active") await activateAccountGuidance(id)` — best-effort; the subscription
status is already saved.

## Test coverage
`src/lib/crm/__tests__/activateAccount.test.ts` (3): active → `ai_guidance_enabled=true`; stage advanced
`control_month`→`activated`; a `paying` account still opens the gate but its stage is NOT downgraded.

## Notes
- This is the DELIBERATE vendor override of the §3.4 control window (the founder activating the account) — on the
  record via the lifecycle-change event + the `ai_guidance_enabled_at` timestamp — not a member self-unlock.
- Sales Coach AI was already `controlExempt` (worked regardless); this makes EVERY AI feature (incl. diagnostic)
  available for an active account, matching "all AI system features available and functional".
