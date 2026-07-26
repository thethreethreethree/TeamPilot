import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Route-level coverage for runAiFirstResponder's SHORT-CIRCUIT guard chain — the cost/abuse/handoff
 * gates that decide whether the email AI replies at all. Every one of these must turn the AI away
 * BEFORE the paid generateCareReply call; a regression that removed a gate or moved it after the LLM
 * would leak spend (or, for handoff/takeover, talk over a human). This responder previously had ZERO
 * route-level test (only extractLocalPart), so the whole chain was unprotected.
 *
 * Each case here short-circuits at or before the loop breaker, so a minimal, configurable admin mock
 * suffices — no need to scaffold the full happy path (buildRecentTurns → LLM), which the pure helpers
 * already cover. The guard ORDER in the route is: ai_responding → handoff → automated-sender →
 * loop-breaker → flood.
 */
let aiResponding = true;
let recentAiReplyCount = 0;
const insertSpy = vi.fn().mockResolvedValue({ error: null });
const updateEqSpy = vi.fn().mockResolvedValue({ error: null });

const adminMock = {
  from: (table: string) => {
    if (table === "support_conversations") {
      return {
        // takeover check: .select("ai_responding").eq("id").maybeSingle()
        select: () => ({
          eq: () => ({ maybeSingle: () => Promise.resolve({ data: { ai_responding: aiResponding } }) }),
        }),
        // handoff / loop-breaker flip: .update({...}).eq("id")
        update: () => ({ eq: updateEqSpy }),
      };
    }
    if (table === "support_messages") {
      // loop breaker count: .select("id",{count,head}).eq().eq().gte()
      return {
        select: () => ({
          eq: () => ({ eq: () => ({ gte: () => Promise.resolve({ count: recentAiReplyCount }) }) }),
        }),
      };
    }
    if (table === "support_conversation_events") return { insert: insertSpy };
    return {};
  },
};

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => adminMock }));
vi.mock("@/lib/claude", () => ({ generateCareReply: vi.fn() }));

import { runAiFirstResponder, POST } from "@/app/api/care/inbound/email/route";
import { generateCareReply } from "@/lib/claude";

const base = {
  conversationId: "conv-1",
  companyId: "co-1",
  customerId: "cust-1",
  customerMessageId: "msg-1",
  headers: [] as { Name: string; Value: string }[],
  from: "jane@customer.com",
};

beforeEach(() => {
  vi.clearAllMocks();
  aiResponding = true;
  recentAiReplyCount = 0;
  insertSpy.mockResolvedValue({ error: null });
  updateEqSpy.mockResolvedValue({ error: null });
});

const eventOfType = (t: string) =>
  insertSpy.mock.calls.find((c) => (c[0] as { event_type?: string })?.event_type === t)?.[0] as
    | { event_type: string; actor_type: string; metadata: Record<string, unknown> }
    | undefined;

describe("runAiFirstResponder — short-circuit guard chain (no LLM before a gate passes)", () => {
  it("human takeover (ai_responding=false) → returns immediately, no LLM", async () => {
    aiResponding = false;
    await runAiFirstResponder({ ...base, customerMessage: "Hi, still need help with my order." });
    expect(generateCareReply).not.toHaveBeenCalled();
  });

  // NOTE: no "customer asks for a human" case here on purpose. The route's PRE-LLM handoff gate
  // (line 484) calls detectHandoffSignal(customerMessage), but that function detects AGENT-side
  // handoff language / the [[HANDOFF]] sentinel (param is named `aiResponse`), so it does NOT fire
  // on a customer saying "speak to a human." A genuine human-request is instead caught POST-LLM by
  // the detectHandoffSignal(reply.text) at line 651 (warmer UX than a pre-LLM silent handoff). This
  // misapplication is flagged for founder judgment (queue), not locked by a test.

  it("automated sender (RFC 3834 Auto-Submitted) → suppressed + ai_suppressed_automated, no LLM", async () => {
    await runAiFirstResponder({
      ...base,
      customerMessage: "Out of office until Monday.",
      headers: [{ Name: "Auto-Submitted", Value: "auto-generated" }],
    });
    expect(generateCareReply).not.toHaveBeenCalled();
    const e = eventOfType("ai_suppressed_automated");
    expect(e).toBeTruthy();
    expect(e!.actor_type).toBe("system");
    expect(e!.metadata.reason).toBe("auto-submitted:auto-generated");
  });

  it("daemon/no-reply From → suppressed as automated, no LLM", async () => {
    await runAiFirstResponder({
      ...base,
      customerMessage: "Delivery Status Notification (Failure)",
      from: "mailer-daemon@mail.customer.com",
    });
    expect(generateCareReply).not.toHaveBeenCalled();
    expect(eventOfType("ai_suppressed_automated")!.metadata.reason).toBe("no-reply-sender:mailer-daemon");
  });

  it("Outlook OOO subject (no automated headers) → suppressed via the subject wiring, no LLM", async () => {
    await runAiFirstResponder({
      ...base,
      customerMessage: "Automatic reply body text.",
      headers: [],
      subject: "Automatic reply: Re: your support request",
    });
    expect(generateCareReply).not.toHaveBeenCalled();
    expect(eventOfType("ai_suppressed_automated")!.metadata.reason).toBe("ooo-subject");
  });

  it("loop breaker: >=5 AI replies in the window → suppressed + ai_suppressed_loop, no LLM", async () => {
    recentAiReplyCount = 5; // AI_LOOP_BREAKER_MAX
    await runAiFirstResponder({ ...base, customerMessage: "Thanks, received your note." });
    expect(generateCareReply).not.toHaveBeenCalled();
    const e = eventOfType("ai_suppressed_loop");
    expect(e, "loop breaker must record its suppression").toBeTruthy();
    expect(updateEqSpy).toHaveBeenCalled(); // ai_responding flipped off — a human takes the looping thread
  });
});

/**
 * Webhook AUTH GATE on the POST handler — this is the security boundary for a PUBLIC endpoint. Without it,
 * anyone could POST a forged "customer" email and drive the AI (impersonation, cost-abuse, injection). The
 * gate was previously UNtested (the suppression tests above call the internal runAiFirstResponder, bypassing
 * it). The auth check runs FIRST — before body parse — so these need no body scaffolding.
 */
describe("POST /api/care/inbound/email — webhook auth gate (public endpoint)", () => {
  const OLD_SECRET = process.env.CARE_INBOUND_EMAIL_SECRET;
  afterEach(() => {
    if (OLD_SECRET === undefined) delete process.env.CARE_INBOUND_EMAIL_SECRET;
    else process.env.CARE_INBOUND_EMAIL_SECRET = OLD_SECRET;
  });

  const postReq = (secretHeader?: string) =>
    ({
      headers: {
        get: (k: string) =>
          k.toLowerCase() === "x-care-webhook-secret" ? secretHeader ?? null : null,
      },
      json: () => Promise.resolve({}),
    }) as never;

  it("FAIL-CLOSED: 500 when CARE_INBOUND_EMAIL_SECRET is unset — rejects (never processes), signals the provider to retry", async () => {
    // Deliberately 500, not 503: a missing secret is a SERVER misconfig, so returning 500 makes the
    // provider (Postmark) retry once the operator sets it — while still REFUSING to process the webhook.
    // The security property under test is "unset secret NEVER opens the endpoint", regardless of the exact code.
    delete process.env.CARE_INBOUND_EMAIL_SECRET;
    const status = (await POST(postReq("anything"))).status;
    expect(status).toBe(500);
    expect(status).not.toBe(200); // the load-bearing invariant: it must never accept
  });

  it("401 when the X-Care-Webhook-Secret header is wrong or absent — forged emails are rejected", async () => {
    process.env.CARE_INBOUND_EMAIL_SECRET = "s3cret";
    expect((await POST(postReq("wrong-secret"))).status).toBe(401);
    expect((await POST(postReq(undefined))).status).toBe(401);
  });
});
