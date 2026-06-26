import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUsers } from "./sender";

/**
 * C.A.R.E push (queue #2): notify the ASSIGNED agent when a customer
 * message lands on their conversation, so they don't miss a reply
 * while the dashboard is closed.
 *
 * Scope (founder decision 2026-06-27): assigned agent on a reply only.
 * Unassigned conversations get NO push (the inbox surfaces them); this
 * function returns early when there is no assigned agent.
 *
 * Reuses the existing push core `sendPushToUsers` (§A21 — Team Chat
 * already pushes through it; C.A.R.E uses the same sender, not a
 * parallel mechanism). Delivery still requires the VAPID_* env keys to
 * be configured; without them `sendPushToUsers` no-ops gracefully.
 *
 * Non-blocking by contract: any failure is swallowed so a push problem
 * can never break customer-message handling. Call it fire-and-forget
 * (`void notifyAssignedAgentOfCustomerMessage(...)`).
 */
export async function notifyAssignedAgentOfCustomerMessage(args: {
  conversationId: string;
  body: string;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: conv } = await admin
      .from("support_conversations")
      .select("assigned_agent_id, customer_id")
      .eq("id", args.conversationId)
      .maybeSingle();

    const agentId = conv?.assigned_agent_id as string | null | undefined;
    if (!agentId) return; // unassigned → no push, per the chosen scope.

    // Best-effort customer name for the title; generic if unavailable.
    let customerName = "A customer";
    const customerId = conv?.customer_id as string | null | undefined;
    if (customerId) {
      const { data: cust } = await admin
        .from("support_customers")
        .select("name")
        .eq("id", customerId)
        .maybeSingle();
      const n = (cust?.name as string | null | undefined)?.trim();
      if (n) customerName = n;
    }

    const preview = args.body.replace(/\s+/g, " ").trim().slice(0, 110);

    await sendPushToUsers({
      userIds: [agentId],
      payload: {
        title: `${customerName} replied`,
        body: preview || "New message in a conversation you're handling.",
        url: `/dashboard/care/conversations/${args.conversationId}`,
        // Collapse repeated messages in the same conversation into one
        // notification per device (same tag → replaces, not stacks).
        tag: `care-conversation:${args.conversationId}`,
      },
    });
  } catch {
    // Never let a push failure break message handling.
  }
}
