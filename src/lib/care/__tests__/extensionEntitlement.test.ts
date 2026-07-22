import { describe, it, expect, vi } from "vitest";
import {
  computeExtensionEntitlement,
  getExtensionEntitlement,
  EXTENSION_TRIAL_DAYS,
} from "@/lib/care/extensionEntitlement";
import { createAdminClient } from "@/lib/supabase/admin";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-07-22T00:00:00Z");

// Mock the admin client so successive .from()…maybeSingle() chains return queued {data,error} results.
// getExtensionEntitlement calls maybeSingle twice only on the missing-column fallback path.
type Row = { data: unknown; error: unknown };
function mockAdmin(results: Row[]) {
  let i = 0;
  const builder: Record<string, unknown> = {};
  builder.select = () => builder;
  builder.eq = () => builder;
  builder.maybeSingle = async () => results[Math.min(i++, results.length - 1)];
  vi.mocked(createAdminClient).mockReturnValue({ from: () => builder } as never);
}
const missingCol = (col: string): Row => ({
  data: null,
  error: { code: "42703", message: `column care_tenant_config.${col} does not exist` },
});

/**
 * Entitlement decision for the C.A.R.E extension (spec D2): pro/enterprise = active; an unexpired trial
 * = trial; otherwise locked. §3.4 — an expired trial reads locked, never a silent grant.
 */
describe("computeExtensionEntitlement (D2)", () => {
  it("pro plan → active (no trial needed)", () => {
    expect(computeExtensionEntitlement({ plan: "pro", trialStartedAt: null, now: NOW }).status).toBe("active");
  });

  it("enterprise plan → active", () => {
    expect(computeExtensionEntitlement({ plan: "enterprise", trialStartedAt: null, now: NOW }).status).toBe("active");
  });

  it("pilot/starter with no trial → locked", () => {
    expect(computeExtensionEntitlement({ plan: "pilot", trialStartedAt: null, now: NOW }).status).toBe("locked");
    expect(computeExtensionEntitlement({ plan: "starter", trialStartedAt: null, now: NOW }).status).toBe("locked");
  });

  it("trial started today → trial, full window remaining", () => {
    const r = computeExtensionEntitlement({
      plan: "pilot",
      trialStartedAt: new Date(NOW).toISOString(),
      now: NOW,
    });
    expect(r.status).toBe("trial");
    expect(r.trialDaysLeft).toBe(EXTENSION_TRIAL_DAYS);
  });

  it("trial mid-window → trial with correct days left", () => {
    const startedAt = new Date(NOW - 4 * DAY).toISOString();
    const r = computeExtensionEntitlement({ plan: "pilot", trialStartedAt: startedAt, now: NOW });
    expect(r.status).toBe("trial");
    expect(r.trialDaysLeft).toBe(EXTENSION_TRIAL_DAYS - 4);
  });

  it("EXPIRED trial → locked (no silent grant)", () => {
    const startedAt = new Date(NOW - (EXTENSION_TRIAL_DAYS + 1) * DAY).toISOString();
    expect(computeExtensionEntitlement({ plan: "pilot", trialStartedAt: startedAt, now: NOW }).status).toBe("locked");
  });

  it("trial exactly at the boundary → locked (window is exclusive at the end)", () => {
    const startedAt = new Date(NOW - EXTENSION_TRIAL_DAYS * DAY).toISOString();
    expect(computeExtensionEntitlement({ plan: "pilot", trialStartedAt: startedAt, now: NOW }).status).toBe("locked");
  });

  it("a future/garbled trial start does not grant access", () => {
    expect(computeExtensionEntitlement({ plan: "pilot", trialStartedAt: new Date(NOW + DAY).toISOString(), now: NOW }).status).toBe("locked");
    expect(computeExtensionEntitlement({ plan: "pilot", trialStartedAt: "not-a-date", now: NOW }).status).toBe("locked");
  });

  it("defaults a null plan to pilot (locked without trial)", () => {
    expect(computeExtensionEntitlement({ plan: null, trialStartedAt: null, now: NOW }).status).toBe("locked");
  });
});

/**
 * IO wrapper getExtensionEntitlement — the two branches that guard a PAID feature and are the most likely to
 * regress: fail-closed on any real read error, and the migration-coupling fallback (column not deployed yet).
 * These are exactly the classes that have bitten this codebase (fail-open on a paid gate; migration-coupling
 * outage), so they get explicit coverage.
 */
describe("getExtensionEntitlement (IO branches)", () => {
  it("happy path: pro plan row → active", async () => {
    mockAdmin([{ data: { plan: "pro", extension_trial_started_at: null }, error: null }]);
    expect((await getExtensionEntitlement("c1")).status).toBe("active");
  });

  it("happy path: recent trial start → trial", async () => {
    mockAdmin([{ data: { plan: "pilot", extension_trial_started_at: new Date(Date.now() - DAY).toISOString() }, error: null }]);
    const r = await getExtensionEntitlement("c1");
    expect(r.status).toBe("trial");
    expect(r.trialDaysLeft).toBeGreaterThan(0);
  });

  it("migration not applied (our column missing) → falls back to plan-only, still honors a paid plan", async () => {
    mockAdmin([missingCol("extension_trial_started_at"), { data: { plan: "pro" }, error: null }]);
    expect((await getExtensionEntitlement("c1")).status).toBe("active");
  });

  it("migration not applied + non-paid plan → locked (fallback grants no trial)", async () => {
    mockAdmin([missingCol("extension_trial_started_at"), { data: { plan: "pilot" }, error: null }]);
    expect((await getExtensionEntitlement("c1")).status).toBe("locked");
  });

  it("any OTHER read error → locked (fail closed for a paid feature)", async () => {
    mockAdmin([{ data: null, error: { code: "08006", message: "connection refused" } }]);
    const r = await getExtensionEntitlement("c1");
    expect(r.status).toBe("locked");
    expect(r.plan).toBe("unknown");
  });

  it("a DIFFERENT missing column is NOT swallowed → fails closed, never silently grants", async () => {
    // isMissingColumnError must name OUR column; a different missing column is a real defect, so we must not
    // take the trusting plan-only fallback — we fail closed instead.
    mockAdmin([missingCol("some_unrelated_column")]);
    expect((await getExtensionEntitlement("c1")).status).toBe("locked");
  });
});
