import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Locks the tenant-scoping of the Live Monitor read endpoint: an agent may only ever see THEIR OWN
 * company's live visitors. fetchLiveVisitors is called with auth.companyId, so a regression that
 * dropped the company scoping (or passed a client-supplied value) would leak other tenants' visitor
 * presence. Also locks fail-closed auth ordering (no data read before the guard passes).
 */
vi.mock("@/lib/api/careAgentAuth", () => ({ requireCareAgent: vi.fn() }));
vi.mock("@/lib/data/care", () => ({ fetchLiveVisitors: vi.fn() }));

import { GET } from "@/app/api/care/monitor/visitors/route";
import { requireCareAgent } from "@/lib/api/careAgentAuth";
import { fetchLiveVisitors } from "@/lib/data/care";

beforeEach(() => vi.clearAllMocks());

describe("GET /api/care/monitor/visitors — tenant scoping", () => {
  it("passes auth failures through without touching data", async () => {
    vi.mocked(requireCareAgent).mockResolvedValue({ ok: false, error: "no", status: 401 } as never);
    const res = await GET();
    expect(res.status).toBe(401);
    expect(fetchLiveVisitors).not.toHaveBeenCalled();
  });

  it("403 when the agent has no company (never reads visitors)", async () => {
    vi.mocked(requireCareAgent).mockResolvedValue({ ok: true, companyId: null } as never);
    const res = await GET();
    expect(res.status).toBe(403);
    expect(fetchLiveVisitors).not.toHaveBeenCalled();
  });

  it("returns visitors scoped to the caller's OWN company", async () => {
    vi.mocked(requireCareAgent).mockResolvedValue({
      ok: true,
      companyId: "company-A",
      agentId: "a1",
    } as never);
    vi.mocked(fetchLiveVisitors).mockResolvedValue([
      { visitorId: "v1", page: "https://x/pricing", conversationId: null, firstSeenAt: "t", lastSeenAt: "t" },
    ] as never);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.visitors).toHaveLength(1);
    // The scoping guarantee: the DB fetch is bound to the authenticated company, not a client value.
    expect(fetchLiveVisitors).toHaveBeenCalledWith("company-A");
  });

  it("a GENUINE read failure → clean 500 with a generic message (no raw-error leak, no framework-default reliance)", async () => {
    // fetchLiveVisitors rethrows a real error (it degrades to [] only for a pending migration). The route
    // must turn that into an explicit generic 500 so the monitor page's res.ok check keeps prior visitors +
    // shows an error, instead of flashing the live list empty (error-as-no-data).
    vi.mocked(requireCareAgent).mockResolvedValue({ ok: true, companyId: "company-A", agentId: "a1" } as never);
    vi.mocked(fetchLiveVisitors).mockRejectedValue(new Error("permission denied for table care_live_visitors"));
    const res = await GET();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Couldn't load live visitors."); // generic — not the raw exception
  });
});
