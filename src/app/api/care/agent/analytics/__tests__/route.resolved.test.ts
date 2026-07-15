import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * GET /api/care/agent/analytics — "Resolution rate" numerator contract.
 *
 * The UI shows "Resolution rate = resolved / total". Resolution rate is a §3.5
 * support hard-metric, so the numerator must count conversations that were EVER
 * resolved (resolved_at IS NOT NULL), not those whose CURRENT status is
 * 'resolved'. Archiving a resolved conversation sets status='closed' but leaves
 * resolved_at stamped (0034 trigger stamps on resolve, never clears). Counting
 * status==='resolved' made the rate DROP as a team archived resolved work — a
 * perverse §3.4 signal. These pin the persistent-field count so it can't regress.
 */
vi.mock("@/lib/api/careAgentAuth", () => ({ requireCareAgent: vi.fn() }));

import { requireCareAgent } from "@/lib/api/careAgentAuth";
import { GET } from "../route";

type Conv = {
  status: string;
  resolved_at: string | null;
  first_message_at: string | null;
  first_response_at: string | null;
};

function conv(status: string, resolvedAt: string | null): Conv {
  return { status, resolved_at: resolvedAt, first_message_at: null, first_response_at: null };
}

function fakeSb(convs: Conv[]) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          gte: () => ({ limit: async () => ({ data: convs, error: null }) }),
        }),
      }),
    }),
  };
}

function mockAuth(convs: Conv[]) {
  (requireCareAgent as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    ok: true,
    companyId: "co-1",
    sb: fakeSb(convs),
  });
}

beforeEach(() => vi.clearAllMocks());

describe("resolution rate counts EVER-resolved, not current status", () => {
  it("counts a resolved-then-ARCHIVED conversation (status=closed, resolved_at set)", async () => {
    mockAuth([
      conv("resolved", "2026-07-10T00:00:00Z"), // still resolved
      conv("closed", "2026-07-11T00:00:00Z"), // resolved THEN archived — must still count
      conv("closed", null), // archived spam, never resolved — must NOT count
      conv("open", null), // in flight — must NOT count
    ]);
    const res = await GET();
    const json = await res.json();
    expect(json.totalConversations).toBe(4);
    expect(json.resolvedConversations).toBe(2); // the two with resolved_at set
  });

  it("a conversation with status='resolved' but null resolved_at does NOT count (defensive)", async () => {
    // Shouldn't happen (the trigger stamps it), but the count keys off the
    // persistent field, so a stray status without the stamp is not counted.
    mockAuth([conv("resolved", null)]);
    const json = await (await GET()).json();
    expect(json.resolvedConversations).toBe(0);
  });

  it("zero conversations → 0 resolved (no crash)", async () => {
    mockAuth([]);
    const json = await (await GET()).json();
    expect(json.totalConversations).toBe(0);
    expect(json.resolvedConversations).toBe(0);
  });
});
