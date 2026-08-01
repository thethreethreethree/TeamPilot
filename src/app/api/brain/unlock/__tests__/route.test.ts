import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * POST /api/brain/unlock — manually unlocks the Month-1 control window (an explicit constitutional
 * override). Previously untested. This gate is thesis-critical, and it fixed a documented CRITICAL
 * finding (A21 C1, 2026-06-18): until the fix, ANY authenticated company member could override the
 * control window — a non-leadership user could unilaterally disable the discipline that makes the
 * System trustworthy. These pin: the leadership-only gate (403 for non-admins, and unlockControlGate
 * is NOT called), the required audit reason (>=20 chars), the happy path (unlock called with the
 * reason recorded), and a no-leak 500.
 */
vi.mock("@/lib/brain", () => ({ unlockControlGate: vi.fn(async () => {}) }));
vi.mock("@/lib/supabase/auth-helpers", () => ({ getCurrentAuthContext: vi.fn() }));

import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { unlockControlGate } from "@/lib/brain";
import { POST } from "../route";

const setCtx = (ctx: unknown) =>
  (getCurrentAuthContext as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(ctx);
const req = (body: unknown) => ({ json: async () => body }) as unknown as Parameters<typeof POST>[0];
const LONG = "Pilot compressed to two weeks by explicit founder agreement.";

beforeEach(() => vi.clearAllMocks());

describe("POST /api/brain/unlock — control-window override gate", () => {
  it("401 when not authenticated / no company", async () => {
    setCtx(null);
    expect((await POST(req({ reason: LONG }))).status).toBe(401);
    expect(unlockControlGate).not.toHaveBeenCalled();
  });

  it("403 for a NON-admin (the C1 fix: non-leadership could override the control window)", async () => {
    setCtx({ companyId: "co1", isAdmin: false });
    const res = await POST(req({ reason: LONG }));
    expect(res.status).toBe(403);
    expect(unlockControlGate).not.toHaveBeenCalled();
  });

  it("400 when the audit reason is < 20 chars (or missing)", async () => {
    setCtx({ companyId: "co1", isAdmin: true });
    expect((await POST(req({ reason: "too short" }))).status).toBe(400);
    expect((await POST(req({}))).status).toBe(400);
    expect(unlockControlGate).not.toHaveBeenCalled();
  });

  it("200 for an admin with a valid reason — unlocks with the reason recorded", async () => {
    setCtx({ companyId: "co1", isAdmin: true });
    const res = await POST(req({ reason: LONG }));
    expect(res.status).toBe(200);
    expect(unlockControlGate).toHaveBeenCalledWith({ companyId: "co1", reason: LONG });
  });

  it("500 WITHOUT leaking when unlockControlGate throws (CWE-209)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    setCtx({ companyId: "co1", isAdmin: true });
    (unlockControlGate as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("internal pg detail")
    );
    const res = await POST(req({ reason: LONG }));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("internal pg detail");
  });
});
