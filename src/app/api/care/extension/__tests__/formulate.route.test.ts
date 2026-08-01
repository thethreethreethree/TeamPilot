import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

/**
 * Formulate extension route: gate ordering + the JSON contract. The prompt asks for strict {reply, reasoning}
 * JSON; the route must parse it, and degrade gracefully (surface raw text as the reply) rather than erroring the
 * agent out when the model strays from JSON — an empty reply is the only genuine failure (502).
 */

vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: vi.fn(() => null) }));
vi.mock("@/lib/api/validate", () => ({
  readBody: vi.fn(async () => ({ conversation: "thread", intent: "tell them the refund is approved" })),
}));
vi.mock("@/lib/api/extensionAuth", () => ({ requireEntitledExtensionUser: vi.fn() }));
vi.mock("@/lib/care/config", () => ({ getProductContextForTenant: vi.fn(async () => "PRODUCT CONTEXT") }));
vi.mock("@/lib/claude", () => ({ generateCareReply: vi.fn() }));
// Agent-name lookup falls back to the generic label (deterministic + no network in test).
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => {
    throw new Error("no db in test");
  }),
}));

import { POST } from "@/app/api/care/extension/formulate/route";
import { rateLimit } from "@/lib/api/rateLimit";
import { requireEntitledExtensionUser } from "@/lib/api/extensionAuth";
import { generateCareReply } from "@/lib/claude";

const entitled = { ok: true, user: { userId: "u", companyId: "c" } };
const req = {} as never;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(rateLimit).mockReturnValue(null);
});

describe("POST /api/care/extension/formulate", () => {
  it("unentitled (402) turned away before the LLM", async () => {
    vi.mocked(requireEntitledExtensionUser).mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "locked" }, { status: 402 }),
    } as never);
    const res = await POST(req);
    expect(res.status).toBe(402);
    expect(generateCareReply).not.toHaveBeenCalled();
  });

  it("parses strict JSON into { reply, reasoning }", async () => {
    vi.mocked(requireEntitledExtensionUser).mockResolvedValue(entitled as never);
    vi.mocked(generateCareReply).mockResolvedValue({
      text: JSON.stringify({ reply: "Good news — your refund is approved.", reasoning: "Led with the outcome." }),
    } as never);
    const body = await (await POST(req)).json();
    expect(body.reply).toBe("Good news — your refund is approved.");
    expect(body.reasoning).toBe("Led with the outcome.");
  });

  it("extracts JSON from a ```json-FENCED reply (Anthropic-failover shape) instead of leaking the fence", async () => {
    // generateCareReply is expectJson:false, so the failover provider can return fenced JSON. Before the
    // coerceJsonText fix this failed JSON.parse and fell through to the raw-text branch, surfacing the literal
    // ```json markdown as the agent's draft. Now it must extract the clean {reply, reasoning}.
    vi.mocked(requireEntitledExtensionUser).mockResolvedValue(entitled as never);
    vi.mocked(generateCareReply).mockResolvedValue({
      text: '```json\n{"reply":"Refund approved.","reasoning":"Outcome first."}\n```',
    } as never);
    const body = await (await POST(req)).json();
    expect(body.reply).toBe("Refund approved."); // clean value, NOT the fenced string
    expect(body.reasoning).toBe("Outcome first.");
  });

  it("extracts JSON from a PROSE-wrapped reply (preamble before the object)", async () => {
    vi.mocked(requireEntitledExtensionUser).mockResolvedValue(entitled as never);
    vi.mocked(generateCareReply).mockResolvedValue({
      text: 'Sure — here is the reply:\n{"reply":"On its way.","reasoning":"Reassure."}',
    } as never);
    const body = await (await POST(req)).json();
    expect(body.reply).toBe("On its way.");
  });

  it("passes an agent-identity anchor to the model (role-attribution fix, founder 2026-07-24)", async () => {
    vi.mocked(requireEntitledExtensionUser).mockResolvedValue(entitled as never);
    vi.mocked(generateCareReply).mockResolvedValue({
      text: JSON.stringify({ reply: "ok", reasoning: "x" }),
    } as never);
    await POST(req);
    const arg = vi.mocked(generateCareReply).mock.calls[0]![0] as { systemPrompt: string };
    // The system prompt must anchor WHO the agent is so the model doesn't misattribute sender/receiver.
    expect(arg.systemPrompt).toContain("shaping the reply AS");
    expect(arg.systemPrompt).toContain("agent's own words");
  });

  it("non-JSON output degrades to raw text as the reply (does not error the agent out)", async () => {
    vi.mocked(requireEntitledExtensionUser).mockResolvedValue(entitled as never);
    vi.mocked(generateCareReply).mockResolvedValue({ text: "Your refund is approved." } as never);
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.reply).toBe("Your refund is approved.");
  });

  it("empty reply → 502 (the one genuine failure)", async () => {
    vi.mocked(requireEntitledExtensionUser).mockResolvedValue(entitled as never);
    vi.mocked(generateCareReply).mockResolvedValue({ text: JSON.stringify({ reply: "", reasoning: "x" }) } as never);
    const res = await POST(req);
    expect(res.status).toBe(502);
  });

  // A rate-limit LlmError maps to 429 (client backs off), matching spawn/coach;
  // a non-rate-limit LlmError is a 502.
  it("LlmError kind=rate_limit → 429; other kinds → 502", async () => {
    const { LlmError } = await import("@/lib/llm/errors");
    vi.mocked(requireEntitledExtensionUser).mockResolvedValue(entitled as never);

    vi.mocked(generateCareReply).mockRejectedValueOnce(
      new LlmError({ kind: "rate_limit", message: "slow down", provider: "anthropic" })
    );
    expect((await POST(req)).status).toBe(429);

    vi.mocked(generateCareReply).mockRejectedValueOnce(
      new LlmError({ kind: "server", message: "boom", provider: "anthropic" })
    );
    expect((await POST(req)).status).toBe(502);
  });
});
