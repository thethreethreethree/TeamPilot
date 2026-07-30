import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * /api/coach/sales-session/corpus — the company's editable coaching METHODOLOGY. Previously untested.
 * Security boundary: BOTH read and write are manager-gated (company CEO/COO/admin OR sales_coach_role=admin) —
 * a rep must not be able to read, and above all not OVERWRITE, the methodology the whole team's reviews reason
 * from. isSalesCoachManager + the zod body are the real implementations; only supabase + the data layer are faked.
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }) })) }));
vi.mock("@/lib/data/salesCoach", () => ({
  getCurrentSalesCorpus: vi.fn(async () => null),
  appendSalesCorpusVersion: vi.fn(async () => true),
}));
vi.mock("@/lib/coach/v5/salesKnowledgeBase", () => ({ getSalesKnowledgeBase: vi.fn(() => "KB") }));

import { createClient } from "@/lib/supabase/server";
import { appendSalesCorpusVersion } from "@/lib/data/salesCoach";
import { GET, POST } from "../route";

const setCaller = (userId: string | null, profile: unknown) =>
  (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null } }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: profile }) }) }) }),
  });

const MANAGER = { role: "admin", company_id: "co1", sales_coach_role: null };
const REP = { role: "member", company_id: "co1", sales_coach_role: null };
const postReq = (body: unknown) => ({ json: async () => body }) as unknown as Parameters<typeof POST>[0];

beforeEach(() => vi.clearAllMocks());

describe("GET /corpus — manager-gated read", () => {
  it("401 unauthenticated", async () => {
    setCaller(null, null);
    expect((await GET()).status).toBe(401);
  });
  it("403 for a rep (non-manager) — the methodology is admin-managed", async () => {
    setCaller("u1", REP);
    expect((await GET()).status).toBe(403);
  });
  it("200 for a manager, reporting the effective source", async () => {
    setCaller("boss", MANAGER);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.effectiveSource).toBe("books"); // no custom corpus + KB present
    expect(body.isCustom).toBe(false);
  });
});

describe("POST /corpus — manager-gated write (the load-bearing boundary)", () => {
  it("403 for a rep, and the corpus is NEVER written", async () => {
    setCaller("u1", REP);
    const res = await POST(postReq({ content: "my sneaky methodology" }));
    expect(res.status).toBe(403);
    expect(appendSalesCorpusVersion).not.toHaveBeenCalled();
  });
  it("400 on an empty body (zod min length) before it can touch the store", async () => {
    setCaller("boss", MANAGER);
    expect((await POST(postReq({ content: "" }))).status).toBe(400);
    expect(appendSalesCorpusVersion).not.toHaveBeenCalled();
  });
  it("200 for a manager, appending a new version", async () => {
    setCaller("boss", MANAGER);
    const res = await POST(postReq({ content: "Our real methodology: discovery first." }));
    expect(res.status).toBe(200);
    expect(appendSalesCorpusVersion).toHaveBeenCalledOnce();
  });
});
