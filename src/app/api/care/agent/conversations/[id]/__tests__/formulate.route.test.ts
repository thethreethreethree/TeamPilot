import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * POST /api/care/agent/conversations/[id]/formulate — previously UNTESTED. Two things worth locking:
 *   1. The month-1 CONTROL-WINDOW suppression (honesty thesis): when generateCareReply returns
 *      { suppressed }, the route must NOT fabricate a draft — it returns 200 { suppressed: true } so the
 *      team's un-guided baseline is captured. A regression here would silently break "month-1 = no AI guidance."
 *   2. The coerceJsonText fix (1e854724): generateCareReply is expectJson:false, so a fenced/prose reply must
 *      still be extracted into { draft, reasoning } rather than 502'ing.
 * Plus the auth + tenant-scope + parse-failure gates. generateCareReply is mocked; coerceJsonText is REAL.
 */
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: vi.fn(() => null) }));
vi.mock("@/lib/api/careAgentAuth", () => ({ requireCareAgent: vi.fn() }));
vi.mock("@/lib/api/validate", () => ({
  readBody: vi.fn(async () => ({ intent: "tell them the refund is approved" })),
}));
vi.mock("@/lib/data/care", () => ({ fetchAgentConversation: vi.fn() }));
vi.mock("@/lib/care/config", () => ({ getProductContextForTenant: vi.fn(async () => "PRODUCT CONTEXT") }));
vi.mock("@/lib/claude", () => ({ generateCareReply: vi.fn() }));

import { POST } from "@/app/api/care/agent/conversations/[id]/formulate/route";
import { requireCareAgent } from "@/lib/api/careAgentAuth";
import { fetchAgentConversation } from "@/lib/data/care";
import { generateCareReply } from "@/lib/claude";

const ctx = { params: Promise.resolve({ id: "conv-1" }) };
const req = {} as never;
const okAuth = { ok: true, companyId: "c1" };
const okConv = { conversation: { companyId: "c1" }, messages: [] };

const setAuth = (a: unknown) => vi.mocked(requireCareAgent).mockResolvedValue(a as never);
const setConv = (c: unknown) => vi.mocked(fetchAgentConversation).mockResolvedValue(c as never);
const setReply = (r: unknown) => vi.mocked(generateCareReply).mockResolvedValue(r as never);

beforeEach(() => vi.clearAllMocks());

describe("POST /api/care/agent/conversations/[id]/formulate", () => {
  it("401/403s when the caller is not a care agent (before any LLM)", async () => {
    setAuth({ ok: false, error: "not an agent", status: 403 });
    const res = await POST(req, ctx);
    expect(res.status).toBe(403);
    expect(generateCareReply).not.toHaveBeenCalled();
  });

  it("404s a conversation in ANOTHER company (tenant scope)", async () => {
    setAuth(okAuth);
    setConv({ conversation: { companyId: "OTHER" }, messages: [] });
    expect((await POST(req, ctx)).status).toBe(404);
    expect(generateCareReply).not.toHaveBeenCalled();
  });

  it("month-1 control window: suppressed reply is NOT drafted — returns 200 { suppressed } (honesty thesis)", async () => {
    setAuth(okAuth);
    setConv(okConv);
    setReply({ suppressed: true, reason: "control_window" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.suppressed).toBe(true);
    expect(body.draft).toBeUndefined(); // it must NOT fabricate a draft during the baseline
  });

  it("extracts { draft, reasoning } from a ```json-FENCED reply (coerceJsonText — not a 502)", async () => {
    setAuth(okAuth);
    setConv(okConv);
    setReply({ text: '```json\n{"draft":"Your refund is approved.","reasoning":"Led with the outcome."}\n```' });
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.draft).toBe("Your refund is approved.");
    expect(body.reasoning).toBe("Led with the outcome.");
  });

  it("parses clean strict JSON too (behavior-preserving on the happy path)", async () => {
    setAuth(okAuth);
    setConv(okConv);
    setReply({ text: JSON.stringify({ draft: "On its way.", reasoning: "Reassure." }) });
    const body = await (await POST(req, ctx)).json();
    expect(body.draft).toBe("On its way.");
  });

  it("502s when the reply has no parseable JSON at all", async () => {
    setAuth(okAuth);
    setConv(okConv);
    setReply({ text: "I'm not sure what you want me to draft." });
    expect((await POST(req, ctx)).status).toBe(502);
  });
});
