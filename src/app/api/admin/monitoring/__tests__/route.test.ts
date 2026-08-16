import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

/**
 * Founder-monitoring routes (0214 exemption) — the gate + allowlist + audit contract.
 *
 * These are the security-critical behaviours of a SANCTIONED cross-tenant capability, so
 * they are pinned explicitly: (1) a non-vendor caller is refused by requireVendorAdmin;
 * (2) a company/session that is NOT on the allowlist is 404 (no probing non-scoped tenants);
 * (3) every successful read writes an audit row. The data layer is mocked — the allowlist
 * enforcement itself lives in and is exercised via isCompanyMonitorable / getMonitoredSession.
 */
vi.mock("@/lib/crm/vendorAuth", () => ({ requireVendorAdmin: vi.fn() }));
vi.mock("@/lib/monitoring/vendorMonitoring", () => ({
  listMonitorableCompanies: vi.fn(async () => [
    { id: "co1", name: "Caliber", addedAt: "2026-08-16T00:00:00Z" },
  ]),
  isCompanyMonitorable: vi.fn(),
  listCompanySessions: vi.fn(async () => [{ id: "s1", agentName: "Rep One" }]),
  getMonitoredSession: vi.fn(),
  logMonitoringAccess: vi.fn(async () => true),
}));

import { requireVendorAdmin } from "@/lib/crm/vendorAuth";
import {
  isCompanyMonitorable,
  getMonitoredSession,
  logMonitoringAccess,
} from "@/lib/monitoring/vendorMonitoring";
const mockLog = logMonitoringAccess as unknown as ReturnType<typeof vi.fn>;
import { GET as getCompanies } from "../companies/route";
import { GET as getSessions } from "../sessions/route";
import { GET as getSession } from "../session/[id]/route";

const asVendor = () =>
  (requireVendorAdmin as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    userId: "founder-john",
  });
const asIntruder = () =>
  (requireVendorAdmin as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
    NextResponse.json({ error: "CRM is vendor-side back-office only." }, { status: 403 })
  );

const sessionsReq = (companyId: string | null) =>
  ({ nextUrl: { searchParams: { get: () => companyId } } }) as unknown as Parameters<
    typeof getSessions
  >[0];
const sessionCtx = (id: string) =>
  ({ params: Promise.resolve({ id }) }) as unknown as Parameters<typeof getSession>[1];

beforeEach(() => vi.clearAllMocks());

describe("GET /admin/monitoring/companies", () => {
  it("403 for a non-vendor caller (requireVendorAdmin refuses)", async () => {
    asIntruder();
    expect((await getCompanies()).status).toBe(403);
    expect(logMonitoringAccess).not.toHaveBeenCalled();
  });

  it("200 + audit for a vendor super-admin", async () => {
    asVendor();
    const res = await getCompanies();
    expect(res.status).toBe(200);
    expect((await res.json()).companies).toHaveLength(1);
    expect(logMonitoringAccess).toHaveBeenCalledWith({
      actor: "founder-john",
      resource: "companies_list",
    });
  });
});

describe("GET /admin/monitoring/sessions", () => {
  it("403 for a non-vendor caller", async () => {
    asIntruder();
    expect((await getSessions(sessionsReq("co1"))).status).toBe(403);
  });

  it("400 when companyId is missing", async () => {
    asVendor();
    expect((await getSessions(sessionsReq(null))).status).toBe(400);
  });

  it("404 for a company NOT on the allowlist (no probing non-scoped tenants)", async () => {
    asVendor();
    (isCompanyMonitorable as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(false);
    const res = await getSessions(sessionsReq("not-scoped"));
    expect(res.status).toBe(404);
    expect(logMonitoringAccess).not.toHaveBeenCalled();
  });

  it("200 + audit for a monitorable company", async () => {
    asVendor();
    (isCompanyMonitorable as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    const res = await getSessions(sessionsReq("co1"));
    expect(res.status).toBe(200);
    expect(logMonitoringAccess).toHaveBeenCalledWith({
      actor: "founder-john",
      companyId: "co1",
      resource: "sessions_list",
    });
  });
});

describe("GET /admin/monitoring/session/[id]", () => {
  it("403 for a non-vendor caller", async () => {
    asIntruder();
    expect((await getSession({} as never, sessionCtx("s1"))).status).toBe(403);
  });

  it("404 when the session is not monitorable/missing", async () => {
    asVendor();
    (getMonitoredSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const res = await getSession({} as never, sessionCtx("s1"));
    expect(res.status).toBe(404);
    expect(logMonitoringAccess).not.toHaveBeenCalled();
  });

  it("200 + audit (actor/company/session) for a monitorable session", async () => {
    asVendor();
    (getMonitoredSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      company_id: "co1",
      session: { id: "s1", agentName: "Rep One" },
      segments: [{ speaker: "agent", text: "hi", seq: 0 }],
    });
    const res = await getSession({} as never, sessionCtx("s1"));
    expect(res.status).toBe(200);
    expect(logMonitoringAccess).toHaveBeenCalledWith({
      actor: "founder-john",
      companyId: "co1",
      sessionId: "s1",
      resource: "session_detail",
    });
  });

  it("503 (fail loud) when the audit write does not land — transcript NOT served", async () => {
    asVendor();
    (getMonitoredSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      company_id: "co1",
      session: { id: "s1", agentName: "Rep One" },
      segments: [{ speaker: "agent", text: "hi", seq: 0 }],
    });
    mockLog.mockResolvedValueOnce(false); // audit failed
    const res = await getSession({} as never, sessionCtx("s1"));
    expect(res.status).toBe(503);
    // The sensitive transcript must not be disclosed on an unaudited read.
    expect(await res.json()).not.toHaveProperty("segments");
  });
});
