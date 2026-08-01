import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * POST /api/brain/learn — triggers the per-company learning distillation cycle. A thin route
 * (auth + rate-limit, then delegate to runLearningCycle, which is tested at the lib level), but its
 * gate is worth locking: no company context -> 401 and the cycle is NOT run; and the route maps the
 * cycle's { ok } to 200/500 rather than always claiming success.
 */
vi.mock("@/lib/supabase/auth-helpers", () => ({ getCurrentCompanyId: vi.fn() }));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: vi.fn(() => null) }));
vi.mock("@/lib/brain/learn", () => ({ runLearningCycle: vi.fn() }));

import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { runLearningCycle } from "@/lib/brain/learn";
import { POST } from "../route";

const setCompany = (id: string | null) =>
  (getCurrentCompanyId as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(id);
const setCycle = (r: unknown) =>
  (runLearningCycle as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(r);
const req = {} as unknown as Parameters<typeof POST>[0];

beforeEach(() => vi.clearAllMocks());

describe("POST /api/brain/learn", () => {
  it("401 when there is no company context — the cycle is NOT run", async () => {
    setCompany(null);
    expect((await POST(req)).status).toBe(401);
    expect(runLearningCycle).not.toHaveBeenCalled();
  });

  it("200 when the learning cycle succeeds (runs it with the company id)", async () => {
    setCompany("co1");
    setCycle({ ok: true, patternsLearned: 3 });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(runLearningCycle).toHaveBeenCalledWith("co1");
  });

  it("500 when the cycle reports failure (result.ok=false) — no false success", async () => {
    setCompany("co1");
    setCycle({ ok: false, error: "distill failed" });
    expect((await POST(req)).status).toBe(500);
  });
});
