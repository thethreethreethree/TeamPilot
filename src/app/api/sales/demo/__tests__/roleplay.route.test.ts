import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

/**
 * Public sales-coach roleplay endpoint. Like the Jeff demo: rate-limited, and never 500s in the prospect's
 * face. Plus a route-specific safety property (audit F2): if the model's reply doesn't parse as clean JSON, the
 * route keeps only the prospect line and BLANKS the cue — so coach guidance can never leak into the prospect's
 * mouth. Untested until now (parseRoleplayReply itself is unit-tested in the lib; this covers the wiring).
 */

vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: vi.fn(() => null) }));
vi.mock("@/lib/api/validate", () => ({ readBody: vi.fn(async () => ({ message: "great to meet you", history: [] })) }));
vi.mock("@/lib/claude", () => ({ generateCareReply: vi.fn(async () => ({ text: "raw model text" })) }));
vi.mock("@/lib/sales/parseRoleplayReply", () => ({
  parseRoleplayReply: vi.fn(),
  prospectOnlyFallback: vi.fn(() => "just the prospect line"),
}));

import { POST } from "@/app/api/sales/demo/roleplay/route";
import { rateLimit } from "@/lib/api/rateLimit";
import { generateCareReply } from "@/lib/claude";
import { parseRoleplayReply } from "@/lib/sales/parseRoleplayReply";

const req = {} as never;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(rateLimit).mockReturnValue(null);
  vi.mocked(generateCareReply).mockResolvedValue({ text: "raw model text" } as never);
});

describe("POST /api/sales/demo/roleplay", () => {
  it("rate limit turns abusers away before the LLM", async () => {
    vi.mocked(rateLimit).mockReturnValueOnce(NextResponse.json({ error: "slow" }, { status: 429 }));
    const res = await POST(req);
    expect(res.status).toBe(429);
    expect(generateCareReply).not.toHaveBeenCalled();
  });

  it("clean parse → returns the prospect reply + coach cue", async () => {
    vi.mocked(parseRoleplayReply).mockReturnValue({ prospect: "Tell me more.", cue: "Good open-ended question." });
    const body = await (await POST(req)).json();
    expect(body).toEqual({ prospect: "Tell me more.", cue: "Good open-ended question." });
  });

  it("unparseable model reply → prospect-only, cue BLANKED (coaching can't leak — F2)", async () => {
    vi.mocked(parseRoleplayReply).mockReturnValue(null);
    const body = await (await POST(req)).json();
    expect(body.prospect).toBe("just the prospect line");
    expect(body.cue).toBe("");
  });

  it("engine failure → soft-fails (200, NOT 500) with a warm prospect line", async () => {
    vi.mocked(generateCareReply).mockRejectedValue(new Error("llm down"));
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.prospect).toBeTruthy();
    expect(body.cue).toBeTruthy();
  });
});
