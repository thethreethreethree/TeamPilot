import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/resolveApiAuth", () => ({ resolveApiAuth: vi.fn() }));
vi.mock("@/lib/audit/recordAudit", () => ({ recordAudit: vi.fn(async () => true) }));
const db = vi.hoisted(() => ({ inserts: [] as unknown[], read: { data: [] as unknown[], error: null as unknown }, insertError: null as unknown }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => {
      const b: Record<string, unknown> = {};
      for (const m of ["select", "eq", "order"]) b[m] = () => b;
      b.limit = async () => db.read;
      b.insert = async (row: unknown) => (db.inserts.push(row), { error: db.insertError });
      return b;
    },
  }),
}));

import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { recordAudit } from "@/lib/audit/recordAudit";
import { GET, PUT } from "../route";

const ADMIN = { userId: "u-ceo", companyId: "co1", role: "CEO", isAdmin: true };
const REP = { userId: "u-rep", companyId: "co1", role: "staff", isAdmin: false };
const put = (body: unknown) => new Request("http://x/api", { method: "PUT", body: JSON.stringify(body) }) as never;
const get = () => new Request("http://x/api") as never;

beforeEach(() => {
  db.inserts = [];
  db.read = { data: [], error: null };
  db.insertError = null;
  vi.mocked(recordAudit).mockClear();
});

describe("retention route", () => {
  it("GET with no row: the D14 default — 90 days, no count — marked as default", async () => {
    vi.mocked(resolveApiAuth).mockResolvedValue(REP as never);
    expect(await (await GET(get())).json()).toMatchObject({ keepLastPerRep: null, defaultDays: 90, defaultKeep: 20, isDefault: true, canManage: false });
  });
  it("GET returns the latest setting", async () => {
    vi.mocked(resolveApiAuth).mockResolvedValue(ADMIN as never);
    db.read = { data: [{ keep_last_per_rep: 40, set_by: "u-ceo", created_at: "2026-11-20T00:00:00Z" }], error: null };
    expect(await (await GET(get())).json()).toMatchObject({ keepLastPerRep: 40, isDefault: false, canManage: true });
  });
  it("PUT: a rep is refused and nothing is written", async () => {
    vi.mocked(resolveApiAuth).mockResolvedValue(REP as never);
    expect((await PUT(put({ keepLastPerRep: 5 }))).status).toBe(403);
    expect(db.inserts).toEqual([]);
  });
  it("PUT: an admin appends a row for their own company, set by them, and it is audited", async () => {
    vi.mocked(resolveApiAuth).mockResolvedValue(ADMIN as never);
    expect((await PUT(put({ keepLastPerRep: 50 }))).status).toBe(200);
    expect(db.inserts).toEqual([{ company_id: "co1", keep_last_per_rep: 50, set_by: "u-ceo" }]);
    expect(recordAudit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: "retention.set", meta: { keepLastPerRep: 50 } }));
  });
  it("PUT: out-of-range values are refused", async () => {
    vi.mocked(resolveApiAuth).mockResolvedValue(ADMIN as never);
    for (const v of [0, 1001, 2.5, "x"]) expect((await PUT(put({ keepLastPerRep: v }))).status).toBe(400);
    expect(db.inserts).toEqual([]);
  });
  it("PUT before 0284: 503 with the reason, and no audit row for a change that did not happen", async () => {
    vi.mocked(resolveApiAuth).mockResolvedValue(ADMIN as never);
    db.insertError = { code: "42P01", message: "missing" };
    expect((await PUT(put({ keepLastPerRep: 50 }))).status).toBe(503);
    expect(recordAudit).not.toHaveBeenCalled();
  });

  // 0308 (2026-11-23): back to the standard 90 days is a row with no count.
  it("PUT { useDefault: true }: appends a row with NO count, audited as a return to the standard", async () => {
    vi.mocked(resolveApiAuth).mockResolvedValue(ADMIN as never);
    const res = await PUT(put({ useDefault: true }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ keepLastPerRep: null, isDefault: true });
    expect(db.inserts).toEqual([{ company_id: "co1", keep_last_per_rep: null, set_by: "u-ceo" }]);
    expect(recordAudit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ meta: { useDefault: true, defaultDays: 90 } }));
  });
  it("PUT: only an explicit useDefault returns to the standard — a null or missing number is refused", async () => {
    vi.mocked(resolveApiAuth).mockResolvedValue(ADMIN as never);
    for (const body of [{ keepLastPerRep: null }, {}, { useDefault: "yes" }]) expect((await PUT(put(body))).status).toBe(400);
    expect(db.inserts).toEqual([]);
  });
  it("PUT useDefault before 0308 (count still required): 503 naming the migration, no audit row", async () => {
    vi.mocked(resolveApiAuth).mockResolvedValue(ADMIN as never);
    db.insertError = { code: "23502", message: "null value in column keep_last_per_rep" };
    const res = await PUT(put({ useDefault: true }));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/0308/);
    expect(recordAudit).not.toHaveBeenCalled();
  });
  it("GET: a latest row with no count reads as the default", async () => {
    vi.mocked(resolveApiAuth).mockResolvedValue(ADMIN as never);
    db.read = { data: [{ keep_last_per_rep: null, set_by: "u-ceo", created_at: "2026-11-23T00:00:00Z" }], error: null };
    expect(await (await GET(get())).json()).toMatchObject({ keepLastPerRep: null, isDefault: true, defaultDays: 90 });
  });
});

