import { describe, it, expect, vi, beforeEach } from "vitest";

/** /api/coach/remote/settings/vocabulary — company admins change it (append + audit); everyone reads (2026-11-23). */
const st = vi.hoisted(() => ({ ctx: null as unknown, inserts: [] as unknown[], insertError: null as null | { code?: string; message: string } }));

vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/resolveApiAuth", () => ({ resolveApiAuth: vi.fn(async () => st.ctx) }));
vi.mock("@/lib/audit/recordAudit", () => ({ recordAudit: vi.fn(async () => true) }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => {
      const q: Record<string, unknown> = {};
      for (const m of ["select", "eq", "order"]) q[m] = () => q;
      q.limit = async () => ({ data: [{ terms: ["AT&T Fiber"], created_at: "2026-11-22" }], error: null });
      q.insert = async (row: unknown) => (st.inserts.push(row), { error: st.insertError });
      return q;
    },
  }),
}));

import { recordAudit } from "@/lib/audit/recordAudit";
import { GET, PUT } from "../route";

const ADMIN = { userId: "u-ceo", companyId: "co1", isAdmin: true };
const put = (body: unknown) => PUT(new Request("http://x", { method: "PUT", body: JSON.stringify(body) }) as never);

beforeEach(() => {
  st.ctx = ADMIN;
  st.inserts = [];
  st.insertError = null;
  vi.mocked(recordAudit).mockClear();
});

describe("transcription vocabulary", () => {
  it("anyone in the company reads the list; only an admin may manage it", async () => {
    st.ctx = { ...ADMIN, isAdmin: false };
    expect(await (await GET(new Request("http://x") as never)).json()).toMatchObject({ terms: ["AT&T Fiber"], canManage: false });
  });

  it("a rep cannot change it, and nothing is written", async () => {
    st.ctx = { ...ADMIN, isAdmin: false };
    expect((await put({ terms: ["DIRECTV"] })).status).toBe(403);
    expect(st.inserts).toEqual([]);
  });

  it("an admin's change is a new row for their own company, and is audited", async () => {
    const res = await put({ terms: ["DIRECTV", "AT&T Wireless"] });
    expect(res.status).toBe(200);
    expect(st.inserts).toEqual([{ company_id: "co1", terms: expect.arrayContaining(["DIRECTV", "AT&T Wireless"]), set_by: "u-ceo" }]);
    expect(recordAudit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: "vocabulary.set" }));
  });

  it("anything but a list of strings is refused", async () => {
    for (const body of [{}, { terms: "DIRECTV" }, { terms: [1, 2] }]) expect((await put(body)).status).toBe(400);
    expect(st.inserts).toEqual([]);
  });

  it("before 0306: 503 with the reason, no audit row", async () => {
    st.insertError = { code: "42P01", message: "missing" };
    expect((await put({ terms: ["DIRECTV"] })).status).toBe(503);
    expect(recordAudit).not.toHaveBeenCalled();
  });
});
