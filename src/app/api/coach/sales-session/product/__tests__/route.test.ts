import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * /api/coach/sales-session/product — the company's editable PRODUCT / brand details (the coach's product
 * source). Previously untested. Same load-bearing boundary as the methodology corpus: the WRITE is
 * manager-gated — a rep must not be able to overwrite what the whole team's coach reasons about the product
 * from. Also pins that a manager save appends under the 'product' kind (not the methodology kind).
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }) })) }));
vi.mock("@/lib/data/salesCoach", () => ({
  getCurrentSalesCorpus: vi.fn(async () => null),
  appendSalesCorpusVersion: vi.fn(async () => true),
}));

import { createClient } from "@/lib/supabase/server";
import { appendSalesCorpusVersion } from "@/lib/data/salesCoach";
import { POST } from "../route";

const setCaller = (userId: string | null, profile: unknown) =>
  (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null } }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: profile }) }) }) }),
  });

const MANAGER = { role: "admin", company_id: "co1", sales_coach_role: null };
const REP = { role: "member", company_id: "co1", sales_coach_role: null };
const postReq = (body: unknown) => ({ json: async () => body }) as unknown as Parameters<typeof POST>[0];

beforeEach(() => vi.clearAllMocks());

describe("POST /product — manager-gated write", () => {
  it("403 for a rep, and product details are NEVER written", async () => {
    setCaller("u1", REP);
    const res = await POST(postReq({ content: "fake product spec" }));
    expect(res.status).toBe(403);
    expect(appendSalesCorpusVersion).not.toHaveBeenCalled();
  });

  it("400 on an empty body before the store is touched", async () => {
    setCaller("boss", MANAGER);
    expect((await POST(postReq({ content: "   " }))).status).toBe(400);
    expect(appendSalesCorpusVersion).not.toHaveBeenCalled();
  });

  it("200 for a manager, appending under the 'product' kind", async () => {
    setCaller("boss", MANAGER);
    const res = await POST(postReq({ content: "SolarPro X — $99/mo, 25-yr warranty" }));
    expect(res.status).toBe(200);
    expect(appendSalesCorpusVersion).toHaveBeenCalledOnce();
    expect(appendSalesCorpusVersion).toHaveBeenCalledWith(expect.objectContaining({ kind: "product" }));
  });
});
