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
// Stream path: yield marker-format deltas so the SSE branch is exercised without a live model.
vi.mock("@/lib/llm", () => ({
  // eslint-disable-next-line require-yield
  llmStream: vi.fn(async function* () {
    yield "Hi Sam, ";
    yield "your refund is approved.";
    yield "\n===REASONING===\nLed with the concrete answer.";
  }),
}));
// Default: the name lookup yields nothing → the route falls back to the generic label (this matches the
// prior behaviour, where createAdminClient wasn't mocked at all and threw → caught → generic). Individual
// tests override to return a real name.
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }),
  })),
}));

import { POST } from "@/app/api/care/extension/copilot/route";
import { rateLimit } from "@/lib/api/rateLimit";
import { readBody } from "@/lib/api/validate";
import { requireEntitledExtensionUser } from "@/lib/api/extensionAuth";
import { generateCareReply } from "@/lib/claude";
import { createAdminClient } from "@/lib/supabase/admin";

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

  it("stream:true → text/event-stream with content deltas + a done event carrying the marker-split reply", async () => {
    // Mirrors the Sales Coach fix (2026-08-09): the reply forms word-by-word. C.A.R.E's output is UNCHANGED —
    // no sanitizer/voice change — only the delivery. The non-stream engine is NOT called on the stream path.
    vi.mocked(requireEntitledExtensionUser).mockResolvedValue(entitled as never);
    vi.mocked(readBody).mockResolvedValueOnce({ conversation: "a customer thread", stream: true } as never);
    const res = (await POST(req)) as unknown as Response;
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
    const text = await res.text();
    expect(text).toContain("event: delta");
    expect(text).toContain("Hi Sam, ");
    const doneLine = text.split("\n").find((l) => l.startsWith("data:") && l.includes('"reply"'));
    const done = JSON.parse(doneLine!.slice(5));
    expect(done.reply).toBe("Hi Sam, your refund is approved.");
    expect(done.reasoning).toBe("Led with the concrete answer.");
    expect(generateCareReply).not.toHaveBeenCalled();
  });

  // Role-attribution anchor (Fix 2b, the founder-reported "Hi John" inversion). Co-Pilot was the ONLY one of
  // the 6 write/read-as-agent tools whose WHO-IS-WHO anchor had no test — and its anchor wording is duplicated
  // across routes, so it's drift-prone (the same class of copy-paste divergence that shipped the email
  // recentTurns:[] bug). These lock (a) the name is injected AS the drafting identity and (b) the graceful
  // fallback still carries the anchor — so a future edit can't silently drop either.
  it("injects the agent-name anchor — the draft is written AS the agent, never addressed TO them ('Hi John' bug)", async () => {
    vi.mocked(requireEntitledExtensionUser).mockResolvedValue(entitled as never);
    vi.mocked(createAdminClient).mockReturnValueOnce({
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { full_name: "John Ramos" } }) }) }),
      }),
    } as never);
    vi.mocked(generateCareReply).mockResolvedValue({ text: "Hi Sam — all set." } as never);
    await POST(req);
    const arg = vi.mocked(generateCareReply).mock.calls[0]![0] as { systemPrompt: string; userMessage: string };
    expect(arg.systemPrompt).toContain("drafting AS: John Ramos");
    expect(arg.systemPrompt).toContain("agent's own words");
    // The exact anti-inversion property: the draft is FROM the agent's side, not a message TO the agent.
    expect(arg.systemPrompt).toContain("never addressed to John Ramos");
    expect(arg.userMessage).toContain("Draft John Ramos's next message");
  });

  it("name lookup yields nothing → generic label, but the anchor is STILL present (never blocks the draft)", async () => {
    vi.mocked(requireEntitledExtensionUser).mockResolvedValue(entitled as never);
    // default admin mock returns { data: null } → fallback to "the support agent"
    vi.mocked(generateCareReply).mockResolvedValue({ text: "Hi Sam — all set." } as never);
    await POST(req);
    const arg = vi.mocked(generateCareReply).mock.calls[0]![0] as { systemPrompt: string };
    expect(arg.systemPrompt).toContain("drafting AS: the support agent");
    expect(arg.systemPrompt).toContain("agent's own words");
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
