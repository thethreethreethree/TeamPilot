# CHECK — C.A.R.E area access gate

## Audit
- Predicate PARITY with the API: `requireCareAgent`/`resolveCareAgentAuth` (careAgentAuth.ts:27-29) compute
  `isAdmin = role in (CEO/COO/admin)`, `isAgent = is_support_agent OR isAdmin`. The gate uses the same, so the
  page gate can only redirect users the API already 403s — NO access change, just a clean redirect vs a broken
  shell (A30, no legitimate user broken).
- Module-lock interconnection: a care-provisioned pilot account is role='admin' (redeem_pilot_code) → passes;
  the 0207 middleware separately confines it to /dashboard/care. A sales_coach-locked account is redirected by
  the middleware before reaching this gate. No conflict.

## Findings (A26)
No findings. One acknowledged edge, consistent with the sales-coach gate: a REMOVED user (status='removed')
who still has is_support_agent=true passes this page gate but is denied by the API's isRemoved check (broken
shell) — the same page-vs-API split the sales-coach gate has; the API is the real enforcement. Not a regression.

## Verification
```
$ npx tsc --noEmit -p tsconfig.json
tsc_exit=0
$ eslint src/app/dashboard/care/layout.tsx
(clean)
$ grep predicate parity → careAgentAuth.ts:29 `isAgent = !!isSupportAgent || isAdmin` (matches the gate)
```
Full `npm run check` is the CI gate.
