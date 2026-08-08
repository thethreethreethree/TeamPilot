# BUILD — vendor/home-tenant exemption for extension entitlement

### getOwnTenantId export (care/config.ts)
- **write-path:** `src/lib/care/config.ts` — added `export function getOwnTenantId()` as a thin public accessor
  over the existing private `ownTenantId()` (`CARE_DEFAULT_TENANT_ID ?? ELOSTATE_COMPANY_ID`).
- **read-path:** imported by `extensionEntitlement.ts`. Chosen over `crm/vendorAuth.getVendorCompanyId` (same
  value) to avoid coupling entitlement to the `server-only`, cookie-based CRM auth module.
- **what:** exposes the canonical "our own company" id to the entitlement layer. UUID stays in sync with the
  vendorAuth copy via the pre-existing `ownTenantId.sync.test.ts`.
- **why:** the entitlement decision needs to recognize the home tenant; this is the single, already-guarded
  source of that identity.

### vendor/home-tenant exemption in getExtensionEntitlement
- **write-path:** `src/lib/care/extensionEntitlement.ts` — added, at the TOP of `getExtensionEntitlement` before
  `createAdminClient()`/the config read:
  `if (companyId === getOwnTenantId()) return { status: "active", trialDaysLeft: 0, plan: "vendor", trialEnded: false };`
- **read-path:** `requireEntitledExtensionUser` (`extensionAuth.ts`, the ONLY caller) → both the C.A.R.E and
  Sales Coach extension tool routes. For the home tenant it now returns `active`, so the 402 lock branch is
  never reached.
- **what:** an identity exemption — the deployment's own tenant is always entitled to its own product,
  regardless of the customer plan/trial columns (which for the dogfooding tenant carry an expired pilot-trial
  artifact). Pure/DB-free (returns before IO).
- **why:** entitlement was authored customer-only with no notion of "us", so the founder's expired-trial artifact
  paywalled them off their own product ("your 14-day trial has ended"). Exempt by identity, not a data edit, so
  the invariant ("home tenant is exempt") is durable and self-documenting.

### verification (detection-true gate — A30)
- **write-path:** `src/lib/care/__tests__/extensionEntitlement.test.ts` — added a `vendor/home-tenant exemption`
  describe: (1) home id + expired trial + non-paid → `active`; (2) customer id + same expired-trial row →
  `locked` (blast-radius guard).
- **read-path:** both tests call `getExtensionEntitlement`; the home case returns before any mock IO. Detection-
  true — on the pre-fix code the home tenant fell through to the plan/trial read and returned `locked`.
- **what:** encodes the exemption AND its bound (home-only, never blanket) so a regression removing it fails CI.
- **why:** A33 — the invariant is precisely detectable at this chokepoint, so it is gated (not declined).
