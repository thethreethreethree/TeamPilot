import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSupabaseClient } from "./_supabaseMock";

/**
 * fetchTopics guards the 2026-07-03 Team Chat outage class (§3.4 / A14): a
 * FAILED read must surface as "live-error", never masquerade as "live-empty"
 * ("you have no chats"). It reads a fragile VIEW (chat_topic_with_counts) and,
 * on any view error, falls back to the BASE TABLE (chat_topics) so chats
 * reappear even when the view is stale — surfacing the real error only if the
 * base read ALSO fails. These four branches are exactly what regressed then.
 */
vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
  supabaseEnabled: true,
}));

import { createClient } from "@/lib/supabase/client";
import { fetchTopics } from "../chats";

const VIEW_ROW = {
  id: "t1",
  title: "Topic 1",
  description: null,
  status: "open",
  problem_id: null,
  created_by: "u1",
  created_at: "2026-07-01T00:00:00Z",
  closed_at: null,
  closed_by: null,
  close_summary: null,
  close_durability: null,
  tags: ["x"],
  coach_enabled: false,
  locked: false,
  participant_count: 3,
  message_count: 5,
  last_message_at: null,
};

function mock(byTable: Record<string, unknown>, calls: Array<[string, unknown[]]>) {
  vi.mocked(createClient).mockReturnValue(makeSupabaseClient(byTable, calls) as never);
}

describe("fetchTopics (outage-class guard)", () => {
  let calls: Array<[string, unknown[]]>;
  beforeEach(() => {
    calls = [];
  });

  it("returns live-data with mapped counts when the view read succeeds", async () => {
    mock({ chat_topic_with_counts: { data: [VIEW_ROW], error: null } }, calls);
    const out = await fetchTopics("elostate");
    expect(out.mode).toBe("live-data");
    expect(out.topics).toHaveLength(1);
    expect(out.topics[0]).toMatchObject({ id: "t1", participantCount: 3, messageCount: 5 });
  });

  it("returns live-empty on a genuine no-rows read (data present, length 0)", async () => {
    mock({ chat_topic_with_counts: { data: [], error: null } }, calls);
    const out = await fetchTopics("elostate");
    expect(out.mode).toBe("live-empty");
    expect(out.topics).toEqual([]);
  });

  it("surfaces live-error (NOT live-empty) when BOTH the view and base read fail", async () => {
    mock(
      {
        chat_topic_with_counts: { data: null, error: { code: "42P01", message: "view is stale" } },
        chat_topics: { data: null, error: { code: "42P01", message: "base failed too" } },
      },
      calls
    );
    const out = await fetchTopics("elostate");
    expect(out.mode).toBe("live-error"); // the outage bug was this returning live-empty
    expect(out.error).toBe("42P01: view is stale"); // real cause surfaced, not hidden
    expect(out.topics).toEqual([]);
  });

  it("falls back to the base table (chats reappear) when only the view is broken", async () => {
    const BASE_ROW = {
      id: "b1",
      title: "Base Topic",
      description: null,
      status: "open",
      problem_id: null,
      created_by: "u1",
      created_at: "2026-07-01T00:00:00Z",
      closed_at: null,
      closed_by: null,
      close_summary: null,
      close_durability: null,
      tags: null,
      coach_enabled: false,
      locked: false,
    };
    mock(
      {
        chat_topic_with_counts: { data: null, error: { code: "42P01", message: "stale view" } },
        chat_topics: { data: [BASE_ROW], error: null },
      },
      calls
    );
    const out = await fetchTopics("elostate");
    expect(out.mode).toBe("live-data");
    expect(out.topics[0]).toMatchObject({ id: "b1", participantCount: 0 }); // counts degrade to 0
  });
});
