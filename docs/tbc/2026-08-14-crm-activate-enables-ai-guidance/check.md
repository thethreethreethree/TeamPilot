# CHECK — "Active" account opens the AI gate + advances the stage

## Verification run (A38)
Canonical command: `npm run check`. Full-gate output + exit code in closure.md.

## Findings

### F1 — setting a CRM account "active" left the AI gate CLOSED (and the stage at control_month)
file+line: `src/app/api/admin/crm/accounts/[id]/subscription/route.ts` PATCH (changed only the billing status) ×
`src/lib/crm/data.ts` (no CRM path set `companies.ai_guidance_enabled` or advanced `lifecycle_stage`).
class: route-changed-but-the-implied-seam-left-open (the subscription status flipped, but the AI gate + stage it
implies did not) — the same class as the 0089/0090/0111 authz seams, here on the activation UX.
severity: high (a vendor-activated account looked active while non-`controlExempt` AI stayed gated — the founder's
"active must mean all AI functional").
sweep-command: `grep -rn "activateAccountGuidance\|ai_guidance_enabled" src/app/api/admin/crm src/lib/crm` — the
activate path now opens the gate + advances the stage.
read-path: fixed — status→active opens `ai_guidance_enabled` for the company and advances the account stage.

## Constitutional note (§3.4)
Opening the AI gate is a DELIBERATE vendor override of the §3.4 control window (the founder activating the
account) — allowed for leadership/vendor, on the record via the lifecycle-change event + the
`ai_guidance_enabled_at` timestamp, and analogous to `/api/brain/unlock`. Billing honesty is preserved:
`billing_status` stays `not_collecting`; the subscription `active` status carries no false paying claim (0049:137
"would be paying if collection were on"). The 0111 guard is respected — service-role/definer contexts are
explicitly permitted to write the gate.

## Class sweep (A26)
The activation seam had TWO un-wired consequences (the AI gate + the stage); both wired. No member-facing path can
open the gate (0111 guard still blocks non-leadership authenticated writers); only the vendor-admin CRM route +
the leadership unlock + redeem_pilot_code do.

## Tests
```
$ npx vitest run activateAccount
 Test Files  1 passed (1)
 Tests  3 passed (3)
```
Locks: active → ai_guidance_enabled + stage 'activated'; a further-along ('paying') stage is not downgraded but
still gets the gate opened. Full gate + exit code in closure.md.
