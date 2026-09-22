import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * `POST /api/team/departments` — the first caller `profile_departments` has ever had.
 *
 * What these pin is the handful of states where a correct-looking response would be a false
 * statement:
 *
 *   · a failed read of the current set reported as "this person is in no department", which would
 *     re-insert rows that exist and delete rows the caller never saw
 *   · a partial save answered `ok`, leaving the page showing what was asked for rather than what
 *     is true
 *   · a replace-all instead of a diff, which rewrites `assigned_by`/`assigned_at` on rows that did
 *     not change — turning a record of what happened into a record of the last Save
 *   · a cross-company id answered by an RLS refusal rather than "not found"
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/auth-helpers", () => ({
  getCurrentAuthContext: vi.fn(async () => ({ userId: "me", companyId: "co1", isAdmin: true })),
}));

type Args = { profileId: string; departmentId: string };
const listProfileDepartments = vi.fn<(id?: string) => Promise<unknown>>();
const assignUserToDepartment = vi.fn<(a: Args) => Promise<boolean>>(async () => true);
const removeUserFromDepartment = vi.fn<(a: Args) => Promise<boolean>>(async () => true);
vi.mock("@/lib/data/departments", () => ({
  listProfileDepartments: (id?: string) => listProfileDepartments(id),
  assignUserToDepartment: (args: { profileId: string; departmentId: string }) =>
    assignUserToDepartment(args),
  removeUserFromDepartment: (args: { profileId: string; departmentId: string }) =>
    removeUserFromDepartment(args),
}));

import { createClient } from "@/lib/supabase/server";
import { POST } from "../route";

/**
 * RFC-4122-SHAPED, and that is not fussiness. The first version of this file used
 * `11111111-1111-1111-1111-111111111111`, which LOOKS like a uuid and is rejected by zod's
 * `.uuid()` — the variant nibble must be 8, 9, a or b. Every one of these tests returned 400
 * "Invalid UUID" and the failure read as a broken handler. Version nibble 4, variant nibble 8.
 */
const MEMBER = "11111111-1111-4111-8111-111111111111";
const D_ONE = "22222222-2222-4222-8222-222222222222";
const D_TWO = "33333333-3333-4333-8333-333333333333";

/** The tenant-pin read: a row when the member is in the caller's company, null otherwise. */
function mockDb(found: boolean) {
  const chain: Record<string, unknown> = {};
  Object.assign(chain, {
    select: () => chain,
    eq: () => chain,
    maybeSingle: async () => ({ data: found ? { id: MEMBER } : null }),
  });
  vi.mocked(createClient).mockResolvedValue({ from: () => chain } as never);
}

const post = (body: unknown) =>
  POST(
    new Request("http://x/api/team/departments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }) as never
  );

beforeEach(() => {
  vi.clearAllMocks();
  assignUserToDepartment.mockResolvedValue(true);
  removeUserFromDepartment.mockResolvedValue(true);
  mockDb(true);
});

describe("the write is a diff, not a replace-all", () => {
  it("adds only what is new and removes only what is gone", async () => {
    // THE POINT: `assigned_by` and `assigned_at` record who put this person in this department.
    // A replace-all would rewrite both for a row that did not change.
    listProfileDepartments.mockResolvedValue([{ profileId: MEMBER, departmentId: D_ONE, assignedAt: "x" }]);

    const res = await post({ memberId: MEMBER, departmentIds: [D_ONE, D_TWO] });

    expect(res.status).toBe(200);
    expect(assignUserToDepartment).toHaveBeenCalledTimes(1);
    expect(assignUserToDepartment).toHaveBeenCalledWith({ profileId: MEMBER, departmentId: D_TWO });
    expect(removeUserFromDepartment).not.toHaveBeenCalled();
  });

  it("writes nothing at all when the set is unchanged", async () => {
    listProfileDepartments.mockResolvedValue([{ profileId: MEMBER, departmentId: D_ONE, assignedAt: "x" }]);

    await post({ memberId: MEMBER, departmentIds: [D_ONE] });

    expect(assignUserToDepartment).not.toHaveBeenCalled();
    expect(removeUserFromDepartment).not.toHaveBeenCalled();
  });

  it("removes the ones dropped from the list", async () => {
    listProfileDepartments.mockResolvedValue([
      { profileId: MEMBER, departmentId: D_ONE, assignedAt: "x" },
      { profileId: MEMBER, departmentId: D_TWO, assignedAt: "x" },
    ]);

    await post({ memberId: MEMBER, departmentIds: [D_TWO] });

    expect(removeUserFromDepartment).toHaveBeenCalledTimes(1);
    expect(removeUserFromDepartment).toHaveBeenCalledWith({ profileId: MEMBER, departmentId: D_ONE });
  });
});

describe("a failed read is not an empty set", () => {
  it("refuses to compute a diff it cannot compute", async () => {
    // `[]` here would mean "in no department", so every requested id would be INSERTED — and any
    // that already exist would hit the dedupe key. Worse, a removal would be silently skipped.
    listProfileDepartments.mockResolvedValue(null);

    const res = await post({ memberId: MEMBER, departmentIds: [D_ONE] });

    expect(res.status).toBe(500);
    expect(assignUserToDepartment).not.toHaveBeenCalled();
    expect(removeUserFromDepartment).not.toHaveBeenCalled();
  });
});

describe("a partial save is reported as a partial save", () => {
  it("answers 500 and the set that ACTUALLY holds, not the one requested", async () => {
    // Several statements, not one transaction — the writers are per-row. Answering ok would leave
    // the page showing the request rather than the truth.
    listProfileDepartments
      .mockResolvedValueOnce([]) // the diff read
      .mockResolvedValueOnce([{ profileId: MEMBER, departmentId: D_ONE, assignedAt: "x" }]); // read-back
    assignUserToDepartment.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    const res = await post({ memberId: MEMBER, departmentIds: [D_ONE, D_TWO] });
    const body = (await res.json()) as { error?: string; departmentIds?: string[] };

    expect(res.status).toBe(500);
    expect(body.error).toMatch(/could not be saved/i);
    expect(body.departmentIds).toEqual([D_ONE]); // read back, not echoed
  });

  it("answers ok with the read-back set when everything succeeded", async () => {
    listProfileDepartments
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ profileId: MEMBER, departmentId: D_ONE, assignedAt: "x" }]);

    const res = await post({ memberId: MEMBER, departmentIds: [D_ONE] });
    const body = (await res.json()) as { ok?: boolean; departmentIds?: string[] };

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.departmentIds).toEqual([D_ONE]);
  });
});

describe("the tenant pin", () => {
  it("answers 404 for a member outside the caller's company, before writing anything", async () => {
    // The RLS policy would refuse the write anyway. A refusal cannot say WHY, and only the route
    // can tell "not yours" from "not allowed".
    mockDb(false);
    listProfileDepartments.mockResolvedValue([]);

    const res = await post({ memberId: MEMBER, departmentIds: [D_ONE] });

    expect(res.status).toBe(404);
    expect(listProfileDepartments).not.toHaveBeenCalled();
    expect(assignUserToDepartment).not.toHaveBeenCalled();
  });
});
