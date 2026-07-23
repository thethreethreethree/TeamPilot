import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Locks the tenant-scoping (IDOR) of the customer-patterns endpoint: an agent may only read pattern
 * counts for a customer via a conversation in THEIR OWN company. fetchAgentConversation bypasses RLS
 * (service role), so the companyId check is the sole guard. The anonymous case (no linked customer)
 * must return an honest below-threshold aggregate, never an error. aggregateCustomerPatterns runs for
 * real (pure, already unit-tested), so the empty-aggregate shape is exercised end-to-end.
 */
vi.mock("@/lib/api/careAgentAuth", () => ({ requireCareAgent: vi.fn() }));
vi.mock("@/lib/data/care", () => ({
  fetchAgentConversation: vi.fn(),
  fetchCustomerPatterns: vi.fn(),
}));

import { GET } from "@/app/api/care/conversations/[id]/customer-patterns/route";
import { requireCareAgent } from "@/lib/api/careAgentAuth";
import { fetchAgentConversation, fetchCustomerPatterns } from "@/lib/data/care";

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const agent = { ok: true, companyId: "c1", agentId: "a1", isAdmin: false };
const conv = (companyId: string, customerId: string | null) => ({
  conversation: { companyId, customerId },
  messages: [],
});

beforeEach(() => vi.clearAllMocks());

describe("GET customer-patterns — tenant scoping", () => {
  it("passes auth failures straight through", async () => {
    vi.mocked(requireCareAgent).mockResolvedValue({ ok: false, error: "no", status: 401 } as never);
    const res = await GET({} as never, ctx("conv1"));
    expect(res.status).toBe(401);
    expect(fetchAgentConversation).not.toHaveBeenCalled();
  });

  it("403 when the agent has no company", async () => {
    vi.mocked(requireCareAgent).mockResolvedValue({ ok: true, companyId: null } as never);
    const res = await GET({} as never, ctx("conv1"));
    expect(res.status).toBe(403);
  });

  it("404 when the conversation belongs to ANOTHER company — IDOR blocked", async () => {
    vi.mocked(requireCareAgent).mockResolvedValue(agent as never);
    vi.mocked(fetchAgentConversation).mockResolvedValue(conv("OTHER_COMPANY", "cust1") as never);
    const res = await GET({} as never, ctx("conv1"));
    expect(res.status).toBe(404);
    expect(fetchCustomerPatterns).not.toHaveBeenCalled();
  });

  it("200 + empty below-threshold aggregate for an anonymous conversation (no customer)", async () => {
    vi.mocked(requireCareAgent).mockResolvedValue(agent as never);
    vi.mocked(fetchAgentConversation).mockResolvedValue(conv("c1", null) as never);
    const res = await GET({} as never, ctx("conv1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      totalConversations: 0,
      resolvedConversations: 0,
      topConcerns: [],
      enoughData: false,
    });
    expect(fetchCustomerPatterns).not.toHaveBeenCalled();
  });

  it("200 + aggregated patterns for the agent's own customer", async () => {
    vi.mocked(requireCareAgent).mockResolvedValue(agent as never);
    vi.mocked(fetchAgentConversation).mockResolvedValue(conv("c1", "cust1") as never);
    vi.mocked(fetchCustomerPatterns).mockResolvedValue({
      totalConversations: 4,
      resolvedConversations: 3,
      topConcerns: [{ topic: "billing", count: 2 }],
      enoughData: true,
    } as never);
    const res = await GET({} as never, ctx("conv1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.enoughData).toBe(true);
    expect(body.totalConversations).toBe(4);
    expect(fetchCustomerPatterns).toHaveBeenCalledWith("c1", "cust1");
  });
});
