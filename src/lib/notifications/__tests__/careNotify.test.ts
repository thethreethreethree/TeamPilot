import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * notifyAssignedAgentOfCustomerMessage — C.A.R.E push. Founder-decided scope (2026-06-27): push ONLY the
 * assigned agent, ONLY on a reply; unassigned conversations get no push. And by contract it's fire-and-forget:
 * a push failure must NEVER throw into customer-message handling. Both are worth locking.
 */

const state = vi.hoisted(() => ({
  conv: null as { assigned_agent_id: string | null; customer_id: string | null } | null,
  customer: null as { name: string | null } | null,
  pref: null as { care_notify_customer_reply: boolean | null } | null,
  prefErr: null as unknown,
  push: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => {
  const q = (result: { data: unknown; error?: unknown }) => {
    const b: Record<string, unknown> = {};
    b.select = () => b;
    b.eq = () => b;
    b.maybeSingle = async () => result;
    return b;
  };
  return {
    createAdminClient: () => ({
      from: (t: string) =>
        t === "support_conversations"
          ? q({ data: state.conv })
          : t === "profiles"
            ? q({ data: state.pref, error: state.prefErr })
            : q({ data: state.customer }),
    }),
  };
});
vi.mock("../sender", () => ({ sendPushToUsers: (...a: unknown[]) => state.push(...a) }));

const { notifyAssignedAgentOfCustomerMessage } = await import("../careNotify");

beforeEach(() => {
  state.conv = { assigned_agent_id: "agent-1", customer_id: "cust-1" };
  state.customer = { name: "Dana" };
  state.pref = { care_notify_customer_reply: true }; // default: notify
  state.prefErr = null;
  state.push.mockReset();
  state.push.mockResolvedValue(undefined);
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("notifyAssignedAgentOfCustomerMessage", () => {
  it("does NOT push when the conversation is unassigned (founder scope)", async () => {
    state.conv = { assigned_agent_id: null, customer_id: "cust-1" };
    await notifyAssignedAgentOfCustomerMessage({ conversationId: "conv-1", body: "hi" });
    expect(state.push).not.toHaveBeenCalled();
  });

  it("pushes only to the assigned agent, with the conversation url + collapse tag", async () => {
    await notifyAssignedAgentOfCustomerMessage({ conversationId: "conv-9", body: "still waiting" });
    expect(state.push).toHaveBeenCalledTimes(1);
    const arg = state.push.mock.calls[0]?.[0] as {
      userIds: string[];
      payload: { title: string; body: string; url: string; tag: string };
    };
    expect(arg.userIds).toEqual(["agent-1"]);
    expect(arg.payload.title).toBe("Dana replied");
    expect(arg.payload.url).toBe("/dashboard/care/conversations/conv-9");
    expect(arg.payload.tag).toBe("care-conversation:conv-9");
  });

  it("falls back to a generic name when the customer has none", async () => {
    state.customer = { name: null };
    await notifyAssignedAgentOfCustomerMessage({ conversationId: "c", body: "hi" });
    expect((state.push.mock.calls[0]?.[0] as { payload: { title: string } }).payload.title).toBe("A customer replied");
  });

  it("normalizes whitespace and caps the preview at 110 chars", async () => {
    await notifyAssignedAgentOfCustomerMessage({ conversationId: "c", body: "  lots   of\n\nspace  " + "x".repeat(200) });
    const body = (state.push.mock.calls[0]?.[0] as { payload: { body: string } }).payload.body;
    expect(body.length).toBe(110);
    expect(body).not.toContain("\n");
  });

  it("NEVER throws, even if the sender throws (fire-and-forget contract)", async () => {
    state.push.mockRejectedValue(new Error("vapid boom"));
    await expect(notifyAssignedAgentOfCustomerMessage({ conversationId: "c", body: "hi" })).resolves.toBeUndefined();
  });

  it("does NOT push when the agent has opted out (care_notify_customer_reply = false)", async () => {
    state.pref = { care_notify_customer_reply: false };
    await notifyAssignedAgentOfCustomerMessage({ conversationId: "c", body: "hi" });
    expect(state.push).not.toHaveBeenCalled();
  });

  it("STILL pushes when the preference column is missing (A34 degrade — pre-migration behavior)", async () => {
    state.pref = null;
    state.prefErr = { code: "42703", message: 'column "care_notify_customer_reply" does not exist' };
    await notifyAssignedAgentOfCustomerMessage({ conversationId: "c", body: "hi" });
    expect(state.push).toHaveBeenCalledTimes(1);
  });

  it("pushes when the preference is unset/null (defaults to notify)", async () => {
    state.pref = { care_notify_customer_reply: null };
    await notifyAssignedAgentOfCustomerMessage({ conversationId: "c", body: "hi" });
    expect(state.push).toHaveBeenCalledTimes(1);
  });
});
