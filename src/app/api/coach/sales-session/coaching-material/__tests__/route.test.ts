import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * POST /api/coach/sales-session/coaching-material — accepts the web cookie OR a mobile Bearer token (resolveApiAuth).
 * Locks: 401 unauth, 403 with no company, and that the resolved companyId + the rep's focus flow through to the
 * corpus + the generator. The LLM + corpus are faked.
 *
 * The 403 case is the one worth reading. It passed before while pinning behaviour no request could reach — see the
 * comment on that test.
 */
vi.mock("@/lib/api/resolveApiAuth", () => ({ resolveApiAuth: vi.fn(), resolveApiUserId: vi.fn() }));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/data/salesCoach", () => ({ getCurrentSalesCorpus: vi.fn(async () => ({ content: "OUR METHODOLOGY: knock, listen, close." })) }));
vi.mock("@/lib/claude", () => ({ dissectCoachV5: vi.fn(async () => ({ text: '{"title":"x","steps":[]}' })) }));
vi.mock("@/lib/coach/v5/coachingMaterial", () => ({
  buildMaterialSystemPrompt: (c?: string) => `SYS ${c ?? ""}`,
  buildMaterialUserMessage: (f: string) => `FOCUS: ${f}`,
  parseCoachingMaterial: (t: string) => ({ raw: t }),
}));

import { resolveApiAuth, resolveApiUserId } from "@/lib/api/resolveApiAuth";
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
    mock(resolveApiUserId).mockResolvedValue(null);
    expect((await POST(req())).status).toBe(401);
    expect(getCurrentSalesCorpus).not.toHaveBeenCalled();
  });

  it("403 — NOT 401 — when the caller is signed in but has no company", async () => {
    /**
     * THIS TEST USED TO PROVE NOTHING, and that is the finding rather than a footnote.
     *
     * It mocked `resolveApiAuth` returning `{ companyId: null }` — a value that function CANNOT produce. Both auth
     * paths refuse a company-less caller by returning null instead: resolveApiAuth's Bearer path does
     * `if (!profile || !profile.company_id …) return null`, and getCurrentAuthContext does
     * `if (!profile?.company_id) return null`.
     *
     * So the route's `if (!companyId) return 403` was unreachable, every company-less caller received
     * 401 "Not authenticated." — the one statement that is definitely untrue of them — and this test reported the
     * branch as covered while passing against behaviour no request could reach.
     *
     * Driven through the real shape now: resolveApiAuth refuses, and resolveApiUserId — identity only, no company
     * requirement — confirms somebody IS signed in. It fails against the previous code.
     */
    mock(resolveApiAuth).mockResolvedValue(null);
    mock(resolveApiUserId).mockResolvedValue("u-with-no-company");
    const res = await POST(req());
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: "No company context." });
    expect(getCurrentSalesCorpus).not.toHaveBeenCalled();
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
