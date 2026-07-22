import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

/**
 * Coach extension route: gate ordering + the SHARED validator. We deliberately do NOT mock validateCoachAnalysis
 * — the real one runs, so this proves the extension enforces the exact same response contract as the in-app
 * ask-coach (a valid shape → { coach }, an invalid shape → 502, never trusting the model's JSON).
 */

vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: vi.fn(() => null) }));
vi.mock("@/lib/api/validate", () => ({
  readBody: vi.fn(async () => ({ conversation: "customer thread", draft: "here is my reply" })),
}));
vi.mock("@/lib/api/extensionAuth", () => ({ requireEntitledExtensionUser: vi.fn() }));
vi.mock("@/lib/care/config", () => ({ getProductContextForTenant: vi.fn(async () => "PRODUCT CONTEXT") }));
vi.mock("@/lib/coach/v5/prompt", () => ({
  buildSystemPrompt: vi.fn(() => "SYS"),
  buildUserMessage: vi.fn(() => "USER"),
}));
vi.mock("@/lib/coach/v5/memory", () => ({
  loadCoachMemory: vi.fn(async () => ({})),
  renderMemoryForPrompt: vi.fn(() => ""),
}));
vi.mock("@/lib/claude", () => ({ analyzeCoachV5: vi.fn() }));

import { POST } from "@/app/api/care/extension/coach/route";
import { rateLimit } from "@/lib/api/rateLimit";
import { requireEntitledExtensionUser } from "@/lib/api/extensionAuth";
import { analyzeCoachV5 } from "@/lib/claude";

const entitled = { ok: true, user: { userId: "u", companyId: "c" } };
const req = {} as never;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(rateLimit).mockReturnValue(null);
});

describe("POST /api/care/extension/coach", () => {
  it("unentitled (402) turned away before the Coach LLM", async () => {
    vi.mocked(requireEntitledExtensionUser).mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "locked" }, { status: 402 }),
    } as never);
    const res = await POST(req);
    expect(res.status).toBe(402);
    expect(analyzeCoachV5).not.toHaveBeenCalled();
  });

  it("valid analysis JSON → { coach }", async () => {
    vi.mocked(requireEntitledExtensionUser).mockResolvedValue(entitled as never);
    vi.mocked(analyzeCoachV5).mockResolvedValue({
      text: JSON.stringify({ classification: "correct", needsImprovement: false, conversationStarters: [] }),
    } as never);
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.coach.classification).toBe("correct");
    expect(body.coach.needsImprovement).toBe(false);
  });

  it("invalid classification → 502 (shared validator rejects it)", async () => {
    vi.mocked(requireEntitledExtensionUser).mockResolvedValue(entitled as never);
    vi.mocked(analyzeCoachV5).mockResolvedValue({
      text: JSON.stringify({ classification: "bogus", needsImprovement: false, conversationStarters: [] }),
    } as never);
    const res = await POST(req);
    expect(res.status).toBe(502);
  });

  it("non-JSON → 502 malformed", async () => {
    vi.mocked(requireEntitledExtensionUser).mockResolvedValue(entitled as never);
    vi.mocked(analyzeCoachV5).mockResolvedValue({ text: "not json" } as never);
    const res = await POST(req);
    expect(res.status).toBe(502);
  });
});
