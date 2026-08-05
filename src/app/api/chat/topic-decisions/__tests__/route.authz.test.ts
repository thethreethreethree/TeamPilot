import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * POST /api/chat/topic-decisions — compound authz contract.
 *
 * Opening a Decision Dialogue requires the caller to be an ACTIVE participant of the topic AND either a
 * per-topic admin OR a company admin (isAdminRole). The valuable, easy-to-regress property is the
 * COMPOUND-ness: a company admin who is NOT a participant is still denied (the participant check runs
 * first). These pin the deny paths + both pass-branches — the route had no test before. The pass cases are
 * proven by a 409 "dialogue already open" (an existing row), which only fires PAST the gate, so we don't
 * mock the insert.
 */
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/supabase/config", () => ({ supabaseEnabled: true }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/api/validate", () => ({ readBody: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { readBody } from "@/lib/api/validate";
import { POST } from "../route";

const asMock = (x: unknown) => x as ReturnType<typeof vi.fn>;

type Rows = { topic?: unknown; participant?: unknown; profile?: unknown; existing?: unknown };
function sb(user: { id: string } | null, rows: Rows) {
  const chain = (data: unknown): Record<string, unknown> => {
    const c: Record<string, unknown> = {};
    c.select = () => c;
    c.eq = () => c;
    c.neq = () => c;
    c.insert = () => c;
    c.maybeSingle = async () => ({ data, error: null });
    c.single = async () => ({ data: null, error: { message: "not-mocked" } });
    return c;
  };
  return {
    auth: { getUser: async () => ({ data: { user } }) },
    from: (t: string) => {
      if (t === "chat_topics") return chain(rows.topic ?? null);
      if (t === "chat_participants") return chain(rows.participant ?? null);
      if (t === "profiles") return chain(rows.profile ?? null);
      if (t === "chat_topic_decisions") return chain(rows.existing ?? null);
      return chain(null);
    },
  };
}
const req = () => ({ json: async () => ({}) } as never);
const openTopic = { id: "t1", company_id: "co1", status: "open" };

beforeEach(() => {
  vi.clearAllMocks();
  asMock(readBody).mockResolvedValue({ topicId: "t1", initialSituation: "s" });
});

describe("POST /api/chat/topic-decisions — participant AND (topic-admin OR company-admin)", () => {
  it("401 when unauthenticated", async () => {
    asMock(createClient).mockResolvedValue(sb(null, {}));
    expect((await POST(req())).status).toBe(401);
  });
  it("404 when the topic does not exist", async () => {
    asMock(createClient).mockResolvedValue(sb({ id: "u1" }, { topic: null }));
    expect((await POST(req())).status).toBe(404);
  });
  it("403 when the caller is NOT a participant", async () => {
    asMock(createClient).mockResolvedValue(sb({ id: "u1" }, { topic: openTopic, participant: null }));
    expect((await POST(req())).status).toBe(403);
  });
  it("403 for a participant who is neither topic-admin nor company-admin", async () => {
    asMock(createClient).mockResolvedValue(
      sb({ id: "u1" }, { topic: openTopic, participant: { role: "member", left_at: null }, profile: { role: "Member" } })
    );
    expect((await POST(req())).status).toBe(403);
  });
  it("403 for a COMPANY ADMIN who is NOT a participant (compound gate — admin alone is not enough)", async () => {
    asMock(createClient).mockResolvedValue(
      sb({ id: "u1" }, { topic: openTopic, participant: null, profile: { role: "CEO" } })
    );
    expect((await POST(req())).status).toBe(403);
  });
  it("passes the gate for a per-topic admin participant (→ 409 on an already-open dialogue)", async () => {
    asMock(createClient).mockResolvedValue(
      sb({ id: "u1" }, { topic: openTopic, participant: { role: "admin", left_at: null }, existing: { id: "d1", phase: "situation" } })
    );
    const status = (await POST(req())).status;
    expect(status).not.toBe(403);
    expect(status).toBe(409);
  });
  it("passes the gate for a company-admin participant (member role + CEO → 409)", async () => {
    asMock(createClient).mockResolvedValue(
      sb({ id: "u1" }, { topic: openTopic, participant: { role: "member", left_at: null }, profile: { role: "CEO" }, existing: { id: "d1", phase: "situation" } })
    );
    const status = (await POST(req())).status;
    expect(status).not.toBe(403);
    expect(status).toBe(409);
  });
});
