import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSupabaseClient } from "./_supabaseMock";

/**
 * claimConversation posts the customer-facing handoff notice (0188 requirement #1) — but ONLY
 * when the claim is the moment the AI hands off (prior ai_responding === true). If the AI has
 * already escalated (and already posted the notice), or an agent re-claims / is reassigned, it
 * must NOT re-notice: without the guard, every claim would spam the customer with another
 * "you're being connected" line. These pin both directions of that guard.
 */

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { claimConversation } from "../care";
import { HANDOFF_NOTICE } from "@/lib/care/handoverNotice";

type Call = [string, unknown[]];

/** Server client: 1st .from(support_conversations) = the prior-state read, 2nd = the update. */
function serverClient(priorAiResponding: boolean, calls: Call[]) {
  let n = 0;
  return makeSupabaseClient(
    {
      support_conversations: () =>
        n++ === 0
          ? { data: { ai_responding: priorAiResponding }, error: null } // prior read
          : { data: [{ id: "cv1" }], error: null }, // update (strictMutate needs ≥1 row)
    },
    calls
  );
}

describe("claimConversation — handoff notice guard", () => {
  let adminCalls: Call[];
  beforeEach(() => {
    adminCalls = [];
    vi.mocked(createAdminClient).mockReturnValue(
      makeSupabaseClient({ support_messages: { data: { id: "m1" }, error: null } }, adminCalls) as never
    );
  });

  it("posts the notice when the AI was still responding (a genuine AI→human handoff)", async () => {
    vi.mocked(createClient).mockResolvedValue(serverClient(true, []) as never);

    await claimConversation({ conversationId: "cv1", agentId: "a1" });

    // postSystemMessage → an insert on support_messages carrying the handoff notice.
    const insert = adminCalls.find(([m]) => m === "insert");
    expect(insert).toBeDefined();
    expect(insert?.[1][0]).toMatchObject({ author_type: "system", body: HANDOFF_NOTICE });
  });

  it("does NOT post the notice when the AI already handed off (no double-notice / no spam)", async () => {
    vi.mocked(createClient).mockResolvedValue(serverClient(false, []) as never);

    await claimConversation({ conversationId: "cv1", agentId: "a1" });

    expect(adminCalls.find(([m]) => m === "insert")).toBeUndefined();
  });
});
