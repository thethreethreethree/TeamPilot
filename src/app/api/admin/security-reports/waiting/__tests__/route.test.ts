import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

/** The founders' waiting count: reports with no status event; founders only; a failed read is a 500, not zero. */
vi.mock("@/lib/crm/vendorAuth", () => ({ requireVendorAdmin: vi.fn() }));
type Res = { data: unknown; error: unknown };
const st = vi.hoisted(() => ({ reads: {} as Record<string, Res> }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (t: string) => {
      const b: Record<string, unknown> = {};
      for (const m of ["select", "order"]) b[m] = () => b;
      b.range = async (from: number) => (from === 0 ? st.reads[t] : { data: [], error: null });
      return b;
    },
  }),
}));

import { requireVendorAdmin } from "@/lib/crm/vendorAuth";
import { GET } from "../route";

beforeEach(() => {
  vi.mocked(requireVendorAdmin).mockResolvedValue({ userId: "f1", companyId: "vendor" } as never);
  st.reads = {
    security_reports: { data: [{ id: "r1" }, { id: "r2" }, { id: "r3" }], error: null },
    security_report_events: { data: [{ report_id: "r2" }, { report_id: "r2" }], error: null },
  };
});

describe("security reports waiting count", () => {
  it("counts reports with no response recorded", async () => {
    expect(await (await GET()).json()).toEqual({ waiting: 2 });
  });
  it("founders only", async () => {
    vi.mocked(requireVendorAdmin).mockResolvedValue(NextResponse.json({ error: "no" }, { status: 403 }));
    expect((await GET()).status).toBe(403);
  });
  it("a failed read is a 500, not zero", async () => {
    st.reads.security_report_events = { data: null, error: { code: "XX000", message: "x" } };
    expect((await GET()).status).toBe(500);
  });
});
