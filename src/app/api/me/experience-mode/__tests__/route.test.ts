import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * /api/me/experience-mode contract (0110). Mocks the supabase server client so
 * the handler logic is exercised without a live DB: the auth gate, the
 * fail-safe-to-standard default on GET, the enum validation on PATCH, and the
 * update path. (Runtime behavior against a real profiles row is still unverified
 * — that needs 0110 applied — but the handler's own logic is now covered.)
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { GET, PATCH } from "../route";

type FakeOpts = {
  user?: { id: string } | null;
  selectData?: { experience_mode?: string } | null;
  selectError?: { message: string } | null;
  updateError?: { message: string } | null;
};

function fakeSb(opts: FakeOpts) {
  const updateEq = vi.fn(async () => ({ error: opts.updateError ?? null }));
  return {
    auth: { getUser: async () => ({ data: { user: opts.user ?? null } }) },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: opts.selectData ?? null,
            error: opts.selectError ?? null,
          }),
        }),
      }),
      update: () => ({ eq: updateEq }),
    }),
    _updateEq: updateEq,
  };
}

function patchReq(body: unknown) {
  return { json: async () => body } as never;
}

beforeEach(() => vi.mocked(createClient).mockReset());

describe("GET /api/me/experience-mode", () => {
  it("401s an anonymous caller", async () => {
    vi.mocked(createClient).mockResolvedValue(fakeSb({ user: null }) as never);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 'expert' when the profile says expert", async () => {
    vi.mocked(createClient).mockResolvedValue(
      fakeSb({ user: { id: "u1" }, selectData: { experience_mode: "expert" } }) as never
    );
    expect(await (await GET()).json()).toEqual({ mode: "expert" });
  });

  it("returns 'standard' when the profile says standard", async () => {
    vi.mocked(createClient).mockResolvedValue(
      fakeSb({ user: { id: "u1" }, selectData: { experience_mode: "standard" } }) as never
    );
    expect(await (await GET()).json()).toEqual({ mode: "standard" });
  });

  it("fails safe to 'standard' when the column/row is absent (never over-serve complexity)", async () => {
    vi.mocked(createClient).mockResolvedValue(
      fakeSb({ user: { id: "u1" }, selectData: null }) as never
    );
    expect(await (await GET()).json()).toEqual({ mode: "standard" });
  });
});

describe("PATCH /api/me/experience-mode", () => {
  it("401s an anonymous caller", async () => {
    vi.mocked(createClient).mockResolvedValue(fakeSb({ user: null }) as never);
    const res = await PATCH(patchReq({ mode: "standard" }));
    expect(res.status).toBe(401);
  });

  it("rejects an invalid mode (400, schema)", async () => {
    vi.mocked(createClient).mockResolvedValue(fakeSb({ user: { id: "u1" } }) as never);
    const res = await PATCH(patchReq({ mode: "lite" }));
    expect(res.status).toBe(400);
  });

  it("rejects extra keys (strict schema)", async () => {
    vi.mocked(createClient).mockResolvedValue(fakeSb({ user: { id: "u1" } }) as never);
    const res = await PATCH(patchReq({ mode: "standard", sneaky: true }));
    expect(res.status).toBe(400);
  });

  it("updates the profile and echoes the mode on a valid PATCH", async () => {
    const sb = fakeSb({ user: { id: "u1" } });
    vi.mocked(createClient).mockResolvedValue(sb as never);
    const res = await PATCH(patchReq({ mode: "expert" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, mode: "expert" });
    expect(sb._updateEq).toHaveBeenCalledOnce();
  });

  it("500s when the DB update errors (honest failure, not a false ok)", async () => {
    vi.mocked(createClient).mockResolvedValue(
      fakeSb({ user: { id: "u1" }, updateError: { message: "db down" } }) as never
    );
    const res = await PATCH(patchReq({ mode: "standard" }));
    expect(res.status).toBe(500);
  });
});
