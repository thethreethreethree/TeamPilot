import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * /api/files/[id]/access — the specific-people access whitelist for a file. Previously untested.
 * The security boundary pinned here: GET (list grants) is uploader-OR-company-admin only — a same-company
 * non-uploader non-admin must be refused (403), because seeing who a file is shared with is itself sensitive.
 * Also covers 401, 404 (file gone), the generic-500-no-leak (CWE-209), and POST/DELETE's 401 + missing-arg 400.
 * rateLimit is mocked to a no-op so these isolate authorization, not throttling.
 */
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/supabase/auth-helpers", () => ({ getCurrentAuthContext: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { GET, POST, DELETE } from "../route";

const setAuth = (v: unknown) =>
  (getCurrentAuthContext as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(v);

/** admin client for GET: files.maybeSingle → the file row; file_access_grants.select().eq() → grants. */
const setAdmin = (file: unknown, grants: { data: unknown; error?: unknown } = { data: [] }) =>
  (createAdminClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    from: (t: string) =>
      t === "files"
        ? { select: () => ({ eq: () => ({ is: () => ({ maybeSingle: async () => ({ data: file }) }) }) }) }
        : { select: () => ({ eq: async () => grants }) },
  });

const ctx = (params: { id: string }) => ({ params: Promise.resolve(params) });
const getReq = () => ({}) as unknown as Parameters<typeof GET>[0];

beforeEach(() => vi.clearAllMocks());

describe("GET /api/files/[id]/access — list-grants gate", () => {
  it("401 unauthenticated", async () => {
    setAuth(null);
    setAdmin(null);
    expect((await GET(getReq(), ctx({ id: "f1" }))).status).toBe(401);
  });

  it("404 when the file is gone/deprecated", async () => {
    setAuth({ userId: "u1", companyId: "co1", isAdmin: false });
    setAdmin(null);
    expect((await GET(getReq(), ctx({ id: "f1" }))).status).toBe(404);
  });

  it("403 for a same-company NON-uploader NON-admin (sharing list is sensitive)", async () => {
    setAuth({ userId: "u2", companyId: "co1", isAdmin: false });
    setAdmin({ uploader_id: "u1", company_id: "co1" });
    expect((await GET(getReq(), ctx({ id: "f1" }))).status).toBe(403);
  });

  it("200 for the uploader", async () => {
    setAuth({ userId: "u1", companyId: "co1", isAdmin: false });
    setAdmin({ uploader_id: "u1", company_id: "co1" }, { data: [{ profile_id: "u3" }] });
    const res = await GET(getReq(), ctx({ id: "f1" }));
    expect(res.status).toBe(200);
    expect((await res.json()).grants).toEqual([{ profile_id: "u3" }]);
  });

  it("200 for a company admin (same company)", async () => {
    setAuth({ userId: "boss", companyId: "co1", isAdmin: true });
    setAdmin({ uploader_id: "u1", company_id: "co1" });
    expect((await GET(getReq(), ctx({ id: "f1" }))).status).toBe(200);
  });

  it("403 for an admin of a DIFFERENT company (tenant boundary)", async () => {
    setAuth({ userId: "boss", companyId: "coOTHER", isAdmin: true });
    setAdmin({ uploader_id: "u1", company_id: "co1" });
    expect((await GET(getReq(), ctx({ id: "f1" }))).status).toBe(403);
  });

  it("500 without leaking the raw DB error (CWE-209)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    setAuth({ userId: "u1", companyId: "co1", isAdmin: false });
    setAdmin(
      { uploader_id: "u1", company_id: "co1" },
      { data: null, error: { message: "internal pg detail: grants rls" } }
    );
    const res = await GET(getReq(), ctx({ id: "f1" }));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("internal pg detail");
  });
});

describe("POST/DELETE /api/files/[id]/access — basic guards", () => {
  const postReq = (body: unknown) => ({ json: async () => body }) as unknown as Parameters<typeof POST>[0];
  const delReq = (profileId: string | null) =>
    ({ nextUrl: { searchParams: { get: () => profileId } } }) as unknown as Parameters<typeof DELETE>[0];

  it("POST 401 unauthenticated", async () => {
    setAuth(null);
    expect((await POST(postReq({ profileId: "u3" }), ctx({ id: "f1" }))).status).toBe(401);
  });

  it("POST 400 when profileId is missing", async () => {
    setAuth({ userId: "u1", companyId: "co1", isAdmin: false });
    expect((await POST(postReq({}), ctx({ id: "f1" }))).status).toBe(400);
  });

  it("POST 200 grants access (RLS-scoped write)", async () => {
    setAuth({ userId: "u1", companyId: "co1", isAdmin: false });
    (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      from: () => ({ insert: async () => ({ error: null }) }),
    });
    expect((await POST(postReq({ profileId: "u3" }), ctx({ id: "f1" }))).status).toBe(200);
  });

  it("DELETE 400 when profileId is missing", async () => {
    setAuth({ userId: "u1", companyId: "co1", isAdmin: false });
    expect((await DELETE(delReq(null), ctx({ id: "f1" }))).status).toBe(400);
  });

  it("DELETE 200 revokes access", async () => {
    setAuth({ userId: "u1", companyId: "co1", isAdmin: false });
    (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      from: () => ({ delete: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }) }),
    });
    expect((await DELETE(delReq("u3"), ctx({ id: "f1" }))).status).toBe(200);
  });
});
