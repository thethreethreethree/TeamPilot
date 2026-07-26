import { describe, it, expect, afterEach } from "vitest";
import { isProductContextCodeManaged, getProductContextForTenant } from "../config";

/**
 * Regression lock for `7a5b3113`: the product-knowledge "is this our own tenant" check must follow the
 * ENV-resolved tenant (CARE_DEFAULT_TENANT_ID), not just the hardcoded ELOSTATE_COMPANY_ID. The bug: it
 * keyed on the hardcoded constant while callers pass resolveCareTenant()'s result — so a deployment that
 * sets CARE_DEFAULT_TENANT_ID to its real tenant id served Jeff the GENERIC context (the "can't define
 * our product" bug), silently. isProductContextCodeManaged is the exported predicate backing that check.
 */

const HARDCODED = "c3e7f389-3df6-48c8-876b-0cd4baf5c2a7";
const OLD = process.env.CARE_DEFAULT_TENANT_ID;

afterEach(() => {
  if (OLD === undefined) delete process.env.CARE_DEFAULT_TENANT_ID;
  else process.env.CARE_DEFAULT_TENANT_ID = OLD;
});

describe("isProductContextCodeManaged — env-aware own-tenant resolution", () => {
  it("matches the hardcoded ELOSTATE id when CARE_DEFAULT_TENANT_ID is unset", () => {
    delete process.env.CARE_DEFAULT_TENANT_ID;
    expect(isProductContextCodeManaged(HARDCODED)).toBe(true);
    expect(isProductContextCodeManaged("some-other-tenant")).toBe(false);
  });

  it("follows CARE_DEFAULT_TENANT_ID when set — the env-resolved tenant is code-managed, the hardcoded one is NOT", () => {
    process.env.CARE_DEFAULT_TENANT_ID = "real-tenant-uuid";
    expect(isProductContextCodeManaged("real-tenant-uuid")).toBe(true);
    expect(isProductContextCodeManaged(HARDCODED)).toBe(false);
  });
});

describe("getProductContextForTenant — own tenant is AUTHORITATIVE (the core Jeff fix)", () => {
  // The own-tenant branch returns the code knowledge BEFORE reading the DB config, so no DB mock is
  // needed — and that early return is exactly the invariant (a stale DB config can never defeat it).
  it("returns the code KNOWLEDGE for the own tenant (unset env → hardcoded id), never a config", async () => {
    delete process.env.CARE_DEFAULT_TENANT_ID;
    const ctx = await getProductContextForTenant(HARDCODED);
    expect(ctx).toMatch(/Customer Assistance & Response Engine/i); // the C.A.R.E definition (case-insensitive)
    expect(ctx).toContain("ELOSTATE");
  });

  it("returns the KNOWLEDGE for the ENV-resolved own tenant (locks the env-aware fix at the resolver)", async () => {
    process.env.CARE_DEFAULT_TENANT_ID = "real-tenant-uuid";
    const ctx = await getProductContextForTenant("real-tenant-uuid");
    expect(ctx).toMatch(/Customer Assistance & Response Engine/i);
  });
});
