import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

/**
 * Endpoint wiring for the dissect tool route. Same security property as summarize: an unentitled (or rate-
 * limited) request is turned away before the engine runs. Note dissect's engine (generateConversationDissect)
 * is contracted to NEVER throw — it returns an empty (hasSignal:false) result on failure — so this route has no
 * 502 branch by design (unlike summarize, whose engine can throw). These tests document and lock that.
 */

vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: vi.fn(() => null) }));
vi.mock("@/lib/api/validate", () => ({ readBody: vi.fn(async () => ({ conversation: "a customer thread" })) }));
vi.mock("@/lib/api/extensionAuth", () => ({ requireEntitledExtensionUser: vi.fn() }));
vi.mock("@/lib/dissect/engine", () => ({ generateConversationDissect: vi.fn() }));

import { POST } from "@/app/api/care/extension/dissect/route";
import { rateLimit } from "@/lib/api/rateLimit";
import { requireEntitledExtensionUser } from "@/lib/api/extensionAuth";
import { generateConversationDissect } from "@/lib/dissect/engine";

const entitled = {
  ok: true,
  user: { userId: "u", companyId: "c", entitlement: { status: "active", trialDaysLeft: 0, plan: "pro" } },
};
const req = {} as never;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(rateLimit).mockReturnValue(null);
});

describe("POST /api/care/extension/dissect — gate ordering", () => {
  it("pre-auth rate limit short-circuits before the gate", async () => {
    vi.mocked(rateLimit).mockReturnValueOnce(NextResponse.json({ error: "slow down" }, { status: 429 }));
    const res = await POST(req);
    expect(res.status).toBe(429);
    expect(requireEntitledExtensionUser).not.toHaveBeenCalled();
    expect(generateConversationDissect).not.toHaveBeenCalled();
  });

  it("unentitled tenant (402) is turned away BEFORE the engine runs", async () => {
    vi.mocked(requireEntitledExtensionUser).mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "locked" }, { status: 402 }),
    } as never);
    const res = await POST(req);
    expect(res.status).toBe(402);
    expect(generateConversationDissect).not.toHaveBeenCalled();
  });

  it("entitled request returns the engine's dissect result", async () => {
    vi.mocked(requireEntitledExtensionUser).mockResolvedValue(entitled as never);
    vi.mocked(generateConversationDissect).mockResolvedValue({
      hasSignal: true,
      problem: { statement: "refund never resolved", whyItMatters: "churn risk" },
      rootCause: "no ownership",
      outsideView: "third contact",
      guidingQuestion: "who owns this?",
    } as never);
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect((await res.json()).dissect.hasSignal).toBe(true);
    expect(generateConversationDissect).toHaveBeenCalledOnce();
  });

  it("empty (no-signal) engine result still returns 200 with the honest empty shape", async () => {
    vi.mocked(requireEntitledExtensionUser).mockResolvedValue(entitled as never);
    vi.mocked(generateConversationDissect).mockResolvedValue({ hasSignal: false } as never);
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect((await res.json()).dissect.hasSignal).toBe(false);
  });
});
