import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Cross-file constant-drift guard. The deployment's OWN (ELOSTATE) tenant id + its
 * `CARE_DEFAULT_TENANT_ID ?? <const>` resolution is INDEPENDENTLY hardcoded in two places:
 * care/config.ts (ownTenantId — the widget/demo/product-knowledge tenant) and
 * crm/vendorAuth.ts (the vendor/home-company auth). config.ts's own comment says: "If the
 * deployment's own tenant id ever changes, update BOTH (grep the UUID) — they are the same
 * 'our own tenant' value." Nothing enforced that. If they drift, the care "own tenant" and the
 * vendor "home company" disagree — vendor-admin access and code-managed product knowledge key
 * on different tenants. Both files are `server-only`, so this reads them as text (no import).
 */
const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(join(here, rel), "utf8");
const CONFIG = read("../config.ts");
const VENDOR = read("../../crm/vendorAuth.ts");

const ownUuid = (src: string) =>
  src.match(/ELOSTATE_COMPANY_ID\s*=\s*"([0-9a-fA-F-]+)"/)?.[1];

describe("own-tenant id stays in sync across care/config.ts and crm/vendorAuth.ts", () => {
  it("both files hardcode the SAME ELOSTATE_COMPANY_ID", () => {
    const c = ownUuid(CONFIG);
    const v = ownUuid(VENDOR);
    expect(c, "care/config.ts must define ELOSTATE_COMPANY_ID").toBeTruthy();
    expect(v, "crm/vendorAuth.ts must define ELOSTATE_COMPANY_ID").toBeTruthy();
    expect(v).toBe(c);
  });

  it("both resolve via `CARE_DEFAULT_TENANT_ID ?? ELOSTATE_COMPANY_ID` (env override wins, identically)", () => {
    for (const [name, src] of [
      ["care/config.ts", CONFIG],
      ["crm/vendorAuth.ts", VENDOR],
    ] as const) {
      expect(
        src,
        `${name} must resolve the own-tenant id as CARE_DEFAULT_TENANT_ID ?? ELOSTATE_COMPANY_ID`
      ).toMatch(/process\.env\.CARE_DEFAULT_TENANT_ID\s*\?\?\s*ELOSTATE_COMPANY_ID/);
    }
  });
});
