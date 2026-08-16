/**
 * The deployment's home / vendor (ELOSTATE) company id — the ONE place this literal lives.
 *
 * Client-safe: a company UUID is not a secret (the server enforces every vendor gate via
 * requireVendorAdmin / is_vendor_super_admin regardless of what a client believes). Exposing it
 * lets the client cheaply decide COSMETIC vendor-only UI (e.g. which nav items to show) without a
 * round-trip, while the real authorization stays server-side.
 *
 * Single-source (§2.2): `vendorAuth.getVendorCompanyId()` (server, honors the CARE_DEFAULT_TENANT_ID
 * override) and the Sidebar's vendor-nav visibility both derive from this constant, so they cannot
 * drift to different ids. A deployment that overrides its home company via CARE_DEFAULT_TENANT_ID
 * changes the SERVER gate; the client fallback here stays this literal, which is acceptable because
 * nav visibility is cosmetic and the server remains the authority.
 */
export const VENDOR_COMPANY_ID = "c3e7f389-3df6-48c8-876b-0cd4baf5c2a7";
