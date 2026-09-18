import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import { requireExtensionAuth, requireEntitledExtensionUser } from "@/lib/api/extensionAuth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getExtensionEntitlement } from "@/lib/care/extensionEntitlement";

/**
 * The extension's paid-feature authz gate. Every branch here is a security decision (who reaches a paid tool),
 * and none was covered. These lock: no/!Bearer token → 401, invalid token → 401, removed user → 403, no company
 * → 403, valid → ok; and the entitlement layer: locked → 402, entitled → ok. A regression to fail-open on any
 * of these silently hands a paid feature to someone who shouldn't have it.
 */

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/care/extensionEntitlement", () => ({ getExtensionEntitlement: vi.fn() }));

const reqWith = (auth?: string): NextRequest =>
  ({ headers: { get: (k: string) => (k.toLowerCase() === "authorization" && auth ? auth : null) } }) as unknown as NextRequest;

function mockAdmin(opts: {
  user?: { id: string } | null;
  userError?: unknown;
  profile?: { company_id?: string | null; status?: string | null; must_change_password?: boolean } | null;
}) {
  const builder: Record<string, unknown> = {};
  builder.select = () => builder;
  builder.eq = () => builder;
  builder.maybeSingle = async () => ({ data: opts.profile ?? null, error: null });
  vi.mocked(createAdminClient).mockReturnValue({
    auth: { getUser: async () => ({ data: { user: opts.user ?? null }, error: opts.userError ?? null }) },
    from: () => builder,
  } as never);
}

beforeEach(() => vi.clearAllMocks());

describe("requireExtensionAuth", () => {
  it("no Authorization header → 401", async () => {
    mockAdmin({});
    const r = await requireExtensionAuth(reqWith());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(401);
  });

  it("header without a Bearer prefix → 401", async () => {
    mockAdmin({ user: { id: "u" }, profile: { company_id: "c", status: "active" } });
    const r = await requireExtensionAuth(reqWith("Basic abc"));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(401);
  });

  it("invalid/expired token (getUser errors) → 401", async () => {
    mockAdmin({ user: null, userError: { message: "bad jwt" } });
    const r = await requireExtensionAuth(reqWith("Bearer sometoken"));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(401);
  });

  it("removed/deactivated user → 403 (fail closed even with a company_id)", async () => {
    mockAdmin({ user: { id: "u" }, profile: { company_id: "c", status: "removed" } });
    const r = await requireExtensionAuth(reqWith("Bearer t"));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(403);
  });

  it("no company associated → 403", async () => {
    mockAdmin({ user: { id: "u" }, profile: { company_id: null, status: "active" } });
    const r = await requireExtensionAuth(reqWith("Bearer t"));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(403);
  });

  it("missing profile row → 403 (no company)", async () => {
    mockAdmin({ user: { id: "u" }, profile: null });
    const r = await requireExtensionAuth(reqWith("Bearer t"));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(403);
  });

  it("valid active user with a company → ok", async () => {
    mockAdmin({ user: { id: "u1" }, profile: { company_id: "c1", status: "active" } });
    const r = await requireExtensionAuth(reqWith("Bearer t"));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.userId).toBe("u1");
      expect(r.companyId).toBe("c1");
    }
  });
});

describe("requireEntitledExtensionUser", () => {
  it("propagates an auth failure (401) before checking entitlement", async () => {
    mockAdmin({ user: null, userError: { message: "bad" } });
    const r = await requireEntitledExtensionUser(reqWith("Bearer t"));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(401);
    expect(getExtensionEntitlement).not.toHaveBeenCalled();
  });

  it("authenticated but locked tenant → 402 with the entitlement in the body", async () => {
    mockAdmin({ user: { id: "u" }, profile: { company_id: "c", status: "active" } });
    vi.mocked(getExtensionEntitlement).mockResolvedValue({ status: "locked", trialDaysLeft: 0, plan: "pilot", trialEnded: false });
    const r = await requireEntitledExtensionUser(reqWith("Bearer t"));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.response.status).toBe(402);
      const body = await r.response.json();
      expect(body.entitlement.status).toBe("locked");
    }
  });

  it("authenticated + entitled → ok, carrying the entitlement", async () => {
    mockAdmin({ user: { id: "u1" }, profile: { company_id: "c1", status: "active" } });
    vi.mocked(getExtensionEntitlement).mockResolvedValue({ status: "trial", trialDaysLeft: 9, plan: "pilot", trialEnded: false });
    const r = await requireEntitledExtensionUser(reqWith("Bearer t"));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.user.companyId).toBe("c1");
      expect(r.user.entitlement.status).toBe("trial");
    }
  });

  describe("402 product label (§3.4 — name the surface the caller is on)", () => {
    it("defaults to C.A.R.E branding when no label is passed (existing callers unchanged)", async () => {
      mockAdmin({ user: { id: "u" }, profile: { company_id: "c", status: "active" } });
      vi.mocked(getExtensionEntitlement).mockResolvedValue({ status: "locked", trialDaysLeft: 0, plan: "pilot", trialEnded: true });
      const r = await requireEntitledExtensionUser(reqWith("Bearer t"));
      expect(r.ok).toBe(false);
      if (!r.ok) expect((await r.response.json()).error).toBe("Your 14-day C.A.R.E extension trial has ended.");
    });

    it("uses the passed label so a sales user never sees C.A.R.E branding", async () => {
      mockAdmin({ user: { id: "u" }, profile: { company_id: "c", status: "active" } });
      vi.mocked(getExtensionEntitlement).mockResolvedValue({ status: "locked", trialDaysLeft: 0, plan: "pilot", trialEnded: true });
      const r = await requireEntitledExtensionUser(reqWith("Bearer t"), { productLabel: "Sales Coach extension" });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        const body = await r.response.json();
        expect(body.error).toBe("Your 14-day Sales Coach extension trial has ended.");
        expect(body.error).not.toContain("C.A.R.E");
      }
    });

    it("uses the label in the not-included message too (trial never started)", async () => {
      mockAdmin({ user: { id: "u" }, profile: { company_id: "c", status: "active" } });
      vi.mocked(getExtensionEntitlement).mockResolvedValue({ status: "locked", trialDaysLeft: 0, plan: "pilot", trialEnded: false });
      const r = await requireEntitledExtensionUser(reqWith("Bearer t"), { productLabel: "Sales Coach extension" });
      expect(r.ok).toBe(false);
      if (!r.ok) expect((await r.response.json()).error).toBe("Your plan doesn't include the Sales Coach extension.");
    });
  });
});

/**
 * Forced first-login password change on the EXTENSION path (0235).
 *
 * Regression guard for a real hole: must_change_password was enforced ONLY in src/app/dashboard/layout.tsx, and
 * the middleware matcher does not cover /api/*. A rep who worked entirely inside the extension never met the
 * gate, so the SHARED team password an admin handed several new hires stayed live on their account forever.
 * Both branches of the flag are exercised — the exemption-shaped term (the flag being false/absent) is exactly
 * the kind that gets dropped in a copy and silently defeats the gate.
 */
describe("requireExtensionAuth — must_change_password gate", () => {
  it("flag set → 403 with a machine-readable code the client can route on", async () => {
    mockAdmin({ user: { id: "u" }, profile: { company_id: "c", status: "active", must_change_password: true } });
    const r = await requireExtensionAuth(reqWith("Bearer t"));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.response.status).toBe(403);
      const body = await r.response.json();
      expect(body.code).toBe("must_change_password");
      expect(body.error).toContain("/set-password");
    }
  });

  it("flag false → passes (a rotated user is not bounced)", async () => {
    mockAdmin({ user: { id: "u" }, profile: { company_id: "c", status: "active", must_change_password: false } });
    const r = await requireExtensionAuth(reqWith("Bearer t"));
    expect(r.ok).toBe(true);
  });

  it("removed user is still rejected FIRST, even while the flag is set", async () => {
    mockAdmin({ user: { id: "u" }, profile: { company_id: "c", status: "removed", must_change_password: true } });
    const r = await requireExtensionAuth(reqWith("Bearer t"));
    expect(r.ok).toBe(false);
    if (!r.ok) expect((await r.response.json()).error).toBe("This account has been deactivated.");
  });

  it("column absent (migration 0235 unapplied) → falls back and does NOT lock every extension user out", async () => {
    // First select (with must_change_password) yields nothing, as a missing column would; the retry with the
    // original columns succeeds. The gate goes inactive rather than 403-ing the whole extension userbase.
    let call = 0;
    const builder: Record<string, unknown> = {};
    builder.select = () => builder;
    builder.eq = () => builder;
    builder.maybeSingle = async () => {
      call += 1;
      return call === 1 ? { data: null, error: { message: 'column "must_change_password" does not exist' } } : { data: { company_id: "c", status: "active" }, error: null };
    };
    vi.mocked(createAdminClient).mockReturnValue({
      auth: { getUser: async () => ({ data: { user: { id: "u" } }, error: null }) },
      from: () => builder,
    } as never);

    const r = await requireExtensionAuth(reqWith("Bearer t"));
    expect(r.ok).toBe(true);
    expect(call).toBe(2); // the fallback actually ran
  });
});
