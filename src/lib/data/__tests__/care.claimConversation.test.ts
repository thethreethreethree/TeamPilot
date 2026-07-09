import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSupabaseClient } from "./_supabaseMock";

/**
 * claimConversation is the MANUAL counterpart to routeNewConversation (an agent
 * takes a conversation from the inbox). It carries the SAME §3.3 ai_responding
 * coupling: claiming MUST flip ai_responding=false so the inbound/messages routes
 * stop AI-replying over the human who took it. A refactor dropping that flag = the
 * AI overtakes the agent (§3.3), and nothing else would catch it. routeNewConversation's
 * test pins the AUTO path; this pins the MANUAL one. Also pins the strictMutate honesty
 * guard — a 0-row write (RLS drop / gone id) must THROW, not silently "succeed".
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { claimConversation } from "../care";

type Call = [string, unknown[]];
function findUpdate(calls: Call[]): Record<string, unknown> | undefined {
  const hit = calls.find(([m]) => m === "update");
  return hit ? (hit[1][0] as Record<string, unknown>) : undefined;
}

describe("claimConversation — §3.3 ai_responding coupling", () => {
  let calls: Call[];
  beforeEach(() => {
    calls = [];
  });

  it("assigns the agent, flips ai_responding=false, and moves to in_conversation", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseClient({ support_conversations: { data: [{ id: "c1" }] } }, calls) as never
    );

    await claimConversation({ conversationId: "c1", agentId: "a1" });

    // THE §3.3 coupling: claiming must stop the AI from replying over the agent.
    expect(findUpdate(calls)).toEqual({
      assigned_agent_id: "a1",
      ai_responding: false,
      status: "in_conversation",
    });
    // Scoped to the target conversation.
    expect(calls.some(([m, a]) => m === "eq" && a[0] === "id" && a[1] === "c1")).toBe(true);
  });

  it("THROWS when the write hits 0 rows (strictMutate — RLS drop / gone id, not a silent ok)", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseClient({ support_conversations: { data: [] } }, calls) as never
    );
    await expect(
      claimConversation({ conversationId: "nope", agentId: "a1" })
    ).rejects.toThrow();
  });
});
