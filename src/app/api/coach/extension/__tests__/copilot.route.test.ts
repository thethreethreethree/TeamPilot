import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { LlmError } from "@/lib/llm/errors";

/**
 * Endpoint wiring for the Sales Coach extension co-pilot route. Shared-guard security + the co-pilot's own
 * contract: an empty draft is a 502 (never a blank reply), and an LlmError maps to 429 (rate-limit) / 502.
 * The lastSpeaker signal is threaded to the engine so the reply/follow-up mode is right.
 */

vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: vi.fn(() => null) }));
vi.mock("@/lib/api/validate", () => ({
  readBody: vi.fn(async () => ({ conversation: "a sales thread", lastSpeaker: "customer" })),
}));
vi.mock("@/lib/api/extensionAuth", () => ({ requireEntitledExtensionUser: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { full_name: "Dana Rep" } }) }) }),
    }),
  })),
}));
vi.mock("@/lib/coach/extension/salesCopilot", () => ({ generateSalesCopilotReply: vi.fn() }));

import { POST } from "@/app/api/coach/extension/copilot/route";
import { rateLimit } from "@/lib/api/rateLimit";
import { requireEntitledExtensionUser } from "@/lib/api/extensionAuth";
import { generateSalesCopilotReply } from "@/lib/coach/extension/salesCopilot";

const entitled = {
  ok: true,
  user: { userId: "u", companyId: "c", entitlement: { status: "active", trialDaysLeft: 0, plan: "pro" } },
};
const req = {} as never;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(rateLimit).mockReturnValue(null);
  vi.mocked(requireEntitledExtensionUser).mockResolvedValue(entitled as never);
});

describe("POST /api/coach/extension/copilot — gate ordering + draft/error contract", () => {
  it("pre-auth rate limit short-circuits before the gate and the engine", async () => {
    vi.mocked(rateLimit).mockReturnValueOnce(NextResponse.json({ error: "slow" }, { status: 429 }));
    const res = await POST(req);
    expect(res.status).toBe(429);
    expect(requireEntitledExtensionUser).not.toHaveBeenCalled();
    expect(generateSalesCopilotReply).not.toHaveBeenCalled();
  });

  it("unentitled tenant (402) is turned away BEFORE the engine runs", async () => {
    vi.mocked(requireEntitledExtensionUser).mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "locked" }, { status: 402 }),
    } as never);
    const res = await POST(req);
    expect(res.status).toBe(402);
    expect(generateSalesCopilotReply).not.toHaveBeenCalled();
  });

  it("entitled request returns {reply, reasoning} and threads rep name + lastSpeaker", async () => {
    vi.mocked(generateSalesCopilotReply).mockResolvedValue({
      reply: "What does the delay cost you weekly?",
      reasoning: "asked a SPIN implication question",
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reply).toMatch(/delay cost/);
    expect(body.reasoning).toMatch(/SPIN/);
    expect(vi.mocked(generateSalesCopilotReply).mock.calls[0]?.[0]).toMatchObject({
      repName: "Dana Rep",
      lastSpeaker: "customer",
    });
  });

  it("an empty draft is a 502 (never a blank reply)", async () => {
    vi.mocked(generateSalesCopilotReply).mockResolvedValue({ reply: "", reasoning: "named a move only" });
    const res = await POST(req);
    expect(res.status).toBe(502);
  });

  it("maps a provider RATE-LIMIT LlmError to 429", async () => {
    vi.mocked(generateSalesCopilotReply).mockRejectedValue(
      new LlmError({ kind: "rate_limit", message: "slow down", provider: "deepseek" })
    );
    const res = await POST(req);
    expect(res.status).toBe(429);
  });

  it("maps a non-rate-limit LlmError to its status (502 default)", async () => {
    vi.mocked(generateSalesCopilotReply).mockRejectedValue(
      new LlmError({ kind: "server", message: "upstream 500", provider: "deepseek" })
    );
    const res = await POST(req);
    expect(res.status).toBe(502);
  });

  it("maps a non-LLM throw to 502", async () => {
    vi.mocked(generateSalesCopilotReply).mockRejectedValue(new Error("boom"));
    const res = await POST(req);
    expect(res.status).toBe(502);
  });
});
