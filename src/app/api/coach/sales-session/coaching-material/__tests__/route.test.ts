import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * POST /api/coach/sales-session/coaching-material — accepts the web cookie OR a mobile Bearer token (resolveApiAuth),
 * the last of the 26 coach routes reachable by the native app. Locks: 401 unauth, 403 with no company, and that the
 * resolved companyId + the rep's focus flow through to the corpus + the generator. The LLM + corpus are faked.
 */
vi.mock("@/lib/api/resolveApiAuth", () => ({ resolveApiAuth: vi.fn() }));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/data/salesCoach", () => ({ getCurrentSalesCorpus: vi.fn(async () => ({ content: "OUR METHODOLOGY: knock, listen, close." })) }));
vi.mock("@/lib/claude", () => ({ dissectCoachV5: vi.fn(async () => ({ text: '{"title":"x","steps":[]}' })) }));
vi.mock("@/lib/coach/v5/coachingMaterial", () => ({
  buildMaterialSystemPrompt: (c?: string) => `SYS ${c ?? ""}`,
  buildMaterialUserMessage: (f: string) => `FOCUS: ${f}`,
  parseCoachingMaterial: (t: string) => ({ raw: t }),
}));

import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { getCurrentSalesCorpus } from "@/lib/data/salesCoach";
import { dissectCoachV5 } from "@/lib/claude";
import { POST } from "../route";

const mock = (fn: unknown) => fn as unknown as ReturnType<typeof vi.fn>;
const req = (focus = "Opening at the door") =>
  new Request("http://localhost/api/coach/sales-session/coaching-material", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ focus }),
  }) as never;

beforeEach(() => vi.clearAllMocks());

describe("coaching-material route (Bearer-enabled)", () => {
  it("401 when neither cookie nor Bearer authenticates", async () => {
    mock(resolveApiAuth).mockResolvedValue(null);
    expect((await POST(req())).status).toBe(401);
    expect(getCurrentSalesCorpus).not.toHaveBeenCalled();
  });

  it("403 when the caller has no company context", async () => {
    mock(resolveApiAuth).mockResolvedValue({ userId: "u1", companyId: null, role: "rep", isAdmin: false });
    expect((await POST(req())).status).toBe(403);
  });

  it("uses the resolved companyId for the corpus and passes the focus to the generator", async () => {
    mock(resolveApiAuth).mockResolvedValue({ userId: "u1", companyId: "company-A", role: "rep", isAdmin: false });
    const res = await POST(req("handling the price objection"));
    expect(res.status).toBe(200);
    expect(getCurrentSalesCorpus).toHaveBeenCalledWith("company-A");
    expect(dissectCoachV5).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: "company-A", userMessage: expect.stringContaining("handling the price objection") }),
    );
    await expect(res.json()).resolves.toHaveProperty("material");
  });
});
