import { describe, it, expect, vi, beforeEach } from "vitest";

// The merged "Suggested Response" route is a dispatcher: no guidance → co-pilot engine; guidance → formulate
// engine (guidance used as the intent). This locks that branch so a refactor can't silently send everything to
// one engine (which would drop either the draft-from-scratch or the shape-my-intent capability).

vi.mock("@/lib/api/extensionGuard", () => ({ guardExtensionRequest: vi.fn() }));
vi.mock("@/lib/coach/extension/repName", () => ({ resolveRepName: vi.fn(async () => "John") }));
vi.mock("@/lib/coach/extension/salesCopilot", () => ({
  generateSalesCopilotReply: vi.fn(async () => ({ reply: "copilot reply", reasoning: "move-c" })),
  // The route also builds the request from this helper (shared by stream + non-stream). Dummy is fine — the
  // engine dispatch is what these tests assert; the stream tests below exercise the real streaming path.
  buildSalesCopilotRequest: vi.fn(() => ({ systemPrompt: "sys-c", userMessage: "usr-c" })),
}));
vi.mock("@/lib/coach/extension/salesFormulate", () => ({
  generateSalesFormulate: vi.fn(async () => ({ reply: "formulate reply", reasoning: "move-f" })),
  buildSalesFormulateRequest: vi.fn(() => ({ systemPrompt: "sys-f", userMessage: "usr-f" })),
}));
// Stream path: mirror the non-stream dispatch by yielding the marker-format output through the LLM stream so
// the route's SSE branch is exercised without a live model. runBrainStream (companyId path) is what the route
// uses when companyId is set.
vi.mock("@/lib/brain", () => ({
  // eslint-disable-next-line require-yield
  runBrainStream: vi.fn(async function* () {
    yield "Happy to help — ";
    yield "what's driving the timeline?";
    yield "\n===REASONING===\nasked a SPIN implication question";
  }),
}));
vi.mock("@/lib/llm", () => ({ llmStream: vi.fn(async function* () { yield ""; }) }));

import { POST } from "../route";
import { guardExtensionRequest } from "@/lib/api/extensionGuard";
import { generateSalesCopilotReply } from "@/lib/coach/extension/salesCopilot";
import { generateSalesFormulate } from "@/lib/coach/extension/salesFormulate";

type Body = { conversation: string; guidance?: string; lastSpeaker?: string; stream?: boolean };
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

describe("POST /api/coach/extension/suggest — streaming delivery (stream:true)", () => {
  it("streams content deltas as SSE and ends with a done event carrying the split reply + move", async () => {
    guardOk({ conversation: "prospect: we're evaluating a few tools", stream: true });
    const res = (await POST(req())) as unknown as Response;
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
    const text = await res.text();
    // The reply forms across delta events (before the marker), and the final done carries the clean split.
    expect(text).toContain("event: delta");
    expect(text).toContain("Happy to help — ");
    expect(text).toContain("event: done");
    const doneLine = text.split("\n").find((l) => l.startsWith("data:") && l.includes('"reply"'));
    const done = JSON.parse(doneLine!.slice(5));
    // The done event carries the FINALIZED reply: the em dash the mock streamed is sanitized to a comma
    // (founder's no-dash rule), so this also proves finalizeSuggestion runs on the stream path.
    expect(done.reply).toBe("Happy to help, what's driving the timeline?");
    expect(done.reasoning).toBe("asked a SPIN implication question");
    // The non-stream engines are NOT called on the stream path.
    expect(generateSalesCopilotReply).not.toHaveBeenCalled();
  });

  it("does not stream when stream is absent (JSON path still returns a reply)", async () => {
    guardOk({ conversation: "hi" });
    const res = await POST(req());
    expect((res as Response).headers.get("Content-Type")).not.toBe("text/event-stream");
    expect((await (res as Response).json()).reply).toBe("copilot reply");
  });
});
