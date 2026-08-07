import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { LlmError } from "@/lib/llm/errors";

/**
 * Endpoint wiring for the Sales Coach extension summarize route. Same shared-guard security as the other
 * tools, PLUS the distinct error contract: unlike dissect/coach (which never throw), the summary engine lets
 * an LlmError propagate, so this route MUST map a provider rate-limit to 429 and other failures to 502 —
 * never a false-empty summary (§3.4). These lock the gate ordering and that error mapping.
 */

vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: vi.fn(() => null) }));
vi.mock("@/lib/api/validate", () => ({ readBody: vi.fn(async () => ({ conversation: "a sales thread" })) }));
vi.mock("@/lib/api/extensionAuth", () => ({ requireEntitledExtensionUser: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { full_name: "Dana Rep" } }) }) }),
    }),
  })),
}));
vi.mock("@/lib/coach/extension/salesSummary", () => ({ generateSalesSummary: vi.fn() }));

import { POST } from "@/app/api/coach/extension/summarize/route";
import { rateLimit } from "@/lib/api/rateLimit";
import { requireEntitledExtensionUser } from "@/lib/api/extensionAuth";
import { generateSalesSummary } from "@/lib/coach/extension/salesSummary";

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

describe("POST /api/coach/extension/summarize — gate ordering + error mapping", () => {
  it("pre-auth rate limit short-circuits before the gate and the engine", async () => {
    vi.mocked(rateLimit).mockReturnValueOnce(NextResponse.json({ error: "slow" }, { status: 429 }));
    const res = await POST(req);
    expect(res.status).toBe(429);
    expect(requireEntitledExtensionUser).not.toHaveBeenCalled();
    expect(generateSalesSummary).not.toHaveBeenCalled();
  });

  it("unentitled tenant (402) is turned away BEFORE the engine runs", async () => {
    vi.mocked(requireEntitledExtensionUser).mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "locked" }, { status: 402 }),
    } as never);
    const res = await POST(req);
    expect(res.status).toBe(402);
    expect(generateSalesSummary).not.toHaveBeenCalled();
  });

  it("entitled request returns the summary + threads the rep name", async () => {
    vi.mocked(generateSalesSummary).mockResolvedValue("The prospect wants faster onboarding; price is the open objection.");
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect((await res.json()).summary).toMatch(/faster onboarding/);
    expect(vi.mocked(generateSalesSummary).mock.calls[0]?.[0]).toMatchObject({ repName: "Dana Rep" });
  });

  it("maps an EMPTY summary (successful call, blank text) to 502 — never a false-empty 'caught up' (§3.4)", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(generateSalesSummary).mockResolvedValue("");
    const res = await POST(req);
    expect(res.status).toBe(502);
    expect((await res.json()).summary).toBeUndefined();
    spy.mockRestore();
  });

  it("maps a provider RATE-LIMIT LlmError to 429 (not a false-empty summary)", async () => {
    vi.mocked(generateSalesSummary).mockRejectedValue(new LlmError({ kind: "rate_limit", message: "slow down", provider: "deepseek" }));
    const res = await POST(req);
    expect(res.status).toBe(429);
    expect((await res.json()).summary).toBeUndefined();
  });

  it("maps a non-rate-limit LlmError to its status (502 default)", async () => {
    vi.mocked(generateSalesSummary).mockRejectedValue(new LlmError({ kind: "server", message: "upstream 500", provider: "deepseek" }));
    const res = await POST(req);
    expect(res.status).toBe(502);
  });

  it("maps a non-LLM throw to 502", async () => {
    vi.mocked(generateSalesSummary).mockRejectedValue(new Error("boom"));
    const res = await POST(req);
    expect(res.status).toBe(502);
  });
});
