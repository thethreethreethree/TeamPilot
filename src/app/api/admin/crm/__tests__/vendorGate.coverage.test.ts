import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Vendor-CRM gate-coverage guard (past-CRITICAL class — 0089).
 *
 * The CRM back-office was once open to any customer admin (RLS-only audits miss service-role routes;
 * the fix was the shared `requireVendorAdmin` gate). That gate's logic is unit-tested (vendorAuth.test.ts),
 * and every current admin/crm route consumes it correctly. The remaining risk is a FUTURE route added under
 * admin/crm/ that forgets the gate entirely — reopening the exact critical hole. This pins the necessary
 * condition: every route.ts under app/api/admin/crm MUST reference `requireVendorAdmin`. It is a coarse
 * backstop (it does not prove each HTTP method gates — that stays a review concern), but it makes the gross
 * "new CRM route with NO gate" case fail CI instead of shipping silently.
 */
const here = dirname(fileURLToPath(import.meta.url));
const CRM_DIR = join(here, ".."); // src/app/api/admin/crm

function routeFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "__tests__") continue;
      routeFiles(full, acc);
    } else if (entry === "route.ts") {
      acc.push(full);
    }
  }
  return acc;
}

describe("every admin/crm route is gated by requireVendorAdmin (past-critical 0089)", () => {
  const files = routeFiles(CRM_DIR);

  it("finds the admin/crm route set (non-empty — the scan works)", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("no admin/crm route.ts omits the vendor gate", () => {
    const ungated = files
      .filter((f) => !readFileSync(f, "utf8").includes("requireVendorAdmin"))
      .map((f) => relative(CRM_DIR, f).replace(/\\/g, "/"));
    expect(
      ungated,
      `admin/crm route missing requireVendorAdmin (reopens the 0089 critical hole — customer admin reaching vendor CRM):\n  ${ungated.join("\n  ")}`
    ).toEqual([]);
  });
});
