import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Upload commit. Pins: manager-only, REFUSES an unmapped code (no silent/guessed import), and applies the
 * plan — creating new staff + appending SHIFT_DEFINED (deduped) + EMPLOYEE_ASSIGNED events.
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/auth-helpers", () => ({ getCurrentAuthContext: vi.fn() }));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));

import { createClient } from "@/lib/supabase/server";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { POST } from "../route";

const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;
function req(body: unknown): Parameters<typeof POST>[0] {
  return { json: async () => body, headers: new Headers() } as unknown as Parameters<typeof POST>[0];
}

const MAP = { "6-3": { start: "06:00", end: "15:00" }, "2-11": { start: "14:00", end: "23:00" }, OFF: "off" };
const DATES = ["2026-08-16", "2026-08-17"];
const CSV = ["NAME,d1,d2", "ALICE,6-3,OFF", "ABRIL,6-3,2-11"].join("\n");

let rpcCalls: { type: string }[] = [];
let insertedNames: string[] = [];
function fakeSb(existing: { id: string; name: string }[] = []) {
  let counter = 0;
  return {
    from: () => ({
      select: () => ({ eq: async () => ({ data: existing, error: null }) }),
      insert: (row: Record<string, unknown>) => {
        insertedNames.push(String(row.name));
        return { select: () => ({ single: async () => ({ data: { id: `new-${++counter}`, name: row.name }, error: null }) }) };
      },
    }),
    rpc: async (_fn: string, args: { p_type: string }) => {
      rpcCalls.push({ type: args.p_type });
      return { error: null };
    },
  };
}

beforeEach(() => {
  rpcCalls = [];
  insertedNames = [];
});

describe("POST /api/schedule/upload/commit", () => {
  it("a manager commits: creates new staff + appends deduped shifts + assignments", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue({ userId: "u1", companyId: "c1", role: "admin", isAdmin: true });
    asMock(createClient).mockResolvedValue(fakeSb([]));
    const res = await POST(req({ csv: CSV, headerDates: DATES, codeMap: MAP }));
    expect(res.status).toBe(201);
    const j = await res.json();
    expect(j.staffCreated).toBe(2); // ALICE + ABRIL
    // shifts: 6-3@16 (shared), 2-11@17  → 2 SHIFT_DEFINED
    expect(rpcCalls.filter((c) => c.type === "SHIFT_DEFINED")).toHaveLength(2);
    // assignments: ALICE@16, ABRIL@16, ABRIL@17 → 3 EMPLOYEE_ASSIGNED
    expect(rpcCalls.filter((c) => c.type === "EMPLOYEE_ASSIGNED")).toHaveLength(3);
    expect(j.assignmentsCreated).toBe(3);
  });

  it("does NOT re-create a staff member already in the roster", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue({ userId: "u1", companyId: "c1", role: "admin", isAdmin: true });
    asMock(createClient).mockResolvedValue(fakeSb([{ id: "e-alice", name: "ALICE" }]));
    await POST(req({ csv: CSV, headerDates: DATES, codeMap: MAP }));
    expect(insertedNames).toEqual(["ABRIL"]); // ALICE existed, not re-created
  });

  it("REFUSES to commit when a code is unmapped (400, no writes)", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue({ userId: "u1", companyId: "c1", role: "admin", isAdmin: true });
    asMock(createClient).mockResolvedValue(fakeSb([]));
    const withUnknown = ["NAME,d1", "ALICE,GY"].join("\n");
    const res = await POST(req({ csv: withUnknown, headerDates: ["2026-08-16"], codeMap: MAP }));
    expect(res.status).toBe(400);
    expect(rpcCalls).toHaveLength(0);
    expect(insertedNames).toHaveLength(0);
  });

  it("a non-manager is blocked (403)", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue({ userId: "u2", companyId: "c1", role: "Member", isAdmin: false });
    asMock(createClient).mockResolvedValue(fakeSb([]));
    expect((await POST(req({ csv: CSV, headerDates: DATES, codeMap: MAP }))).status).toBe(403);
  });
});
