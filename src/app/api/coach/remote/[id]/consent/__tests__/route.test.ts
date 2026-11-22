import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * /api/coach/remote/:id/consent (founder 2026-11-22: "Rep confirms at Start"). Only the rep on the call can confirm
 * the prospect knew it was recorded, only for phone/video calls, and the confirmation is an appended event.
 */
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: vi.fn(() => null) }));
vi.mock("@/lib/api/resolveApiAuth", () => ({ resolveApiAuth: vi.fn() }));
vi.mock("@/lib/api/callerScopedDb", () => ({ callerScopedDb: vi.fn(() => null) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/data/salesCoach", () => ({ getSession: vi.fn() }));

import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/data/salesCoach";
import { GET, POST } from "../route";

const asMock = (f: unknown) => f as ReturnType<typeof vi.fn>;
const ID = "11111111-1111-4111-8111-111111111111";
const params = (id = ID) => ({ params: Promise.resolve({ id }) });
const post = (body: unknown) => ({ json: async () => body, headers: new Headers() }) as never;
const get = () => ({ headers: new Headers() }) as never;

let inserted: Record<string, unknown> | null = null;
let latest: unknown = null;
const db = {
  from: () => {
    const q: Record<string, unknown> = {};
    for (const m of ["select", "eq", "order", "limit"]) q[m] = () => q;
    q.maybeSingle = async () => ({ data: latest, error: null });
    q.insert = async (row: Record<string, unknown>) => {
      inserted = row;
      return { error: null };
    };
    return q;
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  inserted = null;
  latest = null;
  asMock(createClient).mockResolvedValue(db);
  asMock(resolveApiAuth).mockResolvedValue({ userId: "rep1", companyId: "c1" });
  asMock(getSession).mockResolvedValue({ id: ID, agentId: "rep1", companyId: "c1", context: "phone" });
});

describe("recording consent", () => {
  it("the rep on the call confirms it, as an appended event", async () => {
    const res = await POST(post({ how: "live" }), params());
    expect(res.status).toBe(200);
    expect(inserted).toMatchObject({ company_id: "c1", actor: "rep1", kind: "coach.recording_consent_confirmed", subject: `sales_session:${ID}`, payload: { how: "live" } });
  });

  it("a manager cannot confirm on the rep's behalf", async () => {
    asMock(resolveApiAuth).mockResolvedValue({ userId: "mgr1", companyId: "c1" });
    expect((await POST(post({ how: "live" }), params())).status).toBe(403);
    expect(inserted).toBeNull();
  });

  it("is for phone and video calls only", async () => {
    asMock(getSession).mockResolvedValue({ id: ID, agentId: "rep1", companyId: "c1", context: "in_person" });
    expect((await POST(post({ how: "upload" }), params())).status).toBe(400);
  });

  it("a call the caller cannot see, or a malformed id, is not found", async () => {
    asMock(getSession).mockResolvedValue(null);
    expect((await POST(post({ how: "live" }), params())).status).toBe(404);
    expect((await GET(get(), params("nope"))).status).toBe(404);
  });

  it("GET reports the latest confirmation, or null", async () => {
    expect(await (await GET(get(), params())).json()).toEqual({ confirmed: null });
    latest = { payload: { how: "upload" }, created_at: "2026-11-22T10:00:00Z" };
    expect(await (await GET(get(), params())).json()).toEqual({ confirmed: { at: "2026-11-22T10:00:00Z", how: "upload" } });
  });
});
