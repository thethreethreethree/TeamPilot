import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSupabaseClient } from "../../data/__tests__/_supabaseMock";

/**
 * listAccounts test-account isolation (migration 0050). The CRM customer list
 * must default to PRODUCTION accounts only; a regression that drops the filter
 * would leak QA/test signups into the real customer list (or, inverted, hide
 * real accounts). We assert the query the function BUILDS for each includeTest
 * value via the recorded calls (createAdminClient is service-role, so there's no
 * RLS to lean on — the filter IS the isolation).
 */
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { createAdminClient } from "@/lib/supabase/admin";
import { listAccounts } from "../data";

async function callsFor(args?: Parameters<typeof listAccounts>[0]) {
  const calls: Array<[string, unknown[]]> = [];
  vi.mocked(createAdminClient).mockReturnValue(
    makeSupabaseClient({ crm_account_summary: { data: [] } }, calls) as never
  );
  await listAccounts(args);
  return calls;
}
const hasEq = (calls: Array<[string, unknown[]]>, col: string, val: unknown) =>
  calls.some(([m, a]) => m === "eq" && a[0] === col && a[1] === val);

describe("listAccounts test-account isolation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("defaults to production only (excludes test accounts)", async () => {
    const calls = await callsFor(undefined);
    expect(hasEq(calls, "is_test_account", false)).toBe(true);
    expect(hasEq(calls, "is_test_account", true)).toBe(false);
  });

  it("includeTest='only' shows test accounts exclusively", async () => {
    const calls = await callsFor({ includeTest: "only" });
    expect(hasEq(calls, "is_test_account", true)).toBe(true);
    expect(hasEq(calls, "is_test_account", false)).toBe(false);
  });

  it("includeTest=true shows ALL (no is_test_account filter at all)", async () => {
    const calls = await callsFor({ includeTest: true });
    expect(calls.some(([m, a]) => m === "eq" && a[0] === "is_test_account")).toBe(false);
  });

  it("applies lifecycle-stage and search filters when provided", async () => {
    const calls = await callsFor({ lifecycleStage: "customer" as never, search: "  acme  " });
    expect(hasEq(calls, "lifecycle_stage", "customer")).toBe(true);
    // search is trimmed and wrapped for a case-insensitive OR match.
    expect(
      calls.some(([m, a]) => m === "or" && String(a[0]).includes("%acme%") && String(a[0]).includes("ilike"))
    ).toBe(true);
  });

  it("ignores a whitespace-only search", async () => {
    const calls = await callsFor({ search: "   " });
    expect(calls.some(([m]) => m === "or")).toBe(false);
  });
});
