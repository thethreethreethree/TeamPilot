import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Locks the guards on the widget load-events endpoint. It exposes security telemetry (who tried to use
 * this tenant's embed token from a wrong origin), so it must be (1) admin-only — a non-admin agent must
 * NOT see it — and (2) tenant-scoped: fetchWidgetLoadEvents is called with the AUTHENTICATED companyId,
 * never a client value, so no cross-tenant telemetry leaks. Both are fail-closed (no data read until the
 * guards pass).
 */
vi.mock("@/lib/api/careAgentAuth", () => ({ requireCareAgent: vi.fn() }));
vi.mock("@/lib/data/careWidgetEvents", () => ({ fetchWidgetLoadEvents: vi.fn() }));

import { GET } from "@/app/api/care/settings/widget/load-events/route";
import { requireCareAgent } from "@/lib/api/careAgentAuth";
import { fetchWidgetLoadEvents } from "@/lib/data/careWidgetEvents";

beforeEach(() => vi.clearAllMocks());

describe("GET /api/care/settings/widget/load-events — guards", () => {
  it("passes auth failures through without reading telemetry", async () => {
    vi.mocked(requireCareAgent).mockResolvedValue({ ok: false, error: "no", status: 401 } as never);
    const res = await GET();
    expect(res.status).toBe(401);
    expect(fetchWidgetLoadEvents).not.toHaveBeenCalled();
  });

  it("403 when the agent has no company", async () => {
    vi.mocked(requireCareAgent).mockResolvedValue({ ok: true, companyId: null, isAdmin: true } as never);
    const res = await GET();
    expect(res.status).toBe(403);
    expect(fetchWidgetLoadEvents).not.toHaveBeenCalled();
  });

  it("403 for a non-admin agent — security telemetry is admin-only", async () => {
    vi.mocked(requireCareAgent).mockResolvedValue({
      ok: true,
      companyId: "c1",
      isAdmin: false,
    } as never);
    const res = await GET();
    expect(res.status).toBe(403);
    expect(fetchWidgetLoadEvents).not.toHaveBeenCalled();
  });

  it("returns the summary scoped to the admin's OWN company", async () => {
    vi.mocked(requireCareAgent).mockResolvedValue({
      ok: true,
      companyId: "company-A",
      isAdmin: true,
    } as never);
    vi.mocked(fetchWidgetLoadEvents).mockResolvedValue({
      events: [],
      total: 0,
      okCount: 0,
      rejectedCount: 0,
      rejectedOrigins: [],
    } as never);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(fetchWidgetLoadEvents).toHaveBeenCalledWith("company-A");
  });
});
