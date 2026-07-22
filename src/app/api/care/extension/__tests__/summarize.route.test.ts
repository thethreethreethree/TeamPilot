import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

/**
 * Endpoint wiring for the extension's reference tool route (summarize). The unit tests elsewhere cover the gate
 * and entitlement in isolation; this covers that the ROUTE composes them in the right ORDER — the security
 * property being: a rate-limited or unentitled request must be turned away BEFORE any paid compute (the LLM)
 * runs. A regression that reordered these would leak paid results / spend to callers who shouldn't get them.
 */

vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: vi.fn(() => null) }));
vi.mock("@/lib/api/validate", () => ({ readBody: vi.fn(async () => ({ conversation: "a customer thread" })) }));
vi.mock("@/lib/api/extensionAuth", () => ({ requireEntitledExtensionUser: vi.fn() }));
vi.mock("@/lib/care/config", () => ({ getProductContextForTenant: vi.fn(async () => "PRODUCT CONTEXT") }));
vi.mock("@/lib/claude", () => ({ generateCareReply: vi.fn() }));

import { POST } from "@/app/api/care/extension/summarize/route";
import { rateLimit } from "@/lib/api/rateLimit";
import { requireEntitledExtensionUser } from "@/lib/api/extensionAuth";
import { generateCareReply } from "@/lib/claude";

const entitled = {
  ok: true,
  user: { userId: "u", companyId: "c", entitlement: { status: "active", trialDaysLeft: 0, plan: "pro" } },
};
const req = {} as never; // the route passes req only to the (mocked) rateLimit/readBody/gate

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(rateLimit).mockReturnValue(null);
});

describe("POST /api/care/extension/summarize — gate ordering", () => {
  it("pre-auth rate limit short-circuits before the auth/entitlement gate", async () => {
    vi.mocked(rateLimit).mockReturnValueOnce(NextResponse.json({ error: "slow down" }, { status: 429 }));
    const res = await POST(req);
    expect(res.status).toBe(429);
    expect(requireEntitledExtensionUser).not.toHaveBeenCalled();
    expect(generateCareReply).not.toHaveBeenCalled();
  });

  it("unentitled tenant (402) is turned away BEFORE the LLM runs", async () => {
    vi.mocked(requireEntitledExtensionUser).mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "locked", entitlement: { status: "locked" } }, { status: 402 }),
    } as never);
    const res = await POST(req);
    expect(res.status).toBe(402);
    expect(generateCareReply).not.toHaveBeenCalled(); // the security property
  });

  it("entitled request returns the engine's summary (trimmed)", async () => {
    vi.mocked(requireEntitledExtensionUser).mockResolvedValue(entitled as never);
    vi.mocked(generateCareReply).mockResolvedValue({ text: "  A crisp summary.  " } as never);
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect((await res.json()).summary).toBe("A crisp summary.");
    expect(generateCareReply).toHaveBeenCalledOnce();
  });

  it("engine failure → 502 (handled, not a crash)", async () => {
    vi.mocked(requireEntitledExtensionUser).mockResolvedValue(entitled as never);
    vi.mocked(generateCareReply).mockRejectedValue(new Error("llm unavailable"));
    const res = await POST(req);
    expect(res.status).toBe(502);
  });
});
