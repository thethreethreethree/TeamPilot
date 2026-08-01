import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * POST /api/care/agent/conversations/bulk — bulk status/assign on conversations. Previously untested.
 * Pins the security-relevant route logic: the auth gate (passed through from requireCareAgent), the
 * BATCH-SIZE LIMIT (max 200 ids — a DoS guard, via the real BulkBody zod), input validation
 * (uuid ids, known action), and the NON-ADMIN assign permission-filter (a non-admin may only reassign
 * conversations they own or that are unclaimed — disallowed ids are dropped, not 403'd whole-request).
 */
vi.mock("@/lib/api/careAgentAuth", () => ({ requireCareAgent: vi.fn() }));
vi.mock("@/lib/data/care", () => ({
  bulkSetConversationStatus: vi.fn(async () => 3),
  bulkAssignConversations: vi.fn(async () => 2),
}));

import { requireCareAgent } from "@/lib/api/careAgentAuth";
import { bulkSetConversationStatus, bulkAssignConversations } from "@/lib/data/care";
import { POST } from "../route";

const UUID = "11111111-1111-4111-8111-111111111111";
const UUID2 = "22222222-2222-4222-8222-222222222222";

const setAuth = (a: unknown) =>
  (requireCareAgent as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(a);
const req = (body: unknown) => ({ json: async () => body }) as unknown as Parameters<typeof POST>[0];

/** sb whose non-admin assign-filter (.from().select().in().or()) returns `allowed`. */
const filterSb = (allowed: Array<{ id: string }>) => ({
  from: () => ({ select: () => ({ in: () => ({ or: async () => ({ data: allowed }) }) }) }),
});

beforeEach(() => vi.clearAllMocks());

describe("POST /api/care/agent/conversations/bulk", () => {
  it("passes the requireCareAgent gate result through (e.g. 403 non-agent)", async () => {
    setAuth({ ok: false, error: "Not a support agent.", status: 403 });
    expect((await POST(req({ action: "status", ids: [UUID], status: "open" }))).status).toBe(403);
    expect(bulkSetConversationStatus).not.toHaveBeenCalled();
  });

  it("400 rejects a batch over the 200-id limit (DoS guard)", async () => {
    setAuth({ ok: true, isAdmin: true, agentId: "a1", sb: {} });
    const ids = Array.from({ length: 201 }, () => UUID);
    expect((await POST(req({ action: "status", ids, status: "open" }))).status).toBe(400);
    expect(bulkSetConversationStatus).not.toHaveBeenCalled();
  });

  it("400 rejects non-uuid ids and an unknown action", async () => {
    setAuth({ ok: true, isAdmin: true, agentId: "a1", sb: {} });
    expect((await POST(req({ action: "status", ids: ["nope"], status: "open" }))).status).toBe(400);
    expect((await POST(req({ action: "delete", ids: [UUID] }))).status).toBe(400);
  });

  it("200 status action → applies and returns affectedCount", async () => {
    setAuth({ ok: true, isAdmin: true, agentId: "a1", sb: {} });
    const res = await POST(req({ action: "status", ids: [UUID], status: "closed" }));
    expect(res.status).toBe(200);
    expect((await res.json()).affectedCount).toBe(3);
    expect(bulkSetConversationStatus).toHaveBeenCalledWith({ ids: [UUID], status: "closed" });
  });

  it("non-admin assign: filters ids to own/unclaimed before assigning (permission matrix)", async () => {
    // The caller requested two ids but is only permitted to reassign UUID (own/unclaimed).
    setAuth({ ok: true, isAdmin: false, agentId: "a1", sb: filterSb([{ id: UUID }]) });
    const res = await POST(req({ action: "assign", ids: [UUID, UUID2], targetAgentId: UUID }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.requestedCount).toBe(2);
    expect(bulkAssignConversations).toHaveBeenCalledWith({ ids: [UUID], targetAgentId: UUID });
  });

  it("admin assign: no filtering — all requested ids are assigned", async () => {
    setAuth({ ok: true, isAdmin: true, agentId: "a1", sb: {} });
    await POST(req({ action: "assign", ids: [UUID, UUID2], targetAgentId: null }));
    expect(bulkAssignConversations).toHaveBeenCalledWith({ ids: [UUID, UUID2], targetAgentId: null });
  });
});
