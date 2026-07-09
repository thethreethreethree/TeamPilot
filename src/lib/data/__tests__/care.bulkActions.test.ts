import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSupabaseClient } from "./_supabaseMock";

/**
 * bulkSetConversationStatus / bulkAssignConversations return the ACTUAL number of
 * rows updated (from .select("id") after the update), so the inbox can honestly show
 * "3 of 5 archived" when RLS silently drops rows. These pin two things:
 *   - the honest ACTUAL-count return (not the input count);
 *   - the §3.4 false-ok fix (2026-07-09): a DB error must THROW, not return a silent
 *     0 that the route reported as { ok:true, affectedCount:0 } (success on failure).
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { bulkSetConversationStatus, bulkAssignConversations } from "../care";

describe("bulk care actions — honest count + §3.4 no false-ok", () => {
  let calls: Array<[string, unknown[]]>;
  beforeEach(() => {
    calls = [];
  });

  it("returns the ACTUAL updated count (RLS-dropped rows are not counted)", async () => {
    // 5 ids requested, but the update+select returns only 3 (RLS dropped 2).
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseClient(
        { support_conversations: { data: [{ id: "a" }, { id: "b" }, { id: "c" }] } },
        calls
      ) as never
    );
    const n = await bulkSetConversationStatus({
      ids: ["a", "b", "c", "d", "e"],
      status: "closed",
    });
    expect(n).toBe(3); // actual, not the 5 requested — honest "3 of 5"
  });

  it("short-circuits to 0 on an empty id list (no query)", async () => {
    vi.mocked(createClient).mockResolvedValue(makeSupabaseClient({}, calls) as never);
    expect(await bulkSetConversationStatus({ ids: [], status: "closed" })).toBe(0);
    expect(calls.length).toBe(0); // never touched the DB
  });

  it("THROWS on a DB error — no silent 0 that the route reports as ok:true (false-ok)", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseClient(
        { support_conversations: { data: null, error: { message: "db down" } } },
        calls
      ) as never
    );
    await expect(
      bulkSetConversationStatus({ ids: ["a"], status: "closed" })
    ).rejects.toThrow("bulkSetConversationStatus failed");
  });

  it("bulkAssignConversations mirrors both behaviors (actual count + throw)", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseClient({ support_conversations: { data: [{ id: "a" }] } }, calls) as never
    );
    expect(
      await bulkAssignConversations({ ids: ["a", "b"], targetAgentId: "ag1" })
    ).toBe(1);

    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseClient(
        { support_conversations: { data: null, error: { message: "boom" } } },
        calls
      ) as never
    );
    await expect(
      bulkAssignConversations({ ids: ["a"], targetAgentId: null })
    ).rejects.toThrow("bulkAssignConversations failed");
  });
});
