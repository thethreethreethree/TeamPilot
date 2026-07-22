import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { LlmError } from "@/lib/llm/errors";

/**
 * The public "Talk to Jeff" demo endpoint. No auth — a prospect hits it — so the properties that matter are:
 * hard rate-limiting turns abusers away before any LLM cost, and (the honesty posture) it NEVER 500s in the
 * prospect's face: an LLM failure soft-fails to a warm handoff line, not a crash. Untested until now.
 */

vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: vi.fn(() => null) }));
vi.mock("@/lib/api/validate", () => ({ readBody: vi.fn(async () => ({ message: "hi Jeff", history: [] })) }));
vi.mock("@/lib/care/config", () => ({
  resolveCareTenant: vi.fn(() => "elostate"),
  getProductContextForTenant: vi.fn(async () => "PRODUCT CONTEXT"),
  getCareTenantConfigByCompanyId: vi.fn(async () => ({ aiName: "Jeff", aiTone: "warm", aiResponseLength: "short" })),
}));
vi.mock("@/lib/care/prompt", () => ({
  buildCareSystemPrompt: vi.fn(() => "SYS"),
  buildCareUserMessage: vi.fn(() => "USR"),
  detectHandoffSignal: vi.fn(() => false),
  stripHandoffSentinel: vi.fn((s: string) => s),
}));
vi.mock("@/lib/claude", () => ({ generateCareReply: vi.fn() }));

import { POST } from "@/app/api/care/demo/ask/route";
import { rateLimit } from "@/lib/api/rateLimit";
import { generateCareReply } from "@/lib/claude";
import { detectHandoffSignal, stripHandoffSentinel } from "@/lib/care/prompt";

const req = {} as never;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(rateLimit).mockReturnValue(null);
  vi.mocked(detectHandoffSignal).mockReturnValue(false);
  vi.mocked(stripHandoffSentinel).mockImplementation((s: string) => s);
});

describe("POST /api/care/demo/ask (public 'Talk to Jeff')", () => {
  it("rate limit turns abusers away before the LLM runs", async () => {
    vi.mocked(rateLimit).mockReturnValueOnce(NextResponse.json({ error: "slow" }, { status: 429 }));
    const res = await POST(req);
    expect(res.status).toBe(429);
    expect(generateCareReply).not.toHaveBeenCalled();
  });

  it("success → returns the reply, no handoff", async () => {
    vi.mocked(generateCareReply).mockResolvedValue({ text: "Happy to help!" } as never);
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reply).toBe("Happy to help!");
    expect(body.handoff).toBe(false);
  });

  it("handoff sentinel → handoff:true and the sentinel is stripped from the reply", async () => {
    vi.mocked(generateCareReply).mockResolvedValue({ text: "I'll get a teammate. [[HANDOFF]]" } as never);
    vi.mocked(detectHandoffSignal).mockReturnValue(true);
    vi.mocked(stripHandoffSentinel).mockReturnValue("I'll get a teammate.");
    const body = await (await POST(req)).json();
    expect(body.handoff).toBe(true);
    expect(body.reply).toBe("I'll get a teammate.");
  });

  it("empty reply after stripping → falls back to a teammate line (never blank)", async () => {
    vi.mocked(generateCareReply).mockResolvedValue({ text: "[[HANDOFF]]" } as never);
    vi.mocked(stripHandoffSentinel).mockReturnValue("");
    const body = await (await POST(req)).json();
    expect(body.reply).toMatch(/teammate/i);
  });

  it("LlmError → soft-fails to a warm line (200, NOT 500)", async () => {
    vi.mocked(generateCareReply).mockRejectedValue(
      new LlmError({ kind: "server", message: "provider 503", provider: "anthropic" })
    );
    const res = await POST(req);
    expect(res.status).toBe(200); // never 500 in the prospect's face
    const body = await res.json();
    expect(body.handoff).toBe(true);
    expect(body.reply).toMatch(/brain|team|demo/i);
  });

  it("any other error → also soft-fails (200, NOT 500)", async () => {
    vi.mocked(generateCareReply).mockRejectedValue(new Error("unexpected"));
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect((await res.json()).handoff).toBe(true);
  });
});
