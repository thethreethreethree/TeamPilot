import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * GET /api/care/agent/inbox — locks the error-as-no-data fix. A DB fetch FAILURE must surface as 500
 * (so the client's res.ok check keeps the prior conversations) instead of the old 200 + [] that
 * flashed the agent's inbox EMPTY on a transient poll error. Success returns the conversations; the
 * ?enriched=1 flag routes to fetchEnrichedInbox.
 */
vi.mock("@/lib/api/careAgentAuth", () => ({ requireCareAgent: vi.fn() }));
vi.mock("@/lib/data/care", () => ({
  fetchAgentInbox: vi.fn(),
  fetchEnrichedInbox: vi.fn(),
}));

import { requireCareAgent } from "@/lib/api/careAgentAuth";
import { fetchAgentInbox, fetchEnrichedInbox } from "@/lib/data/care";
import { GET } from "../route";

const asMock = (x: unknown) => x as ReturnType<typeof vi.fn>;
const req = (enriched = false) =>
  ({
    nextUrl: { searchParams: new URLSearchParams(enriched ? "enriched=1" : "") },
  }) as unknown as Parameters<typeof GET>[0];

beforeEach(() => {
  vi.clearAllMocks();
  asMock(requireCareAgent).mockResolvedValue({ ok: true });
});

describe("GET /api/care/agent/inbox — error-as-no-data fix", () => {
  it("gates non-agents (returns the auth status)", async () => {
    asMock(requireCareAgent).mockResolvedValue({ ok: false, error: "agent-only", status: 403 });
    expect((await GET(req())).status).toBe(403);
  });

  it("success → 200 with the conversations", async () => {
    asMock(fetchAgentInbox).mockResolvedValue([{ id: "c1" }]);
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect((await res.json()).conversations).toEqual([{ id: "c1" }]);
  });

  it("enriched=1 → uses fetchEnrichedInbox, not the plain inbox", async () => {
    asMock(fetchEnrichedInbox).mockResolvedValue([{ id: "e1" }]);
    const res = await GET(req(true));
    expect((await res.json()).conversations).toEqual([{ id: "e1" }]);
    expect(fetchAgentInbox).not.toHaveBeenCalled();
  });

  it("a DB fetch FAILURE → 500 (the fix: never 200+[] that would flash the inbox empty)", async () => {
    asMock(fetchAgentInbox).mockRejectedValue(new Error("db down"));
    expect((await GET(req())).status).toBe(500);
  });

  it("an enriched fetch failure → 500 too", async () => {
    asMock(fetchEnrichedInbox).mockRejectedValue(new Error("db down"));
    expect((await GET(req(true))).status).toBe(500);
  });
});
