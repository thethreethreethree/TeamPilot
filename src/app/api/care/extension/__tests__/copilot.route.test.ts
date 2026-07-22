import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

/**
 * Co-Pilot extension route: same gate-ordering security property as summarize (no paid LLM before auth +
 * entitlement) PLUS the reasoning split — the customer-facing draft must be separated from the internal "move"
 * reasoning on the ===REASONING=== marker, so the reasoning never leaks into the reply the customer sees.
 */

vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: vi.fn(() => null) }));
vi.mock("@/lib/api/validate", () => ({ readBody: vi.fn(async () => ({ conversation: "a customer thread" })) }));
vi.mock("@/lib/api/extensionAuth", () => ({ requireEntitledExtensionUser: vi.fn() }));
vi.mock("@/lib/care/config", () => ({ getProductContextForTenant: vi.fn(async () => "PRODUCT CONTEXT") }));
vi.mock("@/lib/claude", () => ({ generateCareReply: vi.fn() }));

import { POST } from "@/app/api/care/extension/copilot/route";
import { rateLimit } from "@/lib/api/rateLimit";
import { requireEntitledExtensionUser } from "@/lib/api/extensionAuth";
import { generateCareReply } from "@/lib/claude";

const entitled = { ok: true, user: { userId: "u", companyId: "c" } };
const req = {} as never;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(rateLimit).mockReturnValue(null);
});

describe("POST /api/care/extension/copilot", () => {
  it("pre-auth rate limit short-circuits before the gate + LLM", async () => {
    vi.mocked(rateLimit).mockReturnValueOnce(NextResponse.json({ error: "slow" }, { status: 429 }));
    const res = await POST(req);
    expect(res.status).toBe(429);
    expect(requireEntitledExtensionUser).not.toHaveBeenCalled();
    expect(generateCareReply).not.toHaveBeenCalled();
  });

  it("unentitled tenant (402) is turned away BEFORE the LLM runs", async () => {
    vi.mocked(requireEntitledExtensionUser).mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "locked" }, { status: 402 }),
    } as never);
    const res = await POST(req);
    expect(res.status).toBe(402);
    expect(generateCareReply).not.toHaveBeenCalled();
  });

  it("splits the reply from the reasoning on the marker (reasoning never contaminates the customer draft)", async () => {
    vi.mocked(requireEntitledExtensionUser).mockResolvedValue(entitled as never);
    vi.mocked(generateCareReply).mockResolvedValue({
      text: "Hi Sam — your refund is approved and lands in 5 days.\n===REASONING===\nLed with the concrete answer (Made to Stick).",
    } as never);
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.reply).toBe("Hi Sam — your refund is approved and lands in 5 days.");
    expect(body.reasoning).toBe("Led with the concrete answer (Made to Stick).");
    expect(body.reply).not.toContain("REASONING");
  });

  it("no marker → whole text is the reply, reasoning empty", async () => {
    vi.mocked(requireEntitledExtensionUser).mockResolvedValue(entitled as never);
    vi.mocked(generateCareReply).mockResolvedValue({ text: "Just a plain draft." } as never);
    const body = await (await POST(req)).json();
    expect(body.reply).toBe("Just a plain draft.");
    expect(body.reasoning).toBe("");
  });

  it("empty draft (marker emitted first) → 502, not an empty reply the panel renders as JSON", async () => {
    vi.mocked(requireEntitledExtensionUser).mockResolvedValue(entitled as never);
    vi.mocked(generateCareReply).mockResolvedValue({ text: "===REASONING===\njust reasoning, no draft" } as never);
    const res = await POST(req);
    expect(res.status).toBe(502);
  });

  it("LLM throw → 502, no crash", async () => {
    vi.mocked(requireEntitledExtensionUser).mockResolvedValue(entitled as never);
    vi.mocked(generateCareReply).mockRejectedValue(new Error("upstream"));
    const res = await POST(req);
    expect(res.status).toBe(502);
  });
});
