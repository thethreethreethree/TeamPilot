import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

/**
 * POST /api/coach/meeting-session/[id]/end — marks a meeting ENDED on Stop (so ended_at ≈ now, not +6h from the
 * cron). 401/404/403(non-owner)/400(sales); no-op when already ended; happy path transitions active→ended.
 */
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/auth-helpers", () => ({ getCurrentCompanyId: vi.fn(async () => "co1") }));
vi.mock("@/lib/data/salesCoach", () => ({ getSession: vi.fn(), setSessionStatus: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { getSession, setSessionStatus } from "@/lib/data/salesCoach";
import { POST } from "../route";

const OWNER = "facil-1";
const asMock = (fn: unknown) => fn as unknown as ReturnType<typeof vi.fn>;
function setAuth(userId: string | null) {
  asMock(createClient).mockResolvedValue({ auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null } }) } });
}
const req = () => ({}) as unknown as NextRequest;
const ctx = { params: Promise.resolve({ id: "s1" }) };

beforeEach(() => {
  vi.clearAllMocks();
  setAuth(OWNER);
  asMock(getSession).mockResolvedValue({ id: "s1", agentId: OWNER, sessionKind: "meeting", status: "active" });
  asMock(setSessionStatus).mockResolvedValue({ id: "s1" });
});

describe("POST meeting-session end", () => {
  it("401 unauthenticated", async () => { setAuth(null); expect((await POST(req(), ctx)).status).toBe(401); });

  it("404 when the session isn't found", async () => {
    asMock(getSession).mockResolvedValue(null);
    expect((await POST(req(), ctx)).status).toBe(404);
  });

  it("403 for a non-owner", async () => {
    asMock(getSession).mockResolvedValue({ id: "s1", agentId: "someone", sessionKind: "meeting", status: "active" });
    expect((await POST(req(), ctx)).status).toBe(403);
    expect(setSessionStatus).not.toHaveBeenCalled();
  });

  it("400 for a sales session", async () => {
    asMock(getSession).mockResolvedValue({ id: "s1", agentId: OWNER, sessionKind: "sales", status: "active" });
    expect((await POST(req(), ctx)).status).toBe(400);
  });

  it("no-ops when the session is already ended (no re-stamp)", async () => {
    asMock(getSession).mockResolvedValue({ id: "s1", agentId: OWNER, sessionKind: "huddle", status: "ended" });
    const json = await (await POST(req(), ctx)).json();
    expect(json).toMatchObject({ ok: true, alreadyEnded: true });
    expect(setSessionStatus).not.toHaveBeenCalled();
  });

  it("transitions an active meeting to ended", async () => {
    const json = await (await POST(req(), ctx)).json();
    expect(json).toMatchObject({ ok: true });
    expect(asMock(setSessionStatus).mock.calls[0]?.[0]).toMatchObject({ sessionId: "s1", status: "ended", actorId: OWNER });
  });
});
