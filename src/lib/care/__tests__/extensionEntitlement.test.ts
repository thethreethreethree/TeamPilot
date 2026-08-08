import { describe, it, expect, vi } from "vitest";
import {
  computeExtensionEntitlement,
  getExtensionEntitlement,
  shouldAutoStartTrial,
  EXTENSION_TRIAL_DAYS,
} from "@/lib/care/extensionEntitlement";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOwnTenantId } from "@/lib/care/config";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-07-22T00:00:00Z");

// Mock the admin client so successive .from()…maybeSingle() chains return queued {data,error} results.
// getExtensionEntitlement calls maybeSingle twice only on the missing-column fallback path. The auto-start
// path also issues an UPDATE…eq…is chain whose terminal `.is()` resolves to `updateResult` (default OK).
type Row = { data: unknown; error: unknown };
function mockAdmin(results: Row[], updateResult: Row = { data: null, error: null }) {
  let i = 0;
  const builder: Record<string, unknown> = {};
  builder.select = () => builder;
  builder.eq = () => builder;
  builder.update = () => builder;
  builder.is = async () => updateResult; // terminal for the auto-start `UPDATE … WHERE … IS NULL`
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

  it("EXPIRED trial → locked (no silent grant) AND trialEnded=true (honest 'your trial ended')", () => {
    const startedAt = new Date(NOW - (EXTENSION_TRIAL_DAYS + 1) * DAY).toISOString();
    const r = computeExtensionEntitlement({ plan: "pilot", trialStartedAt: startedAt, now: NOW });
    expect(r.status).toBe("locked");
    expect(r.trialEnded).toBe(true); // they HAD it; the client shows "trial ended", not "never included"
  });

  it("trialEnded is FALSE for never-started, active-trial, paid, and future/garbled starts", () => {
    // never started → "your plan doesn't include it" (honest — they never had it)
    expect(computeExtensionEntitlement({ plan: "pilot", trialStartedAt: null, now: NOW }).trialEnded).toBe(false);
    // active trial → not ended
    const active = new Date(NOW - 2 * DAY).toISOString();
    expect(computeExtensionEntitlement({ plan: "pilot", trialStartedAt: active, now: NOW }).trialEnded).toBe(false);
    // paid → never a trial
    expect(computeExtensionEntitlement({ plan: "pro", trialStartedAt: null, now: NOW }).trialEnded).toBe(false);
    // future/garbled start = never had a working trial → not "ended"
    expect(computeExtensionEntitlement({ plan: "pilot", trialStartedAt: new Date(NOW + DAY).toISOString(), now: NOW }).trialEnded).toBe(false);
    expect(computeExtensionEntitlement({ plan: "pilot", trialStartedAt: "not-a-date", now: NOW }).trialEnded).toBe(false);
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

  it("plan matching is case-insensitive (a capitalized DB value still unlocks)", () => {
    // The decision lower-cases `plan` before matching PAID_PLANS, so a stored
    // "Pro"/"ENTERPRISE" must still resolve to active. Locks that normalization
    // so a refactor can't silently lock out a capitalized-plan tenant.
    expect(computeExtensionEntitlement({ plan: "Pro", trialStartedAt: null, now: NOW }).status).toBe("active");
    expect(computeExtensionEntitlement({ plan: "ENTERPRISE", trialStartedAt: null, now: NOW }).status).toBe("active");
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

/**
 * shouldAutoStartTrial + the auto-start IO path (founder decision 2026-07-27, audit Finding 1). The columns
 * previously had NO writer → every non-paid tenant was permanently locked ("the extension doesn't work").
 * The fix opens the 14-day trial on first contact, exactly once per tenant.
 */
/**
 * Vendor / home-tenant exemption (founder-reported 2026-08-09): the founder saw "your 14-day trial has ended"
 * on the vendor tenant they dogfood the product from. The deployment's OWN tenant is always entitled to its own
 * product, exempted by identity BEFORE the plan/trial read — but ONLY the home tenant, never a blanket unlock.
 */
describe("getExtensionEntitlement — vendor/home-tenant exemption", () => {
  it("the OWN (home) tenant is ALWAYS active, even with an expired trial + non-paid plan", async () => {
    // Detection-true: the mocked read says pilot + long-expired trial (pre-fix → locked/trialEnded). The
    // exemption returns active by identity before that read is consulted.
    mockAdmin([{ data: { plan: "pilot", extension_trial_started_at: "2020-01-01T00:00:00Z" }, error: null }]);
    const r = await getExtensionEntitlement(getOwnTenantId());
    expect(r.status).toBe("active");
    expect(r.trialEnded).toBe(false);
  });

  it("a CUSTOMER tenant (not the home id) is NOT exempted — normal rules apply (blast-radius guard)", async () => {
    mockAdmin([{ data: { plan: "pilot", extension_trial_started_at: "2020-01-01T00:00:00Z" }, error: null }]);
    expect((await getExtensionEntitlement("some-customer-company-id")).status).toBe("locked");
  });
});

describe("shouldAutoStartTrial (pure predicate)", () => {
  const ent = (status: "active" | "trial" | "locked"): ReturnType<typeof computeExtensionEntitlement> =>
    ({ status, trialDaysLeft: 0, plan: "x", trialEnded: false });
  it("true only when locked AND no trial ever started", () => {
    expect(shouldAutoStartTrial({ trialStartedAt: null, computed: ent("locked") })).toBe(true);
  });
  it("false when a paid plan is already active", () => {
    expect(shouldAutoStartTrial({ trialStartedAt: null, computed: ent("active") })).toBe(false);
  });
  it("false when already in a trial", () => {
    expect(shouldAutoStartTrial({ trialStartedAt: new Date().toISOString(), computed: ent("trial") })).toBe(false);
  });
  it("false when an EXPIRED trial exists (start recorded) → never restart, one trial per tenant ever", () => {
    expect(shouldAutoStartTrial({ trialStartedAt: "2020-01-01T00:00:00Z", computed: ent("locked") })).toBe(false);
  });
});

describe("getExtensionEntitlement auto-start (IO)", () => {
  it("pilot + never-started trial → auto-starts and returns TRIAL (the tester-unblock path)", async () => {
    mockAdmin([{ data: { plan: "pilot", extension_trial_started_at: null }, error: null }]);
    const r = await getExtensionEntitlement("c1");
    expect(r.status).toBe("trial");
    expect(r.trialDaysLeft).toBe(EXTENSION_TRIAL_DAYS);
  });

  it("pilot + EXPIRED trial (start recorded) → stays LOCKED, does not restart", async () => {
    const longAgo = new Date(Date.now() - 999 * DAY).toISOString();
    mockAdmin([{ data: { plan: "pilot", extension_trial_started_at: longAgo }, error: null }]);
    expect((await getExtensionEntitlement("c1")).status).toBe("locked");
  });

  it("auto-start WRITE fails → returns LOCKED (never grants an unpersisted trial)", async () => {
    mockAdmin(
      [{ data: { plan: "pilot", extension_trial_started_at: null }, error: null }],
      { data: null, error: { code: "XX000", message: "write blocked" } }
    );
    expect((await getExtensionEntitlement("c1")).status).toBe("locked");
  });

  it("NO config row (row-less tenant) → locked, NOT a phantom trial (the UPDATE would match 0 rows)", async () => {
    // A pre-0045 company without a care_tenant_config row: the read returns {data:null}. Auto-starting here
    // would UPDATE 0 rows (no error) and wrongly return `trial` on every call forever. The `data &&` guard
    // keeps it locked.
    mockAdmin([{ data: null, error: null }]);
    expect((await getExtensionEntitlement("c1")).status).toBe("locked");
  });

  it("migration-missing branch does NOT attempt an auto-start write (nowhere to write) → locked", async () => {
    // No updateResult needed; if the code tried to UPDATE here it would still resolve OK, but the point is
    // the fallback path must return locked for a non-paid plan without a column to persist a trial into.
    mockAdmin([missingCol("extension_trial_started_at"), { data: { plan: "pilot" }, error: null }]);
    expect((await getExtensionEntitlement("c1")).status).toBe("locked");
  });
});
