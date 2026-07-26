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
  profile?: { company_id?: string | null; status?: string | null } | null;
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
});
