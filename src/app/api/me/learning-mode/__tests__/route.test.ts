import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * /api/me/learning-mode (migration 0051) — the per-user "learning mode" preference. Previously untested.
 * Covers: the auth gate (401), GET's boolean coercion, PATCH's strict-schema validation (400), the happy
 * write path, and that a real DB error yields a generic 500 without leaking the raw message (CWE-209).
 * The supabase client is faked so the handler logic runs without a live DB.
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/api/validate", () => ({
  readBody: async (req: { json: () => Promise<unknown> }, schema: { safeParse: (v: unknown) => { success: boolean } }) => {
    const raw = await req.json();
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      const { NextResponse } = await import("next/server");
      return NextResponse.json({ error: "Invalid" }, { status: 400 });
    }
    return raw;
  },
}));

import { createClient } from "@/lib/supabase/server";
import { GET, PATCH } from "../route";

type FakeOpts = {
  user?: { id: string } | null;
  selectData?: { learning_mode_enabled?: boolean } | null;
  updateError?: { message: string } | null;
};

function fakeSb(opts: FakeOpts) {
  const updateEq = vi.fn(async () => ({ error: opts.updateError ?? null }));
  return {
    auth: { getUser: async () => ({ data: { user: opts.user ?? null } }) },
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: opts.selectData ?? null, error: null }) }),
      }),
      update: () => ({ eq: updateEq }),
    }),
    _updateEq: updateEq,
  };
}

const patchReq = (body: unknown) => ({ json: async () => body }) as never;

beforeEach(() => vi.mocked(createClient).mockReset());

describe("GET /api/me/learning-mode", () => {
  it("401s an anonymous caller", async () => {
    vi.mocked(createClient).mockResolvedValue(fakeSb({ user: null }) as never);
    expect((await GET()).status).toBe(401);
  });

  it("returns enabled:true when the profile has it on", async () => {
    vi.mocked(createClient).mockResolvedValue(
      fakeSb({ user: { id: "u1" }, selectData: { learning_mode_enabled: true } }) as never
    );
    expect(await (await GET()).json()).toEqual({ enabled: true });
  });

  it("coerces a missing row to enabled:false (never undefined)", async () => {
    vi.mocked(createClient).mockResolvedValue(fakeSb({ user: { id: "u1" }, selectData: null }) as never);
    expect(await (await GET()).json()).toEqual({ enabled: false });
  });
});

describe("PATCH /api/me/learning-mode", () => {
  it("401s an anonymous caller", async () => {
    vi.mocked(createClient).mockResolvedValue(fakeSb({ user: null }) as never);
    expect((await PATCH(patchReq({ enabled: true }))).status).toBe(401);
  });

  it("rejects a non-boolean / extra-key body (400, strict schema)", async () => {
    vi.mocked(createClient).mockResolvedValue(fakeSb({ user: { id: "u1" } }) as never);
    expect((await PATCH(patchReq({ enabled: "yes" }))).status).toBe(400);
    expect((await PATCH(patchReq({ enabled: true, sneaky: 1 }))).status).toBe(400);
  });

  it("writes and echoes the value on a valid PATCH", async () => {
    const sb = fakeSb({ user: { id: "u1" } });
    vi.mocked(createClient).mockResolvedValue(sb as never);
    const res = await PATCH(patchReq({ enabled: false }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, enabled: false });
    expect(sb._updateEq).toHaveBeenCalledOnce();
  });

  it("500s on a DB error WITHOUT leaking the raw message (CWE-209)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(createClient).mockResolvedValue(
      fakeSb({ user: { id: "u1" }, updateError: { message: "internal pg detail: profiles rls" } }) as never
    );
    const res = await PATCH(patchReq({ enabled: true }));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("internal pg detail");
  });
});
