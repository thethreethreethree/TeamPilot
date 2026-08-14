# CHECK — lifecycle-stage activation opens the AI gate

## Verification run (A38)
Canonical command: `npm run check`. Full-gate output + exit code in closure.md.

## Findings

### F1 — the lifecycle-stage activation control left the AI gate closed
file+line: `src/app/api/admin/crm/accounts/[id]/route.ts` PATCH (line 131 `updateAccount` set the stage only) ×
`activateAccountGuidance` (never called from this route).
class: route-changed-but-the-implied-seam-left-open (A26) — the SIBLING of the seam fixed in `63761801`. Setting an
account's lifecycle stage to a live value implies "AI is on" but did not open the gate.
severity: high — and higher-likelihood than the subscription seam, because the founder's "Control month" count view
flips THIS control.
sweep-command: `grep -rn "activateAccountGuidance" src/app/api/admin/crm` → BOTH activation seams now call it.
read-path: fixed — lifecycle→activated/paying now opens `ai_guidance_enabled` for the company.

## Class sweep (A26)
Enumerated every vendor-admin path that marks an account live: (1) subscription status→active [fixed 63761801],
(2) lifecycle stage→activated/paying [fixed here]. `redeem_pilot_code` already enables the gate at redemption.
No member-facing path can open the gate (0111 guard blocks non-leadership authenticated writers). Coverage test
now pins both routes so a future activation path that forgets the gate fails CI.

## Tests
```
$ npx vitest run activationOpensGate activateAccount
(expected) activationOpensGate.coverage: 2 passed; activateAccount: 3 passed
```
Full gate + exit code in closure.md.
