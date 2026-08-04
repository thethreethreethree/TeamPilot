import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { moduleLanding, MODULE_LANDING, resolveUserLanding } from "../landing";

/** Minimal from→select→eq→maybeSingle stub, returning per-table data. */
const mockSb = (byTable: Record<string, unknown>) =>
  ({
    from: (table: string) => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: byTable[table] ?? null }) }),
      }),
    }),
  }) as unknown as SupabaseClient;

/**
 * moduleLanding maps a redeemed/authed module to its landing page — it drives where a
 * pilot user lands after redeeming a code and where the login flow sends someone. It was
 * untested. The silent regression it guards against: a NEW module added to the pilot
 * system without a MODULE_LANDING entry falls through to the generic /dashboard, dropping
 * a care/sales-coach pilot on the wrong first page. This locks the mapping + the fallback.
 */
describe("moduleLanding", () => {
  it("routes each known module to its own landing page (no accidental fall-through)", () => {
    // Each known module must resolve to a NON-generic path unless /dashboard is genuinely
    // its home (elostate). If a future edit drops a module's entry, it would fall to
    // /dashboard and this asserts the intended destination instead.
    expect(moduleLanding("elostate")).toBe("/dashboard");
    expect(moduleLanding("care")).toBe("/dashboard/care");
    expect(moduleLanding("sales_coach")).toBe("/dashboard/sales-coach");
  });

  it("care and sales_coach land on their OWN module home, not the generic dashboard", () => {
    // The regression that matters: a pilot who redeemed a care/sales code should NOT be
    // dumped on /dashboard. These two must stay distinct from the elostate/fallback path.
    expect(moduleLanding("care")).not.toBe("/dashboard");
    expect(moduleLanding("sales_coach")).not.toBe("/dashboard");
  });

  it("falls back to /dashboard for an unknown, empty, null, or undefined module", () => {
    expect(moduleLanding("nonexistent_module")).toBe("/dashboard");
    expect(moduleLanding("")).toBe("/dashboard");
    expect(moduleLanding(null)).toBe("/dashboard");
    expect(moduleLanding(undefined)).toBe("/dashboard");
  });

  it("every MODULE_LANDING value is a rooted relative path (safe as a redirect target)", () => {
    // These are used as redirect destinations; a value that wasn't a rooted relative path
    // would be an open-redirect / broken-nav shape. Locks the invariant for future entries.
    for (const path of Object.values(MODULE_LANDING)) {
      expect(path).toMatch(/^\/(?![/\\])/);
    }
  });
});

/**
 * resolveUserLanding must read the 0207 access_module column FIRST — the same signal the middleware
 * confines on. Locks that a locked account lands directly in its module (not the hub, then a bounce),
 * and that a null access_module still falls through to the legacy levers so complete/legacy accounts
 * don't regress. The regression this guards: reverting to the lever-only heuristic, under which 0045's
 * every-company care_tenant_config makes a sales_coach user resolve to the hub, never their module.
 */
describe("resolveUserLanding", () => {
  it("lands a locked sales_coach account directly in its module (access_module is authoritative)", async () => {
    const sb = mockSb({ companies: { access_module: "sales_coach" } });
    expect(await resolveUserLanding(sb, "u1", "co1")).toBe("/dashboard/sales-coach");
  });

  it("lands a locked care account directly in its module", async () => {
    const sb = mockSb({ companies: { access_module: "care" } });
    expect(await resolveUserLanding(sb, "u1", "co1")).toBe("/dashboard/care");
  });

  it("null access_module falls through to the legacy levers (care row present, no sales_coach_role → care)", async () => {
    const sb = mockSb({
      companies: { access_module: null },
      care_tenant_config: { company_id: "co1" },
      profiles: { sales_coach_role: null },
    });
    expect(await resolveUserLanding(sb, "u1", "co1")).toBe("/dashboard/care");
  });

  it("falls back to the hub when there is no company context", async () => {
    const sb = mockSb({ profiles: { sales_coach_role: null } });
    expect(await resolveUserLanding(sb, "u1", null)).toBe("/dashboard");
  });

  it("null access_module, sales_coach_role set + NO care row → sales_coach (legacy sales lever)", async () => {
    const sb = mockSb({
      companies: { access_module: null },
      profiles: { sales_coach_role: "staff" },
      // no care_tenant_config row → hasCare false → the sales lever alone decides
    });
    expect(await resolveUserLanding(sb, "u1", "co1")).toBe("/dashboard/sales-coach");
  });

  it("null access_module with BOTH levers (care row AND sales_coach_role) → hub, NOT a module", async () => {
    const sb = mockSb({
      companies: { access_module: null },
      care_tenant_config: { company_id: "co1" },
      profiles: { sales_coach_role: "admin" },
    });
    // Both levers present is ambiguous → the documented rule routes to the hub. This is EXACTLY why the
    // 0207 access_module column exists: 0045 gives every company a care_tenant_config, so a legacy
    // sales_coach account trips BOTH levers and never reaches its module from the fallback alone — the
    // "lands on main regardless of module" bug, seen here from the fallback side.
    expect(await resolveUserLanding(sb, "u1", "co1")).toBe("/dashboard");
  });

  it("null access_module with NEITHER lever → hub", async () => {
    const sb = mockSb({
      companies: { access_module: null },
      profiles: { sales_coach_role: null },
    });
    expect(await resolveUserLanding(sb, "u1", "co1")).toBe("/dashboard");
  });
});
