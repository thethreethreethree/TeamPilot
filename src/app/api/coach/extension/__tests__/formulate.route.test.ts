import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { LlmError } from "@/lib/llm/errors";

/**
 * Endpoint wiring for the Sales Coach extension formulate route. Shared-guard security + the same
 * shaped-reply contract as co-pilot: an empty reply is a 502 (never a blank message), an LlmError maps to
 * 429/502, and the conversation/intent/rep are threaded to the engine.
 */

vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: vi.fn(() => null) }));
vi.mock("@/lib/api/validate", () => ({
  readBody: vi.fn(async () => ({ conversation: "a sales thread", intent: "acknowledge the price, hold the value" })),
}));
vi.mock("@/lib/api/extensionAuth", () => ({ requireEntitledExtensionUser: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { full_name: "Dana Rep" } }) }) }),
    }),
  })),
}));
vi.mock("@/lib/coach/extension/salesFormulate", () => ({ generateSalesFormulate: vi.fn() }));

import { POST } from "@/app/api/coach/extension/formulate/route";
import { rateLimit } from "@/lib/api/rateLimit";
import { requireEntitledExtensionUser } from "@/lib/api/extensionAuth";
import { generateSalesFormulate } from "@/lib/coach/extension/salesFormulate";

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

describe("POST /api/coach/extension/formulate — gate ordering + shaped-reply contract", () => {
  it("pre-auth rate limit short-circuits before the gate and the engine", async () => {
    vi.mocked(rateLimit).mockReturnValueOnce(NextResponse.json({ error: "slow" }, { status: 429 }));
    const res = await POST(req);
    expect(res.status).toBe(429);
    expect(requireEntitledExtensionUser).not.toHaveBeenCalled();
    expect(generateSalesFormulate).not.toHaveBeenCalled();
  });

  it("unentitled tenant (402) is turned away BEFORE the engine runs", async () => {
    vi.mocked(requireEntitledExtensionUser).mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "locked" }, { status: 402 }),
    } as never);
    const res = await POST(req);
    expect(res.status).toBe(402);
    expect(generateSalesFormulate).not.toHaveBeenCalled();
  });

  it("entitled request returns {reply, reasoning} and threads conversation, intent, rep", async () => {
    vi.mocked(generateSalesFormulate).mockResolvedValue({
      reply: "I hear you on price — before we get there, can I show what changes for the team?",
      reasoning: "labeled the concern, deferred price to value",
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reply).toMatch(/price/);
    expect(body.reasoning).toMatch(/labeled/);
    expect(vi.mocked(generateSalesFormulate).mock.calls[0]?.[0]).toMatchObject({
      conversation: "a sales thread",
      intent: "acknowledge the price, hold the value",
      repName: "Dana Rep",
    });
  });

  it("an empty shaped reply is a 502 (never a blank message)", async () => {
    vi.mocked(generateSalesFormulate).mockResolvedValue({ reply: "", reasoning: "no message" });
    const res = await POST(req);
    expect(res.status).toBe(502);
  });

  it("maps a provider RATE-LIMIT LlmError to 429", async () => {
    vi.mocked(generateSalesFormulate).mockRejectedValue(
      new LlmError({ kind: "rate_limit", message: "slow down", provider: "deepseek" })
    );
    expect((await POST(req)).status).toBe(429);
  });

  it("maps a non-rate-limit LlmError to its status (502 default)", async () => {
    vi.mocked(generateSalesFormulate).mockRejectedValue(
      new LlmError({ kind: "server", message: "upstream 500", provider: "deepseek" })
    );
    expect((await POST(req)).status).toBe(502);
  });

  it("maps a non-LLM throw to 502", async () => {
    vi.mocked(generateSalesFormulate).mockRejectedValue(new Error("boom"));
    expect((await POST(req)).status).toBe(502);
  });
});
