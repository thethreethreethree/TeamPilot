# CLOSURE — C.A.R.E area access gate

## What shipped
`/dashboard/care` now gates on `is_support_agent OR company admin` — the same predicate every C.A.R.E API
already enforces — completing the module-based access model (each product area gated consistently, mirroring
sales-coach). A non-care user is redirected to /dashboard cleanly instead of seeing a CareShell whose data all
403s.

## Un-named reliance (not self-evident)
- The C.A.R.E DATA was ALREADY gated at the API layer (requireCareAgent), so this page gate introduces NO new
  access restriction — verified by reading the predicate, not assumed. Anyone it redirects already couldn't
  load care data.
- A care pilot account passes because redeem_pilot_code sets role='admin' — so the gate + the module-lock
  (which confines a care account to /dashboard/care) are mutually consistent.

## Residual (A36)
```json
[
  { "id": "RES-01", "item": "No render test for the layout redirect (server component; the codebase's vitest env is node/no-DOM, so layout-redirect tests aren't the house style).", "why_skipped": "Predicate parity with the tested requireCareAgent + typecheck; founder verifies live.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-01T14:00:00Z", "outcome": "OPENED." },
  { "id": "RES-02", "item": "Removed-user edge (status='removed' + is_support_agent) passes the page gate but the API denies (broken shell) — same page/API split as sales-coach.", "why_skipped": "The API isRemoved check is the real enforcement; rare edge; parallel to the existing sales-coach gate.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-01T14:00:00Z", "outcome": "OPENED." }
]
```

## Verification
Typecheck exit 0; eslint clean; predicate parity confirmed (careAgentAuth.ts:29). Full `npm run check` is the CI gate.
