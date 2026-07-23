import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Locks the WIRING of the RFC-3834 automated-sender suppression inside the email first-responder.
 * The pure detector (detectAutomatedSender) is unit-tested separately; this pins that the ROUTE
 * actually short-circuits — an automated inbound (out-of-office / bounce / bulk-list) triggers NO
 * LLM call and records an `ai_suppressed_automated` event, BEFORE the paid compute.
 *
 * Why this matters: the rest of runAiFirstResponder's AI-decision path (loop breaker, flood guard)
 * has no route-level test, so a regression that removed the guard or moved it AFTER the
 * generateCareReply call would pass silently. This test is the guard on the guard. The automated
 * path short-circuits before the loop-breaker's DB queries, so it needs only a minimal admin mock.
 */
const insertSpy = vi.fn().mockResolvedValue({ error: null });
const adminMock = {
  from: (table: string) => {
    if (table === "support_conversations") {
      return {
        // The AI-takeover check: ai_responding is still true, so the responder proceeds to the guards.
        select: () => ({
          eq: () => ({ maybeSingle: () => Promise.resolve({ data: { ai_responding: true } }) }),
        }),
        update: () => ({ eq: () => Promise.resolve({ error: null }) }),
      };
    }
    if (table === "support_conversation_events") return { insert: insertSpy };
    return {};
  },
};

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => adminMock }));
vi.mock("@/lib/claude", () => ({ generateCareReply: vi.fn() }));

import { runAiFirstResponder } from "@/app/api/care/inbound/email/route";
import { generateCareReply } from "@/lib/claude";

beforeEach(() => {
  vi.clearAllMocks();
  insertSpy.mockResolvedValue({ error: null });
});

describe("runAiFirstResponder — automated-sender suppression wiring (RFC 3834)", () => {
  it("an out-of-office (Auto-Submitted) inbound → NO LLM call, records ai_suppressed_automated with the reason", async () => {
    await runAiFirstResponder({
      conversationId: "conv-1",
      companyId: "co-1",
      customerId: "cust-1",
      customerMessage: "Out of office until Monday.", // benign — does not trip the handoff heuristic
      customerMessageId: "msg-1",
      headers: [{ Name: "Auto-Submitted", Value: "auto-generated" }],
      from: "person@customer.com",
    });

    // The core property: the paid model was never invoked for a machine sender.
    expect(generateCareReply).not.toHaveBeenCalled();

    // And the suppression is recorded on the timeline (§3.6) with the greppable reason (§3.1).
    const call = insertSpy.mock.calls.find(
      (c) => (c[0] as { event_type?: string })?.event_type === "ai_suppressed_automated"
    );
    expect(call, "expected an ai_suppressed_automated event insert").toBeTruthy();
    const row = call![0] as { actor_type: string; metadata: { reason: string } };
    expect(row.actor_type).toBe("system");
    expect(row.metadata.reason).toBe("auto-submitted:auto-generated");
  });

  it("a no-reply/daemon From (no headers) → still suppressed before the LLM", async () => {
    await runAiFirstResponder({
      conversationId: "conv-2",
      companyId: "co-1",
      customerId: "cust-2",
      customerMessage: "Delivery Status Notification (Failure)",
      customerMessageId: "msg-2",
      headers: [],
      from: "mailer-daemon@mail.customer.com",
    });
    expect(generateCareReply).not.toHaveBeenCalled();
    const call = insertSpy.mock.calls.find(
      (c) => (c[0] as { event_type?: string })?.event_type === "ai_suppressed_automated"
    );
    expect(call, "a daemon sender must be suppressed before the LLM").toBeTruthy();
    expect((call![0] as { metadata: { reason: string } }).metadata.reason).toBe(
      "no-reply-sender:mailer-daemon"
    );
  });
});
