import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api/constantTime", () => ({ constantTimeEqual: (a: string, b: string) => a === b }));
const selectChain = { eq: () => selectChain, lt: () => selectChain, order: () => selectChain, limit: vi.fn() };
const updateChain = { in: () => updateChain, eq: () => updateChain, select: vi.fn() };
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: () => ({ select: () => selectChain, update: () => updateChain }) }),
}));

import { GET } from "../route";
const req = (auth?: string) => ({ headers: { get: (k: string) => (k === "authorization" ? auth ?? null : null) } }) as unknown as Parameters<typeof GET>[0];

beforeEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); });

describe("GET /api/coach/sales-session/auto-close-stale-cron", () => {
  it("503 when CRON_SECRET is unset", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await GET(req("Bearer x"))).status).toBe(503);
  });
  it("401 on a wrong/absent Bearer", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    expect((await GET(req("Bearer nope"))).status).toBe(401);
    expect((await GET(req(undefined))).status).toBe(401);
  });
  it("closes stale active sessions and reports the count (+ bounded flag)", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    selectChain.limit.mockResolvedValue({ data: [{ id: "a" }, { id: "b" }], error: null });
    updateChain.select.mockResolvedValue({ data: [{ id: "a" }, { id: "b" }], error: null });
    const res = await GET(req("Bearer s3cret"));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.closed).toBe(2);
    expect(j.bounded).toBe(false);
  });
  it("no stale sessions → closes 0 without an update call", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    selectChain.limit.mockResolvedValue({ data: [], error: null });
    const j = await (await GET(req("Bearer s3cret"))).json();
    expect(j.closed).toBe(0);
    expect(updateChain.select).not.toHaveBeenCalled();
  });
});
