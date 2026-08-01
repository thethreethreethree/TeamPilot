import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * fetchTopicMessageGrades hydrates a chat topic's message-grade indicators. It MUST scope the read to the
 * caller's own grades (`actor = self`): a topic's indicators are the user's private self-assessments, and an
 * unscoped read let a rep who knew a peer's topicId+messageId surface a bogus indicator on the peer's message
 * (fixed `c65e02bd`). This locks the actor filter (a refactor dropping it reopens the injection) + the
 * no-session short-circuit. The supabase browser client is faked; the query chain records the eq() filters.
 */
vi.mock("@/lib/supabase/client", () => ({ supabaseEnabled: true, createClient: vi.fn() }));

import { createClient } from "@/lib/supabase/client";
import { fetchTopicMessageGrades } from "../gradeClient";

const filters: Array<[string, unknown]> = [];

const setClient = (user: { id: string } | null, rows: unknown[]) =>
  (createClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    auth: { getSession: async () => ({ data: { session: user ? { user } : null } }) },
    from: () => {
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.eq = (col: string, val: unknown) => {
        filters.push([col, val]);
        return chain;
      };
      chain.order = () => chain;
      chain.limit = () => Promise.resolve({ data: rows, error: null });
      return chain;
    },
  });

beforeEach(() => {
  vi.clearAllMocks();
  filters.length = 0;
});

describe("fetchTopicMessageGrades", () => {
  it("scopes the read to the caller (actor = self) + the topic subject", async () => {
    setClient({ id: "u1" }, []);
    await fetchTopicMessageGrades("topic-abc");
    expect(filters).toContainEqual(["actor", "u1"]);
    expect(filters).toContainEqual(["subject", "chat_topic:topic-abc"]);
    expect(filters).toContainEqual(["kind", "coach.message_graded"]);
  });

  it("returns a message_id → grade map (last-write-wins)", async () => {
    setClient({ id: "u1" }, [
      { payload: { message_id: "m1", grade: "productive" }, created_at: "2026-08-01T00:00:00Z" },
      { payload: { message_id: "m1", grade: "needs_guidance" }, created_at: "2026-08-01T00:01:00Z" },
      { payload: { message_id: "m2", grade: "neutral" }, created_at: "2026-08-01T00:02:00Z" },
    ]);
    const map = await fetchTopicMessageGrades("t1");
    expect(map.get("m1")).toBe("needs_guidance"); // later row wins
    expect(map.get("m2")).toBe("neutral");
    expect(map.size).toBe(2);
  });

  it("returns an empty map (and never queries) when there is no session", async () => {
    setClient(null, [{ payload: { message_id: "m1", grade: "productive" } }]);
    const map = await fetchTopicMessageGrades("t1");
    expect(map.size).toBe(0);
    expect(filters).toHaveLength(0); // short-circuited before the query
  });
});
