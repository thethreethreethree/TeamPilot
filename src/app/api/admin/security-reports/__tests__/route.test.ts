import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/crm/vendorAuth", () => ({ requireVendorAdmin: vi.fn() }));
type Res = { data: unknown; error: unknown };
const st = vi.hoisted(() => ({ reads: {} as Record<string, Res>, inserted: [] as unknown[], insertErr: null as unknown }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (t: string) => {
      const b: Record<string, unknown> = {};
      for (const m of ["select", "order", "limit", "eq"]) b[m] = () => b;
      b.maybeSingle = async () => st.reads[t];
      b.then = (r: (v: unknown) => unknown) => r(st.reads[t]);
      b.insert = async (row: unknown) => (st.inserted.push(row), { error: st.insertErr });
      return b;
    },
  }),
}));

import { requireVendorAdmin } from "@/lib/crm/vendorAuth";
import { GET, PUT } from "../route";
const put = (body: unknown) => new Request("http://x/api", { method: "PUT", body: JSON.stringify(body) }) as never;

beforeEach(() => {
  vi.mocked(requireVendorAdmin).mockResolvedValue({ userId: "f1", companyId: "vendor" } as never);
  st.reads = {
    security_reports: { data: [{ id: "abcdef12-x", summary: "S", details: "D", affected: null, reporter_name: null, reporter_contact: null, received_at: "2026-11-23T00:00:00Z" }], error: null },
    security_report_events: { data: [], error: null },
  };
  st.inserted = [];
  st.insertErr = null;
});

describe("security reports inbox", () => {
  it("founders only", async () => {
    vi.mocked(requireVendorAdmin).mockResolvedValue(NextResponse.json({ error: "no" }, { status: 403 }));
    expect((await GET()).status).toBe(403);
    expect((await PUT(put({ reportId: "r", status: "fixed" }))).status).toBe(403);
  });
  it("lists reports, 'received' until someone acts", async () => {
    expect(await (await GET()).json()).toMatchObject({ reports: [{ reference: "ABCDEF12", status: "received" }] });
  });
  it("a failed read is a 500, not an empty inbox", async () => {
    st.reads.security_report_events = { data: null, error: { message: "x" } };
    expect((await GET()).status).toBe(500);
  });
  it("PUT appends a status event; refuses an unknown status or report", async () => {
    st.reads.security_reports = { data: { id: "r1" }, error: null };
    expect((await PUT(put({ reportId: "r1", status: "fixed", note: " patched " }))).status).toBe(200);
    expect(st.inserted[0]).toEqual({ report_id: "r1", status: "fixed", note: "patched", set_by: "f1" });
    expect((await PUT(put({ reportId: "r1", status: "deleted" }))).status).toBe(400);
    st.reads.security_reports = { data: null, error: null };
    expect((await PUT(put({ reportId: "r9", status: "fixed" }))).status).toBe(404);
  });
});
