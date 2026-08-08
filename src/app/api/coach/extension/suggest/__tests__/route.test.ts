import { describe, it, expect, vi, beforeEach } from "vitest";

// The merged "Suggested Response" route is a dispatcher: no guidance → co-pilot engine; guidance → formulate
// engine (guidance used as the intent). This locks that branch so a refactor can't silently send everything to
// one engine (which would drop either the draft-from-scratch or the shape-my-intent capability).

vi.mock("@/lib/api/extensionGuard", () => ({ guardExtensionRequest: vi.fn() }));
vi.mock("@/lib/coach/extension/repName", () => ({ resolveRepName: vi.fn(async () => "John") }));
vi.mock("@/lib/coach/extension/salesCopilot", () => ({
  generateSalesCopilotReply: vi.fn(async () => ({ reply: "copilot reply", reasoning: "move-c" })),
}));
vi.mock("@/lib/coach/extension/salesFormulate", () => ({
  generateSalesFormulate: vi.fn(async () => ({ reply: "formulate reply", reasoning: "move-f" })),
}));

import { POST } from "../route";
import { guardExtensionRequest } from "@/lib/api/extensionGuard";
import { generateSalesCopilotReply } from "@/lib/coach/extension/salesCopilot";
import { generateSalesFormulate } from "@/lib/coach/extension/salesFormulate";

type Body = { conversation: string; guidance?: string; lastSpeaker?: string };
function guardOk(body: Body) {
  vi.mocked(guardExtensionRequest).mockResolvedValue({
    ok: true,
    user: { userId: "u1", companyId: "c1", entitlement: {} },
    body,
  } as never);
}
const req = () => ({}) as never; // guard is mocked, so the request object itself is never read

beforeEach(() => vi.clearAllMocks());

describe("POST /api/coach/extension/suggest — merged-action engine dispatch", () => {
  it("no guidance → drafts via the co-pilot engine (not formulate)", async () => {
    guardOk({ conversation: "prospect: what's pricing?" });
    const res = await POST(req());
    expect(generateSalesCopilotReply).toHaveBeenCalledOnce();
    expect(generateSalesFormulate).not.toHaveBeenCalled();
    expect((await res.json()).reply).toBe("copilot reply");
  });

  it("with guidance → shapes via the formulate engine (not copilot), passing guidance as intent", async () => {
    guardOk({ conversation: "prospect: what's pricing?", guidance: "acknowledge price, hold the value" });
    const res = await POST(req());
    expect(generateSalesFormulate).toHaveBeenCalledOnce();
    expect(vi.mocked(generateSalesFormulate).mock.calls[0]?.[0]?.intent).toBe("acknowledge price, hold the value");
    expect(generateSalesCopilotReply).not.toHaveBeenCalled();
    expect((await res.json()).reply).toBe("formulate reply");
  });

  it("blank/whitespace guidance → treated as none (co-pilot path)", async () => {
    guardOk({ conversation: "hi", guidance: "   " });
    await POST(req());
    expect(generateSalesCopilotReply).toHaveBeenCalledOnce();
    expect(generateSalesFormulate).not.toHaveBeenCalled();
  });

  it("returns the guard's error response verbatim when the gate fails", async () => {
    const denied = { ok: false, response: { status: 402 } };
    vi.mocked(guardExtensionRequest).mockResolvedValue(denied as never);
    const res = (await POST(req())) as unknown as { status: number };
    expect(res.status).toBe(402);
    expect(generateSalesCopilotReply).not.toHaveBeenCalled();
    expect(generateSalesFormulate).not.toHaveBeenCalled();
  });
});
