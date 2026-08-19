import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Upload preview (parse-then-confirm). Pins: manager-only, the deterministic parse surfaces unknown codes
 * and gates readyToCommit on them (never a silent import of an unmapped code), and the auth/validation edges.
 */
vi.mock("@/lib/supabase/auth-helpers", () => ({ getCurrentAuthContext: vi.fn() }));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));

import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { POST } from "../route";

const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;
function req(body: unknown): Parameters<typeof POST>[0] {
  return { json: async () => body, headers: new Headers() } as unknown as Parameters<typeof POST>[0];
}

const CSV = ["NAME,d1,d2,d3", "ALICE,6-3,6-3,OFF", ",,,", "ABRIL,OFF,2-11,GY"].join("\n");
const MAP = { "6-3": { start: "06:00", end: "15:00" }, "2-11": { start: "14:00", end: "23:00" }, OFF: "off" };
const DATES = ["2026-08-16", "2026-08-17", "2026-08-18"];

beforeEach(() => vi.clearAllMocks());

describe("POST /api/schedule/upload/preview", () => {
  it("a manager gets the structured preview; an unmapped code blocks commit", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue({ userId: "u1", companyId: "c1", role: "admin", isAdmin: true });
    const res = await POST(req({ csv: CSV, headerDates: DATES, codeMap: MAP }));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.staff).toEqual(["ALICE", "ABRIL"]); // separator row dropped
    expect(j.unknownCodes).toContain("GY");
    expect(j.readyToCommit).toBe(false); // an unmapped code blocks the import
  });

  it("readyToCommit is true when every code maps", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue({ userId: "u1", companyId: "c1", role: "admin", isAdmin: true });
    const clean = ["NAME,d1,d2", "ALICE,6-3,OFF"].join("\n");
    const res = await POST(req({ csv: clean, headerDates: ["2026-08-16", "2026-08-17"], codeMap: MAP }));
    const j = await res.json();
    expect(j.readyToCommit).toBe(true);
    expect(j.shifts).toBe(1);
    expect(j.off).toBe(1);
  });

  it("a non-manager is blocked (403)", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue({ userId: "u2", companyId: "c1", role: "Member", isAdmin: false });
    expect((await POST(req({ csv: CSV, headerDates: DATES, codeMap: MAP }))).status).toBe(403);
  });

  it("401 unauthenticated; 400 on a missing csv", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue(null);
    expect((await POST(req({ csv: CSV, headerDates: DATES }))).status).toBe(401);
    asMock(getCurrentAuthContext).mockResolvedValue({ userId: "u1", companyId: "c1", role: "admin", isAdmin: true });
    expect((await POST(req({ headerDates: DATES }))).status).toBe(400);
  });
});
