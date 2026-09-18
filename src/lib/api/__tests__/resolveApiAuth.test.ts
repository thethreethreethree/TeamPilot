import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Drift guard for the THIRD copy of "a removed account is not authenticated" (CLAUDE.md §2.2).
 *
 * The decision is authored in `requireExtensionAuth` (src/lib/api/extensionAuth.ts) and RE-DERIVED twice in
 * resolveApiAuth.ts — once in `resolveApiAuth` and once in `resolveApiUserId` — both saying in a comment that
 * they "mirror requireExtensionAuth". §2.2 permits an unavoidable re-derivation only when it mirrors the
 * authority term-for-term AND a drift-guard test exercises BOTH branches of every term. There was no such test:
 * resolveApiAuth.ts had no unit test at all, only route-level tests that mock it away entirely.
 *
 * These assert BEHAVIOUR, not source shape, deliberately (A33 — a gate must be precise or not exist). A future
 * refactor that collapses the three copies into one shared helper is the CORRECT fix, and it must not fail this
 * file; only a change that actually stops failing closed should.
 *
 * The two functions differ on purpose and that difference is pinned too: resolveApiAuth REQUIRES a company_id,
 * resolveApiUserId does not, because the routes it serves (e.g. /[id]/outcome) only ever asked "is anyone signed
 * in?" and left access to RLS. Swapping them once started 401-ing signed-in web users — the header comment in
 * resolveApiAuth.ts records that incident.
 */

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/auth-helpers", () => ({ getCurrentAuthContext: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { resolveApiAuth, resolveApiUserId } from "@/lib/api/resolveApiAuth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { createClient } from "@/lib/supabase/server";

const bearer = (tok = "tok") =>
  new Request("http://localhost/api/anything", { headers: { authorization: `Bearer ${tok}` } });
const noHeader = () => new Request("http://localhost/api/anything");

/** Admin client stub: a token-validating auth.getUser plus a single-row profiles read. */
function mockAdmin(opts: { user?: { id: string } | null; profile?: Record<string, unknown> | null }) {
  const builder: Record<string, unknown> = {};
  builder.select = () => builder;
  builder.eq = () => builder;
  builder.maybeSingle = async () => ({ data: opts.profile ?? null, error: null });
  vi.mocked(createAdminClient).mockReturnValue({
    auth: { getUser: async () => ({ data: { user: opts.user ?? null }, error: opts.user ? null : { message: "bad jwt" } }) },
    from: () => builder,
  } as never);
}

/** Cookie-session stub for resolveApiUserId's dynamic import of @/lib/supabase/server. */
function mockCookieUser(user: { id: string } | null) {
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user } }) },
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCurrentAuthContext).mockResolvedValue(null);
  mockCookieUser(null);
});

describe("resolveApiAuth — the mobile Bearer branch fails closed exactly as the extension gate does", () => {
  it("removed account -> null (the denying branch)", async () => {
    mockAdmin({ user: { id: "u" }, profile: { company_id: "c1", role: "Member", status: "removed" } });
    expect(await resolveApiAuth(bearer())).toBeNull();
  });

  it("active account with a company -> an AuthContext (the ALLOWING branch)", async () => {
    // §2.2's "both branches of every term": a gate that only ever denies is indistinguishable from one that is
    // broken, and this is the branch a bad denylist edit would silently take away.
    mockAdmin({ user: { id: "u" }, profile: { company_id: "c1", role: "Member", status: "active" } });
    const ctx = await resolveApiAuth(bearer());
    expect(ctx).toEqual({ userId: "u", companyId: "c1", role: "Member", isAdmin: false });
  });

  it("admin role is carried through, so a mobile caller is not silently demoted", async () => {
    mockAdmin({ user: { id: "u" }, profile: { company_id: "c1", role: "admin", status: "active" } });
    expect((await resolveApiAuth(bearer()))?.isAdmin).toBe(true);
  });

  it("active but with no company -> null (this function requires a tenant)", async () => {
    mockAdmin({ user: { id: "u" }, profile: { company_id: null, role: null, status: "active" } });
    expect(await resolveApiAuth(bearer())).toBeNull();
  });

  it("no profile row at all -> null", async () => {
    mockAdmin({ user: { id: "u" }, profile: null });
    expect(await resolveApiAuth(bearer())).toBeNull();
  });

  it("invalid token -> null", async () => {
    mockAdmin({ user: null });
    expect(await resolveApiAuth(bearer("garbage"))).toBeNull();
  });

  it("no Authorization header and no cookie -> null, without reaching the admin client", async () => {
    mockAdmin({ user: { id: "should-not-be-used" }, profile: { company_id: "c1", status: "active" } });
    expect(await resolveApiAuth(noHeader())).toBeNull();
  });

  it("the cookie session wins and short-circuits the Bearer path", async () => {
    // The web path must stay byte-identical: if a cookie context exists it is returned before any token work.
    vi.mocked(getCurrentAuthContext).mockResolvedValue({ userId: "web", companyId: "c9", role: "CEO", isAdmin: true } as never);
    const ctx = await resolveApiAuth(bearer());
    expect(ctx?.userId).toBe("web");
    expect(createAdminClient).not.toHaveBeenCalled();
  });
});

describe("resolveApiUserId — identity only, and it fails closed on the same term", () => {
  it("removed account -> null (the denying branch)", async () => {
    mockAdmin({ user: { id: "u" }, profile: { status: "removed" } });
    expect(await resolveApiUserId(bearer())).toBeNull();
  });

  it("active account -> the id (the ALLOWING branch)", async () => {
    mockAdmin({ user: { id: "u" }, profile: { status: "active" } });
    expect(await resolveApiUserId(bearer())).toBe("u");
  });

  it("NO profile row -> still the id, because this function deliberately does not require one", async () => {
    // Pinned because it is the exact difference from resolveApiAuth, and collapsing the two once began
    // rejecting signed-in web users on /[id]/outcome. A 'tidy' unification must fail here, loudly.
    mockAdmin({ user: { id: "u" }, profile: null });
    expect(await resolveApiUserId(bearer())).toBe("u");
  });

  it("the cookie session wins and short-circuits the Bearer path", async () => {
    mockCookieUser({ id: "web" });
    mockAdmin({ user: { id: "mobile" }, profile: { status: "active" } });
    expect(await resolveApiUserId(bearer())).toBe("web");
  });
});

describe("the denylist's unstated precondition", () => {
  it("profiles.status is still constrained to exactly ('active','removed')", () => {
    // requireExtensionAuth's own comment (2026-07-23 audit) records this dependency: blocking 'removed' is
    // equivalent to allowlisting 'active' ONLY while the CHECK permits nothing else. Add 'suspended' and all
    // THREE denylists — requireExtensionAuth, resolveApiAuth, resolveApiUserId — silently FAIL OPEN, because a
    // suspended user is !== 'removed'. The warning lives in a comment in one file; this makes it fail a test.
    const here = dirname(fileURLToPath(import.meta.url));
    const migDir = join(here, "../../../../supabase/migrations");
    const file = readdirSync(migDir).find((f) => f.startsWith("0008"));
    expect(file, "migration 0008* (profiles.status) not found").toBeTruthy();

    const sql = readFileSync(join(migDir, file as string), "utf8");
    const m = sql.match(/status\s+in\s*\(([^)]+)\)/i);
    expect(m, "no `status in (...)` CHECK found in 0008").toBeTruthy();

    const allowed = (m?.[1] ?? "").split(",").map((s) => s.trim().replace(/^'|'$/g, "")).sort();
    expect(
      allowed,
      "profiles.status gained a value. Three fail-closed denylists check `status === 'removed'` and would now " +
        "let the new status through: requireExtensionAuth (src/lib/api/extensionAuth.ts), resolveApiAuth and " +
        "resolveApiUserId (src/lib/api/resolveApiAuth.ts). Flip all three to an allowlist (status === 'active') " +
        "so a new status defaults to no access, then update this test.",
    ).toEqual(["active", "removed"]);
  });
});
