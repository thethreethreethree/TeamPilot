import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSupabaseClient } from "./_supabaseMock";

/**
 * routeNewConversation is the load-bearing hinge of the Care "AI first-responds
 * only when no human is available" design — and it had ZERO direct test coverage
 * before this file. Its ai_responding coupling is subtle and easy to break in a
 * refactor:
 *
 *   - Successful auto-assign  → sets ai_responding=FALSE (the human takes it;
 *     the inbound/messages routes then stay silent).
 *   - Unrouted (no online agent, OR every candidate at capacity) → leaves
 *     ai_responding UNTOUCHED, so it stays true and the AI first-responds.
 *
 * Two live findings (docs/FOUNDER-ACTIONS-2026-07-06.md — the email outbound gap
 * and the widget first-turn race) depend on exactly this behavior. If a future
 * edit forgot to set ai_responding=false on assign, the AI would reply over every
 * assigned agent (§3.3 overtake) and nothing would catch it. These tests pin it.
 *
 * Mock note: routeNewConversation uses the SYNC createAdminClient
 * (createServiceRoleClient), so it's mocked with mockReturnValue, not
 * mockResolvedValue. support_conversations is queried more than once per call
 * (openConvs load, then the assign/unrouted write), so it's handed a sequence.
 */
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createAdminClient } from "@/lib/supabase/admin";
import { routeNewConversation } from "../care";

/** A table spec that returns a different canned result on each `.from()`. */
function seq(results: unknown[]) {
  const q = [...results];
  return () => (q.length > 0 ? q.shift() : { data: [] });
}

type Call = [string, unknown[]];
function findUpdate(calls: Call[]): Record<string, unknown> | undefined {
  const hit = calls.find(([m]) => m === "update");
  return hit ? (hit[1][0] as Record<string, unknown>) : undefined;
}

describe("routeNewConversation (DB-mock) — ai_responding coupling", () => {
  let calls: Call[];
  beforeEach(() => {
    calls = [];
  });

  it("assigns the least-loaded eligible agent and flips ai_responding=false", async () => {
    const care_agent_state = {
      data: [
        { agent_id: "a1", max_concurrent: 3, channels: ["email"], last_seen_at: "2026-07-01T00:00:00Z" },
        { agent_id: "a2", max_concurrent: 3, channels: ["email"], last_seen_at: "2026-07-02T00:00:00Z" },
      ],
    };
    // 1st support_conversations query = open-conversation load (a1 has 2, a2 has 0
    // → a2 is least-loaded). 2nd = the strictMutate assign write (needs a row back).
    const support_conversations = seq([
      { data: [{ assigned_agent_id: "a1" }, { assigned_agent_id: "a1" }] },
      { data: [{ id: "c1" }], error: null },
    ]);
    vi.mocked(createAdminClient).mockReturnValue(
      makeSupabaseClient({ care_agent_state, support_conversations }, calls) as never
    );

    const res = await routeNewConversation({
      conversationId: "c1",
      companyId: "co1",
      source: "email",
    });

    expect(res).toEqual({ assignedAgentId: "a2", routingMethod: "auto_least_loaded" });
    // Scoped to the company.
    expect(calls.some(([m, a]) => m === "eq" && a[0] === "company_id" && a[1] === "co1")).toBe(true);
    // The assign write MUST flip ai_responding off (the human takes over).
    expect(findUpdate(calls)).toMatchObject({
      assigned_agent_id: "a2",
      ai_responding: false,
      routing_method: "auto_least_loaded",
      status: "in_conversation",
    });
  });

  it("leaves ai_responding untouched when no agent is online — unrouted, AI first-responds", async () => {
    const care_agent_state = { data: [] };
    const support_conversations = seq([{ data: [{ id: "c1" }] }]); // only the unrouted update
    vi.mocked(createAdminClient).mockReturnValue(
      makeSupabaseClient({ care_agent_state, support_conversations }, calls) as never
    );

    const res = await routeNewConversation({
      conversationId: "c1",
      companyId: "co1",
      source: "email",
    });

    expect(res).toEqual({ assignedAgentId: null, routingMethod: "unrouted" });
    // THE critical coupling: unrouted sets routing_method ONLY, never ai_responding.
    // If this ever includes ai_responding, the AI would go silent with no agent to
    // cover — the exact opposite of the first-responder design.
    const upd = findUpdate(calls);
    expect(upd).toEqual({ routing_method: "unrouted" });
    expect(upd && "ai_responding" in upd).toBe(false);
  });

  it("breaks an equal-load tie by last_seen_at ascending (oldest-seen agent wins)", async () => {
    // Both agents carry EQUAL load (1 each) and are under capacity, so the winner is
    // decided purely by the tiebreak: sort by last_seen_at ASC → the agent seen
    // longest ago gets the next conversation (fairness). a1 (07-01) is older than
    // a2 (07-02), so a1 must win. Pins the tiebreak direction — a refactor flipping
    // the sort would silently change routing fairness and no other test would catch it.
    const care_agent_state = {
      data: [
        { agent_id: "a1", max_concurrent: 3, channels: ["email"], last_seen_at: "2026-07-01T00:00:00Z" },
        { agent_id: "a2", max_concurrent: 3, channels: ["email"], last_seen_at: "2026-07-02T00:00:00Z" },
      ],
    };
    const support_conversations = seq([
      { data: [{ assigned_agent_id: "a1" }, { assigned_agent_id: "a2" }] }, // 1 each → tie
      { data: [{ id: "c1" }], error: null },
    ]);
    vi.mocked(createAdminClient).mockReturnValue(
      makeSupabaseClient({ care_agent_state, support_conversations }, calls) as never
    );

    const res = await routeNewConversation({
      conversationId: "c1",
      companyId: "co1",
      source: "email",
    });

    expect(res).toEqual({ assignedAgentId: "a1", routingMethod: "auto_least_loaded" });
    expect(findUpdate(calls)).toMatchObject({ assigned_agent_id: "a1" });
  });

  it("treats all-candidates-over-capacity as unrouted (ai_responding stays true)", async () => {
    const care_agent_state = {
      data: [{ agent_id: "a1", max_concurrent: 1, channels: ["email"], last_seen_at: "2026-07-01T00:00:00Z" }],
    };
    // openConvs shows a1 already at its cap of 1 → filtered out → eligible empty.
    const support_conversations = seq([
      { data: [{ assigned_agent_id: "a1" }] },
      { data: [{ id: "c1" }] },
    ]);
    vi.mocked(createAdminClient).mockReturnValue(
      makeSupabaseClient({ care_agent_state, support_conversations }, calls) as never
    );

    const res = await routeNewConversation({
      conversationId: "c1",
      companyId: "co1",
      source: "email",
    });

    expect(res).toEqual({ assignedAgentId: null, routingMethod: "unrouted" });
    const upd = findUpdate(calls);
    expect(upd).toEqual({ routing_method: "unrouted" });
  });
});
