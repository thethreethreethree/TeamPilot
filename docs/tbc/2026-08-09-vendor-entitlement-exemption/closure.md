# CLOSURE

## What shipped
The deployment's OWN (vendor / home) tenant is now always entitled to the extension, exempted by identity at the
`getExtensionEntitlement` chokepoint before the plan/trial read. This unblocks the founder (and their whole team)
from the customer trial paywall on the product they build and dogfood — the reported "your 14-day trial has
ended" on their own account. Encoded by two detection-true tests. Covers both the C.A.R.E and Sales Coach
extensions (shared chokepoint).

## Verification
`npm run check` — all gates, exit 0 (pasted in check.md). Entitlement suite 28 tests incl. the 2 new exemption
tests. TypeScript/lint clean on the three changed files.

## This is SERVER code — deploys on push (unlike the client extension package)
This fix is in the Next.js server (`src/lib/care/*`), so a push to `main` → Vercel build → live. No extension
package rebuild is needed (that was the separate C.A.R.E capture-preview residual). The founder gets the fix as
soon as the deploy lands; confirm via prod `/api/health` build.commit == HEAD, then re-open the panel.

## Un-named reliance (what this quietly depends on)
- **The founder's account is in the home tenant** (companyId == `getOwnTenantId()`). VERIFIED from the record
  (0089 vendor-super-admin definition + the owner-account script + the founder's working vendor-admin access,
  which uses the identical resolver). If the founder ever tests from a DIFFERENT company, that company is a
  normal customer tenant and would see normal entitlement — correct by design, but it would NOT be "founder
  access." No per-USER founder allowlist exists; entitlement is per-tenant. If per-user founder access is ever
  wanted (founder testing as any tenant), that's a separate, larger change — flag it then, don't pre-build it.
- **`CARE_DEFAULT_TENANT_ID` consistency.** `getOwnTenantId` honors the env override, same as the vendor-admin
  gate. If prod sets it to a non-home value, BOTH this exemption and vendor-admin would target that value
  together — consistent, not a new failure mode this fix introduces.

## Residuals
```json
[
  {
    "id": "R1-runtime-unproven-until-deploy",
    "item": "The founder's actual panel-unblock is confirmed only AFTER this server change deploys (Vercel build.commit == HEAD). Established here by unit tests + the resolver-identity proof (getOwnTenantId == the vendor-admin gate the founder already uses), not by the live panel.",
    "why_skipped": "No way to exercise the founder's live authenticated extension call from this sandbox; server code deploys on push.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-09T08:58:00Z",
    "outcome": "OPENED and bounded. The logic is pure and unit-proven; the only unproven link is that the founder's companyId equals getOwnTenantId(), which is established from 0089 + the owner script + their working vendor-admin access (identical resolver). Founder live-confirms by re-opening the panel after deploy."
  },
  {
    "id": "R2-no-per-user-founder-allowlist",
    "item": "Exemption is per-TENANT (home company), not per-USER. If the founder ever tests from a DIFFERENT (customer) company, they'd see that tenant's normal entitlement, not founder access.",
    "why_skipped": "Entitlement is a per-tenant property; a per-user founder allowlist is a larger, speculative change with no current trigger (the founder tests from the home tenant). Pre-building it would be scope-creep (§5).",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-09T08:58:30Z",
    "outcome": "OPENED, correct-by-design. Per-tenant is the right granularity for a tenant-level entitlement. If per-user founder access is ever wanted, flag it then."
  },
  {
    "id": "R3-no-prod-data-touched",
    "item": "The vendor tenant's expired-trial row in care_tenant_config still exists; the exemption ignores it rather than correcting it.",
    "why_skipped": "The identity exemption is the durable fix; editing the data would be narrow, non-durable, and conflate 'founder' with 'enterprise plan'. Cosmetic only.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-09T08:59:00Z",
    "outcome": "OPENED, optional. If you want the data to reflect reality (home tenant = a real vendor/enterprise plan), that's a separate optional data change — not needed for access."
  }
]
```

Founder-gated items untouched by this fix (provider decision, onboarding advisory-lock, KPI aggregation, RCD
dedup, pagination, icon, C.A.R.E package rebuild, Web Store launch) — unrelated.
