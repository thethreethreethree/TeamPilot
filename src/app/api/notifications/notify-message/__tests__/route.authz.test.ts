import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * POST /api/notifications/notify-message — anti-spoof authz contract.
 *
 * A push fan-out reaches every engaged participant of a topic, so triggering one
 * is a capability worth gating: only the message's ACTUAL author, naming the
 * message's REAL topic, may fire it. Otherwise any authenticated user could spam a
 * topic's participants by POSTing an arbitrary { topicId, messageId }. The route
 * defends this by re-reading the message (RLS-scoped) and checking
 * author_id === auth.uid() AND topic_id === body.topicId. These tests pin that so a
 * regression that drops either check (reopening the spam vector) fails here.
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/notifications/sender", () => ({
  sendPushToUsers: vi.fn(async () => ({ sent: 0, failed: 0, skipped: 0 })),
}));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUsers } from "@/lib/notifications/sender";
import { POST } from "../route";

/** User client: auth + the RLS-scoped message read. */
function userSb(userId: string | null, msg: unknown) {
  return {
    auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null } }) },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: msg, error: null }) }) }),
    }),
  };
}
/** Admin client: the authors + participants reads (only reached past authz). */
function adminSb() {
  const authors = { data: [{ author_id: "author" }], error: null };
  const parts = { data: [{ user_id: "author", role: "member", left_at: null }, { user_id: "other", role: "member", left_at: null }], error: null };
  let call = 0;
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({ eq: () => ({ not: () => ({ order: () => ({ limit: async () => (call++, authors) }) }) }) }),
          is: () => ({ in: async () => parts }),
        }),
      }),
    }),
  };
}
function req(body: unknown) {
  return { json: async () => body } as never;
}
const valid = { topicId: "11111111-1111-4111-8111-111111111111", messageId: "22222222-2222-4222-8222-222222222222", bodyPreview: "hi", authorName: "A", topicTitle: "T" };

beforeEach(() => {
  vi.mocked(createClient).mockReset();
  vi.mocked(createAdminClient).mockReset();
  vi.mocked(sendPushToUsers).mockClear();
});

describe("notify-message anti-spoof authz", () => {
  it("403s when the caller is NOT the message author (spoof) — no fan-out", async () => {
    vi.mocked(createClient).mockResolvedValue(
      userSb("intruder", { author_id: "someone-else", company_id: "c", topic_id: valid.topicId }) as never
    );
    const res = await POST(req(valid));
    expect(res.status).toBe(403);
    expect(sendPushToUsers).not.toHaveBeenCalled();
  });

  it("403s when the topicId doesn't match the message's real topic (topic spoof)", async () => {
    vi.mocked(createClient).mockResolvedValue(
      userSb("author", { author_id: "author", company_id: "c", topic_id: "99999999-9999-4999-8999-999999999999" }) as never
    );
    const res = await POST(req(valid));
    expect(res.status).toBe(403);
    expect(sendPushToUsers).not.toHaveBeenCalled();
  });

  it("403s when the message isn't visible/found (RLS null)", async () => {
    vi.mocked(createClient).mockResolvedValue(userSb("author", null) as never);
    const res = await POST(req(valid));
    expect(res.status).toBe(403);
  });

  it("401s an anonymous caller", async () => {
    vi.mocked(createClient).mockResolvedValue(userSb(null, null) as never);
    const res = await POST(req(valid));
    expect(res.status).toBe(401);
  });

  it("proceeds for the real author with a matching topic (fan-out fires)", async () => {
    vi.mocked(createClient).mockResolvedValue(
      userSb("author", { author_id: "author", company_id: "c", topic_id: valid.topicId }) as never
    );
    vi.mocked(createAdminClient).mockReturnValue(adminSb() as never);
    const res = await POST(req(valid));
    expect(res.status).toBe(200);
    expect(sendPushToUsers).toHaveBeenCalledOnce();
  });
});
