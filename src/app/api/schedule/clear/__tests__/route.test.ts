import { describe, it, expect, vi } from "vitest";

/**
 * Clear-schedule route. Pins: manager-only, and it cancels EVERY live shift via the atomic RPC (append-only
 * SHIFT_CANCELLED, not a row delete). An empty schedule is a clean no-op.
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/auth-helpers", () => ({ getCurrentAuthContext: vi.fn() }));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/schedule/commitImport", () => ({ readExistingShifts: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { readExistingShifts } from "@/lib/schedule/commitImport";
import { POST } from "../route";

const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;
const req = () => ({ headers: new Headers() }) as unknown as Parameters<typeof POST>[0];

describe("schedule clear API", () => {
  it("a manager clears every live shift via the atomic cancel RPC", async () => {
    const rpcArgs: Record<string, unknown> = {};
    asMock(getCurrentAuthContext).mockResolvedValue({ userId: "u1", companyId: "c1", role: "admin", isAdmin: true });
    asMock(readExistingShifts).mockResolvedValue([{ id: "s1", date: "2026-08-20" }, { id: "s2", date: "2026-08-21" }]);
    asMock(createClient).mockResolvedValue({ rpc: async (_fn: string, args: Record<string, unknown>) => { Object.assign(rpcArgs, args); return { error: null }; } });
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect((await res.json()).cleared).toBe(2);
    expect(rpcArgs.p_cancel_shift_ids).toEqual(["s1", "s2"]);
    expect(rpcArgs.p_shifts).toEqual([]); // nothing added — only cancellations
  });

  it("an already-empty schedule is a no-op (cleared: 0, no RPC needed)", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue({ userId: "u1", companyId: "c1", role: "admin", isAdmin: true });
    asMock(readExistingShifts).mockResolvedValue([]);
    asMock(createClient).mockResolvedValue({ rpc: async () => ({ error: new Error("should not be called") }) });
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect((await res.json()).cleared).toBe(0);
  });

  it("a non-manager is refused (403)", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue({ userId: "u2", companyId: "c1", role: "Member", isAdmin: false });
    asMock(createClient).mockResolvedValue({ rpc: async () => ({ error: null }) });
    expect((await POST(req())).status).toBe(403);
  });

  it("401 unauthenticated", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue(null);
    asMock(createClient).mockResolvedValue({ rpc: async () => ({ error: null }) });
    expect((await POST(req())).status).toBe(401);
  });
});
