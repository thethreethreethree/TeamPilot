import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Locks the tenant-scoping (IDOR) property of the decision-seed endpoint: an agent may only seed a
 * Decision Dialogue from a conversation in THEIR OWN company. fetchAgentConversation bypasses RLS
 * (service role), so this route's companyId check is the sole guard — a regression here would let an
 * agent pull another tenant's customer messages into a decision. The pure builder (buildDecisionSeed)
 * runs for real (it's already unit-tested) so the happy path also exercises the integration.
 */
vi.mock("@/lib/api/careAgentAuth", () => ({ requireCareAgent: vi.fn() }));
vi.mock("@/lib/data/care", () => ({ fetchAgentConversation: vi.fn() }));

import { GET } from "@/app/api/care/conversations/[id]/decision-seed/route";
import { requireCareAgent } from "@/lib/api/careAgentAuth";
import { fetchAgentConversation } from "@/lib/data/care";

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const agent = { ok: true, companyId: "c1", agentId: "a1", isAdmin: false };
const conv = (companyId: string) => ({
  conversation: {
    companyId,
    subject: "Refund request",
    handoffTopic: null,
    handoffTopicDetail: "Refund past the 30-day window",
    orderNumber: null,
    customerId: "cust1",
  },
  messages: [{ authorType: "customer", body: "I want a refund", isInternalNote: false }],
});

beforeEach(() => vi.clearAllMocks());

describe("GET decision-seed — tenant scoping", () => {
  it("passes auth failures straight through (does not touch data)", async () => {
    vi.mocked(requireCareAgent).mockResolvedValue({ ok: false, error: "no", status: 401 } as never);
    const res = await GET({} as never, ctx("conv1"));
    expect(res.status).toBe(401);
    expect(fetchAgentConversation).not.toHaveBeenCalled();
  });

  it("403 when the agent has no company on profile", async () => {
    vi.mocked(requireCareAgent).mockResolvedValue({ ok: true, companyId: null } as never);
    const res = await GET({} as never, ctx("conv1"));
    expect(res.status).toBe(403);
  });

  it("404 (not 200) when the conversation belongs to ANOTHER company — IDOR blocked", async () => {
    vi.mocked(requireCareAgent).mockResolvedValue(agent as never);
    vi.mocked(fetchAgentConversation).mockResolvedValue(conv("OTHER_COMPANY") as never);
    const res = await GET({} as never, ctx("conv1"));
    expect(res.status).toBe(404);
  });

  it("404 when the conversation doesn't exist", async () => {
    vi.mocked(requireCareAgent).mockResolvedValue(agent as never);
    vi.mocked(fetchAgentConversation).mockResolvedValue(null as never);
    const res = await GET({} as never, ctx("conv1"));
    expect(res.status).toBe(404);
  });

  it("200 + seeded situation for the agent's OWN conversation", async () => {
    vi.mocked(requireCareAgent).mockResolvedValue(agent as never);
    vi.mocked(fetchAgentConversation).mockResolvedValue(conv("c1") as never);
    const res = await GET({} as never, ctx("conv1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.situation).toContain("Refund past the 30-day window");
    expect(body.situation).toContain("I want a refund");
  });
});
