import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Cross-file constant-drift guard. The deployment's OWN (ELOSTATE) tenant id + its
 * `CARE_DEFAULT_TENANT_ID ?? <const>` resolution must agree between care/config.ts
 * (ownTenantId — the widget/demo/product-knowledge tenant) and the vendor/home-company auth.
 * If they drift, the care "own tenant" and the vendor "home company" disagree — vendor-admin
 * access and code-managed product knowledge key on different tenants.
 *
 * 2026-08-16: the vendor id was single-sourced into `crm/vendorCompanyId.ts` (§2.2) so the CLIENT
 * (Sidebar vendor-nav visibility) can derive it without importing the server-only vendorAuth.
 * vendorAuth.ts now RESOLVES from that shared constant rather than hardcoding its own copy. This
 * guard follows the literal to its single source and additionally pins that vendorAuth derives from
 * it — a stronger guarantee than the old "both files hardcode the same string". care/config.ts still
 * keeps its own literal (its ownTenantId concern), so the value-agreement check remains.
 */
const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(join(here, rel), "utf8");
const CONFIG = read("../config.ts");
const VENDOR = read("../../crm/vendorAuth.ts");
const SHARED = read("../../crm/vendorCompanyId.ts");

const careUuid = (src: string) =>
  src.match(/ELOSTATE_COMPANY_ID\s*=\s*"([0-9a-fA-F-]+)"/)?.[1];
const sharedUuid = (src: string) =>
  src.match(/VENDOR_COMPANY_ID\s*=\s*"([0-9a-fA-F-]+)"/)?.[1];

describe("own-tenant id stays in sync across care/config.ts and the vendor company constant", () => {
  it("care/config.ts's ELOSTATE_COMPANY_ID equals the single-sourced VENDOR_COMPANY_ID", () => {
    const c = careUuid(CONFIG);
    const s = sharedUuid(SHARED);
    expect(c, "care/config.ts must define ELOSTATE_COMPANY_ID").toBeTruthy();
    expect(s, "crm/vendorCompanyId.ts must define VENDOR_COMPANY_ID").toBeTruthy();
    expect(c).toBe(s);
  });

  it("vendorAuth derives from the shared constant, and both resolve via `CARE_DEFAULT_TENANT_ID ?? <const>`", () => {
    // vendorAuth no longer hardcodes the literal — it imports and resolves from the shared source.
    expect(VENDOR, "vendorAuth.ts must import VENDOR_COMPANY_ID from the shared constant").toMatch(
      /import\s*\{\s*VENDOR_COMPANY_ID\s*\}\s*from\s*["']@\/lib\/crm\/vendorCompanyId["']/
    );
    expect(
      VENDOR,
      "vendorAuth.ts must resolve as CARE_DEFAULT_TENANT_ID ?? VENDOR_COMPANY_ID"
    ).toMatch(/process\.env\.CARE_DEFAULT_TENANT_ID\s*\?\?\s*VENDOR_COMPANY_ID/);
    expect(
      CONFIG,
      "care/config.ts must resolve as CARE_DEFAULT_TENANT_ID ?? ELOSTATE_COMPANY_ID"
    ).toMatch(/process\.env\.CARE_DEFAULT_TENANT_ID\s*\?\?\s*ELOSTATE_COMPANY_ID/);
  });
});
