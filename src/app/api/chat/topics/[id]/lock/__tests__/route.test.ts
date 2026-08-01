import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * POST /api/chat/topics/[id]/lock — lock/unlock a small chat topic. Previously untested. Pins the
 * gates: auth (401), { locked: boolean } validation (400), topic-not-found (404), the OWNER gate
 * (only the creator may lock — 403 otherwise), the participant rule (3+ participants can't be
 * creator-locked — 400), and the happy path (2-or-fewer creator lock -> 200).
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: vi.fn(() => null) }));

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { POST } from "../route";

const setUser = (user: { id: string } | null) =>
  (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user } }) },
  });

function fakeAdmin(o: {
  topic?: { id: string; created_by: string } | null;
  participantCount?: number;
  updateError?: unknown;
}) {
  return {
    from: (t: string) => {
      if (t === "chat_topics") {
        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: o.topic ?? null }) }) }),
          update: () => ({ eq: async () => ({ error: o.updateError ?? null }) }),
        };
      }
      if (t === "chat_participants") {
        return {
          select: () => ({ eq: () => ({ is: async () => ({ count: o.participantCount ?? 0 }) }) }),
        };
      }
      throw new Error(`unexpected table ${t}`);
    },
  };
}
const setAdmin = (o: Parameters<typeof fakeAdmin>[0]) =>
  (createAdminClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue(fakeAdmin(o));

const ctx = { params: Promise.resolve({ id: "topic-1" }) };
const req = (body: unknown) => ({ json: async () => body }) as unknown as Parameters<typeof POST>[0];

beforeEach(() => vi.clearAllMocks());

describe("POST /api/chat/topics/[id]/lock", () => {
  it("401 when unauthenticated", async () => {
    setUser(null);
    setAdmin({});
    expect((await POST(req({ locked: true }), ctx)).status).toBe(401);
  });

  it("400 on an invalid body (locked not a boolean)", async () => {
    setUser({ id: "u1" });
    setAdmin({});
    expect((await POST(req({ locked: "yes" }), ctx)).status).toBe(400);
    expect((await POST(req({}), ctx)).status).toBe(400);
  });

  it("404 when the topic does not exist", async () => {
    setUser({ id: "u1" });
    setAdmin({ topic: null });
    expect((await POST(req({ locked: true }), ctx)).status).toBe(404);
  });

  it("403 when the caller is NOT the topic creator (owner gate)", async () => {
    setUser({ id: "u1" });
    setAdmin({ topic: { id: "topic-1", created_by: "someone-else" }, participantCount: 1 });
    expect((await POST(req({ locked: true }), ctx)).status).toBe(403);
  });

  it("400 when the topic has 3+ participants (creator lock not allowed there)", async () => {
    setUser({ id: "u1" });
    setAdmin({ topic: { id: "topic-1", created_by: "u1" }, participantCount: 3 });
    expect((await POST(req({ locked: true }), ctx)).status).toBe(400);
  });

  it("200 for the creator locking a small (<=2) topic", async () => {
    setUser({ id: "u1" });
    setAdmin({ topic: { id: "topic-1", created_by: "u1" }, participantCount: 2 });
    const res = await POST(req({ locked: true }), ctx);
    expect(res.status).toBe(200);
    expect((await res.json()).locked).toBe(true);
  });
});
