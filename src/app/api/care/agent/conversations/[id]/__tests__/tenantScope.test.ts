import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tenant defense-in-depth on the agent conversation MUTATION route (PATCH claim/assign/status/...).
 *
 * Every sibling agent route verifies `conversation.companyId === auth.companyId` at the route layer; this
 * mutation route previously relied purely on the data fns being RLS-scoped. The route-layer check (added
 * 2026-07-27) gates EVERY action branch so a future switch of any mutation data-fn to the admin client
 * can't turn this into a cross-tenant mutation (the documented CRM-vendor bug class). This locks it: a PATCH
 * against a conversation in ANOTHER company must 404 before any mutation fn runs.
 */
vi.mock("@/lib/api/careAgentAuth", () => ({ requireCareAgent: vi.fn() }));
vi.mock("@/lib/data/care", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    fetchAgentConversation: vi.fn(),
    fetchEnrichedConversation: vi.fn(),
    claimConversation: vi.fn(),
  };
});

import { PATCH } from "@/app/api/care/agent/conversations/[id]/route";
import { requireCareAgent } from "@/lib/api/careAgentAuth";
import { fetchAgentConversation, fetchEnrichedConversation, claimConversation } from "@/lib/data/care";

const req = (body: unknown) => ({ json: async () => body }) as never;
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireCareAgent).mockResolvedValue({
    ok: true,
    agentId: "agent-1",
    companyId: "co-A",
    isAdmin: false,
  } as never);
});

describe("PATCH agent conversation — tenant defense-in-depth", () => {
  it("404 when the conversation is in ANOTHER company — never runs the mutation", async () => {
    vi.mocked(fetchAgentConversation).mockResolvedValue({
      conversation: { companyId: "co-B", assignedAgentId: null },
    } as never);
    const res = await PATCH(req({ action: "claim" }), ctx("conv-foreign"));
    expect(res.status).toBe(404);
    expect(claimConversation).not.toHaveBeenCalled(); // gated BEFORE any mutation
  });

  it("proceeds for a conversation in the caller's own company", async () => {
    vi.mocked(fetchAgentConversation).mockResolvedValue({
      conversation: { companyId: "co-A", assignedAgentId: null },
    } as never);
    vi.mocked(claimConversation).mockResolvedValue(undefined as never);
    vi.mocked(fetchEnrichedConversation).mockResolvedValue({ id: "conv-own" } as never);
    const res = await PATCH(req({ action: "claim" }), ctx("conv-own"));
    expect(res.status).toBe(200);
    expect(claimConversation).toHaveBeenCalledOnce();
  });

  it("404 when the conversation doesn't exist (fetch returns null)", async () => {
    vi.mocked(fetchAgentConversation).mockResolvedValue(null as never);
    const res = await PATCH(req({ action: "status", status: "closed" }), ctx("conv-missing"));
    expect(res.status).toBe(404);
  });
});
