import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Admin-initiated password reset. Every branch here is a security decision — who may rotate whose credential —
 * and the endpoint mints a working login, so a fail-open on any of them hands an account to the wrong person.
 *
 * Locked: unauthenticated -> 401; non-admin -> 403; self -> 400; another tenant's member -> 404; a REMOVED
 * member -> 409; an ADMIN target -> 403; the happy path returns a policy-valid password AND sets
 * must_change_password; and the partial-failure path tells the truth instead of reporting a clean error for a
 * password that has in fact already changed.
 */

vi.mock("@/lib/supabase/auth-helpers", () => ({ getCurrentAuthContext: vi.fn() }));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));

const profileLookup = vi.fn();
const updateUserById = vi.fn();
const profileUpdate = vi.fn();
/** The payload handed to profiles.update(), captured so the forced-rotation write can be asserted exactly. */
const updatePayload: { value: unknown } = { value: undefined };

vi.mock("@/lib/supabase/admin", () => {
  const selectChain: Record<string, unknown> = {};
  selectChain.eq = () => selectChain;
  selectChain.maybeSingle = () => profileLookup();
  const updateChain: Record<string, unknown> = {};
  updateChain.eq = () => updateChain;
  updateChain.then = (res: (v: unknown) => unknown) => res(profileUpdate());
  return {
    createAdminClient: () => ({
      from: () => ({ select: () => selectChain, update: (v: unknown) => { updatePayload.value = v; return updateChain; } }),
      auth: { admin: { updateUserById: (id: string, a: unknown) => updateUserById(id, a) } },
    }),
  };
});

import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { validateStrongPassword } from "@/lib/auth/passwordPolicy";
import { POST } from "../route";

const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;
const req = (body: unknown) => ({ json: async () => body, headers: new Headers() }) as unknown as Parameters<typeof POST>[0];
const admin = { userId: "admin-1", companyId: "c1", role: "admin", isAdmin: true };
const MEMBER = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
  asMock(getCurrentAuthContext).mockResolvedValue(admin);
  updateUserById.mockResolvedValue({ error: null });
  profileUpdate.mockReturnValue({ error: null });
  updatePayload.value = undefined;
  profileLookup.mockResolvedValue({ data: { id: MEMBER, role: "Member", status: "active", company_id: "c1", full_name: "Rep One" } });
});

describe("POST /api/team/reset-password — who may not call it", () => {
  it("unauthenticated -> 401", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue(null);
    expect((await POST(req({ memberId: MEMBER }))).status).toBe(401);
  });

  it("signed in but not an admin -> 403, and no credential is touched", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue({ ...admin, isAdmin: false });
    expect((await POST(req({ memberId: MEMBER }))).status).toBe(403);
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("resetting YOUR OWN password here -> 400 (Settings is the path that proves you know the old one)", async () => {
    const res = await POST(req({ memberId: admin.userId }));
    expect(res.status).toBe(400);
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("a member of ANOTHER company -> 404, and no credential is touched (INV15 company pin)", async () => {
    profileLookup.mockResolvedValue({ data: { id: MEMBER, role: "Member", status: "active", company_id: "OTHER-CO" } });
    const res = await POST(req({ memberId: MEMBER }));
    expect(res.status).toBe(404);
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("a REMOVED member -> 409; a reset must not re-admit someone through a side door", async () => {
    profileLookup.mockResolvedValue({ data: { id: MEMBER, role: "Member", status: "removed", company_id: "c1" } });
    const res = await POST(req({ memberId: MEMBER }));
    expect(res.status).toBe(409);
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("an ADMIN target -> 403; this endpoint is not an account-takeover path", async () => {
    profileLookup.mockResolvedValue({ data: { id: MEMBER, role: "admin", status: "active", company_id: "c1" } });
    const res = await POST(req({ memberId: MEMBER }));
    expect(res.status).toBe(403);
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("a non-uuid memberId is rejected before any lookup", async () => {
    const res = await POST(req({ memberId: "not-a-uuid" }));
    expect(res.status).toBe(400);
    expect(updateUserById).not.toHaveBeenCalled();
  });
});

describe("POST /api/team/reset-password — the allowing branch", () => {
  it("resets a non-admin teammate, forces rotation, and returns a policy-valid password", async () => {
    const res = await POST(req({ memberId: MEMBER }));
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(body.mustChangeOnLogin).toBe(true);

    // The returned string must actually be usable at the login form AND at /set-password's policy. Asserting
    // against the SHARED validator, not a regex copied here, so the two cannot drift apart.
    expect(validateStrongPassword(body.password).ok).toBe(true);

    // The password reaching auth is the same one handed to the admin — a mismatch here would be a reset that
    // "succeeds" while locking the member out for good.
    expect(updateUserById).toHaveBeenCalledWith(MEMBER, { password: body.password });

    // The forced rotation is what makes this credential temporary rather than a second shared secret.
    expect(updatePayload.value).toEqual({ must_change_password: true });
  });

  it("two resets do not produce the same password", async () => {
    const a = await (await POST(req({ memberId: MEMBER }))).json();
    const b = await (await POST(req({ memberId: MEMBER }))).json();
    expect(a.password).not.toBe(b.password);
  });

  it("auth failure -> 500 and NO password is returned", async () => {
    updateUserById.mockResolvedValue({ error: { message: "boom" } });
    const res = await POST(req({ memberId: MEMBER }));
    expect(res.status).toBe(500);
    expect((await res.json()).password).toBeUndefined();
  });

  it("flag failure -> 500 that ADMITS the password already changed, and still hands it over", async () => {
    // The honest branch. The member's old password is dead either way; reporting a bare failure would send the
    // admin to retry while their teammate is locked out holding nothing.
    profileUpdate.mockReturnValue({ error: { message: "nope" } });
    const res = await POST(req({ memberId: MEMBER }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(validateStrongPassword(body.password).ok).toBe(true);
    expect(body.mustChangeOnLogin).toBe(false);
    expect(body.error).toMatch(/was reset/i);
  });
});
