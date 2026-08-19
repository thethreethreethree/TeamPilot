import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Upload propose (mapping proposal). Pins: manager-only, distinct codes extracted from the CSV are handed to
 * the proposer, and a proposer failure fails LOUD (502), never a false-empty proposal.
 */
vi.mock("@/lib/supabase/auth-helpers", () => ({ getCurrentAuthContext: vi.fn() }));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/schedule/ai", () => ({ proposeImportMapping: vi.fn() }));

import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { proposeImportMapping } from "@/lib/schedule/ai";
import { POST } from "../route";

const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;
function req(body: unknown): Parameters<typeof POST>[0] {
  return { json: async () => body, headers: new Headers() } as unknown as Parameters<typeof POST>[0];
}
const CSV = ["NAME,d1,d2", "ALICE,6-3,OFF", "ABRIL,6-3,GY"].join("\n");

beforeEach(() => vi.clearAllMocks());

describe("POST /api/schedule/upload/propose", () => {
  it("a manager gets a proposal; distinct codes are handed to the proposer", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue({ userId: "u1", companyId: "c1", role: "admin", isAdmin: true });
    asMock(proposeImportMapping).mockResolvedValue({ headerDates: ["2026-08-16", "2026-08-17"], codeMap: { OFF: "off" }, notes: "" });
    const res = await POST(req({ csv: CSV }));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.codes.sort()).toEqual(["6-3", "GY", "OFF"]); // distinct, normalized, separator row skipped
    const arg = asMock(proposeImportMapping).mock.calls[0]?.[0];
    expect(arg.headerCells).toEqual(["d1", "d2"]);
  });

  it("a proposer failure fails loud (502), not a false-empty proposal", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue({ userId: "u1", companyId: "c1", role: "admin", isAdmin: true });
    asMock(proposeImportMapping).mockRejectedValue(new Error("llm down"));
    expect((await POST(req({ csv: CSV }))).status).toBe(502);
  });

  it("non-manager 403; unauthenticated 401", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue({ userId: "u2", companyId: "c1", role: "Member", isAdmin: false });
    expect((await POST(req({ csv: CSV }))).status).toBe(403);
    asMock(getCurrentAuthContext).mockResolvedValue(null);
    expect((await POST(req({ csv: CSV }))).status).toBe(401);
  });
});
