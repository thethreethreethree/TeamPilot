import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * /api/me/theme — authz + the A34 guarded fallback.
 *
 * The one boundary these tests exist to pin: the COMPANY DEFAULT is admin-only and
 * company-scoped, while the PER-USER override is self-serve. A regression that drops the
 * `ctx.isAdmin` re-check would let any member repaint the whole company's default theme —
 * so the 403 test below fails loudly if that guard is removed. The A34 test pins that a
 * pending migration 0201 degrades to a soft 409, never a 500 or a broken page.
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/auth-helpers", () => ({ getCurrentAuthContext: vi.fn() }));
vi.mock("@/lib/api/validate", () => ({ readBody: async (req: { json: () => Promise<unknown> }) => req.json() }));

import { createClient } from "@/lib/supabase/server";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { GET, PATCH } from "../route";

const ADMIN = { userId: "u1", companyId: "co1", role: "CEO", isAdmin: true };
const MEMBER = { userId: "u2", companyId: "co1", role: "Member", isAdmin: false };

const setCtx = (ctx: unknown) =>
  (getCurrentAuthContext as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(ctx);
const setSb = (sb: unknown) =>
  (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(sb);

/** A user client that records update() calls and returns configurable read rows / errors. */
function fakeSb(opts: { row?: unknown; profileErr?: unknown; companyErr?: unknown } = {}) {
  const { row = {}, profileErr = null, companyErr = null } = opts;
  const calls: { table: string; patch?: unknown }[] = [];
  const sb = {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: row, error: table === "profiles" ? profileErr : companyErr }),
        }),
      }),
      update: (patch: unknown) => {
        calls.push({ table, patch });
        return { eq: async () => ({ error: table === "profiles" ? profileErr : companyErr }) };
      },
    }),
    _calls: calls,
  };
  return sb;
}

const req = (body: unknown) => ({ json: async () => body }) as unknown as Parameters<typeof PATCH>[0];

beforeEach(() => vi.clearAllMocks());

describe("/api/me/theme authz + guard", () => {
  it("401 when unauthenticated", async () => {
    setCtx(null);
    setSb(fakeSb());
    expect((await PATCH(req({ preference: "dark" }))).status).toBe(401);
  });

  it("403 when a non-admin tries to set the company default — and NO companies write happens", async () => {
    setCtx(MEMBER);
    const sb = fakeSb();
    setSb(sb);
    const res = await PATCH(req({ companyDefault: "dark" }));
    expect(res.status).toBe(403);
    expect(sb._calls.find((c) => c.table === "companies")).toBeUndefined();
  });

  it("an admin CAN set the company default (companies update, 200)", async () => {
    setCtx(ADMIN);
    const sb = fakeSb();
    setSb(sb);
    const res = await PATCH(req({ companyDefault: "light" }));
    expect(res.status).toBe(200);
    expect(sb._calls.find((c) => c.table === "companies")?.patch).toEqual({ default_theme: "light" });
  });

  it("any user can set their OWN preference (profiles update, 200)", async () => {
    setCtx(MEMBER);
    const sb = fakeSb();
    setSb(sb);
    const res = await PATCH(req({ preference: "dark" }));
    expect(res.status).toBe(200);
    expect(sb._calls.find((c) => c.table === "profiles")?.patch).toEqual({ theme_preference: "dark" });
  });

  it("A34: a pending-migration column error on the user pref returns a soft 409, not 500", async () => {
    setCtx(MEMBER);
    setSb(fakeSb({ profileErr: { code: "42703", message: 'column "theme_preference" does not exist' } }));
    expect((await PATCH(req({ preference: "dark" }))).status).toBe(409);
  });

  it("a real (non-missing-column) DB error returns a generic 500, not the raw message (CWE-209)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    setCtx(MEMBER);
    setSb(fakeSb({ profileErr: { code: "XX000", message: "internal pg detail: profiles rls policy" } }));
    const res = await PATCH(req({ preference: "dark" }));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("internal pg detail");
  });

  it("GET returns the user pref, the company default, and isAdmin", async () => {
    setCtx(ADMIN);
    setSb(fakeSb({ row: { theme_preference: "dark", default_theme: "light" } }));
    const json = await (await GET()).json();
    expect(json).toMatchObject({ preference: "dark", companyDefault: "light", isAdmin: true });
  });
});
