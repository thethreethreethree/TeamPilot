import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Upload commit (ATOMIC via apply_schedule_import, 0222). Pins: manager-only, REFUSES an unmapped code
 * before any write, and passes the correct PLAN to the atomic RPC (new staff exclude existing; shifts
 * deduped; assignments skip off/unknown).
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

let rpcArgs: Record<string, unknown> | null = null;
function fakeSb(existing: { name: string }[] = []) {
  return {
    from: () => ({ select: () => ({ eq: async () => ({ data: existing, error: null }) }) }),
    rpc: async (_fn: string, args: Record<string, unknown>) => {
      rpcArgs = args;
      // Mirror the real RPC's shape: counts derived from the applied plan.
      return {
        data: {
          staffCreated: (args.p_new_staff as unknown[]).length,
          shiftsCreated: (args.p_shifts as unknown[]).length,
          assignmentsCreated: (args.p_assignments as unknown[]).length,
        },
        error: null,
      };
    },
  };
}

beforeEach(() => {
  rpcArgs = null;
});

describe("POST /api/schedule/upload/commit (atomic)", () => {
  it("a manager commits: passes the deduped plan to the atomic RPC", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue({ userId: "u1", companyId: "c1", role: "admin", isAdmin: true });
    asMock(createClient).mockResolvedValue(fakeSb([]));
    const res = await POST(req({ csv: CSV, headerDates: DATES, codeMap: MAP }));
    expect(res.status).toBe(201);
    const j = await res.json();
    expect(j.staffCreated).toBe(2); // ALICE + ABRIL
    expect((rpcArgs?.p_shifts as unknown[]).length).toBe(2); // 6-3@16 (shared) + 2-11@17
    expect((rpcArgs?.p_assignments as unknown[]).length).toBe(3); // off produces no assignment
  });

  it("excludes staff already in the roster from the plan's new staff", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue({ userId: "u1", companyId: "c1", role: "admin", isAdmin: true });
    asMock(createClient).mockResolvedValue(fakeSb([{ name: "ALICE" }]));
    await POST(req({ csv: CSV, headerDates: DATES, codeMap: MAP }));
    expect(rpcArgs?.p_new_staff).toEqual(["ABRIL"]); // ALICE existed
  });

  it("REFUSES to commit when a code is unmapped (400, RPC never called)", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue({ userId: "u1", companyId: "c1", role: "admin", isAdmin: true });
    asMock(createClient).mockResolvedValue(fakeSb([]));
    const res = await POST(req({ csv: ["NAME,d1", "ALICE,GY"].join("\n"), headerDates: ["2026-08-16"], codeMap: MAP }));
    expect(res.status).toBe(400);
    expect(rpcArgs).toBeNull();
  });

  it("a non-manager is blocked (403)", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue({ userId: "u2", companyId: "c1", role: "Member", isAdmin: false });
    asMock(createClient).mockResolvedValue(fakeSb([]));
    expect((await POST(req({ csv: CSV, headerDates: DATES, codeMap: MAP }))).status).toBe(403);
  });
});
