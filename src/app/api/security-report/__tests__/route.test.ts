import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
const st = vi.hoisted(() => ({ rows: [] as unknown[], res: { data: { id: "abcdef12-0000-0000-0000-000000000000" }, error: null } as { data: unknown; error: unknown } }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: () => ({ insert: (row: unknown) => (st.rows.push(row), { select: () => ({ maybeSingle: async () => st.res }) }) }) }),
}));

import { POST } from "../route";
const post = (body: unknown) => new Request("http://x/api", { method: "POST", body: JSON.stringify(body) }) as never;
const ok = { summary: "Cross-company read", details: "GET /api/x with another company's id returns their calls." };

beforeEach(() => {
  st.rows = [];
  st.res = { data: { id: "abcdef12-0000-0000-0000-000000000000" }, error: null };
});

describe("POST /api/security-report", () => {
  it("stores a report with no account and returns a reference", async () => {
    expect(await (await POST(post({ ...ok, contact: "a@b.c" }))).json()).toEqual({ ok: true, reference: "ABCDEF12" });
    expect(st.rows[0]).toEqual({ summary: ok.summary, details: ok.details, affected: null, reporter_name: null, reporter_contact: "a@b.c" });
  });
  it("a filled hidden field is a bot: answered, stored nowhere", async () => {
    expect((await POST(post({ ...ok, website: "spam.example" }))).status).toBe(200);
    expect(st.rows).toEqual([]);
  });
  it("refuses an incomplete report", async () => {
    expect((await POST(post({ summary: "x" }))).status).toBe(400);
    expect(st.rows).toEqual([]);
  });
  it("a failed save says so (500), never 'received'", async () => {
    st.res = { data: null, error: { message: "x" } };
    expect((await POST(post(ok))).status).toBe(500);
  });
});
