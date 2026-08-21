import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

/**
 * POST /api/coach/meeting-session — meeting/huddle session create. Boundaries: 401 unauth; 403 no company; 400
 * on a bad body (invalid kind / missing title); happy path creates a session carrying session_kind = the chosen
 * kind; 500 (fail-honest, A34) when the insert returns null because migration 0237 isn't applied.
 */
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/auth-helpers", () => ({ getCurrentCompanyId: vi.fn(async () => "co1") }));
vi.mock("@/lib/data/salesCoach", () => ({ createSession: vi.fn(), listAgentSessions: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { createSession, listAgentSessions } from "@/lib/data/salesCoach";
import { POST, GET } from "../route";

const asMock = (fn: unknown) => fn as unknown as ReturnType<typeof vi.fn>;
function setAuth(userId: string | null) {
  asMock(createClient).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null } }) },
  });
}
function req(body: unknown): NextRequest {
  return { headers: new Headers({ "content-type": "application/json" }), json: async () => body } as unknown as NextRequest;
}
const good = { kind: "meeting", context: "in_person", title: "Weekly sync" };

beforeEach(() => {
  vi.clearAllMocks();
  setAuth("facil-1");
  asMock(getCurrentCompanyId).mockResolvedValue("co1");
  asMock(createSession).mockResolvedValue({ id: "s1", sessionKind: "meeting" });
});

describe("POST meeting-session (create)", () => {
  it("401 when unauthenticated", async () => {
    setAuth(null);
    expect((await POST(req(good))).status).toBe(401);
  });

  it("403 when there is no company context", async () => {
    asMock(getCurrentCompanyId).mockResolvedValue(null);
    expect((await POST(req(good))).status).toBe(403);
  });

  it("400 on an invalid kind or a missing title", async () => {
    expect((await POST(req({ kind: "sales", context: "in_person", title: "x" }))).status).toBe(400);
    expect((await POST(req({ kind: "meeting", context: "in_person" }))).status).toBe(400);
  });

  it("creates a session carrying the chosen session_kind", async () => {
    const res = await POST(req({ kind: "huddle", context: "video", title: "Standup" }));
    expect(res.status).toBe(200);
    expect(asMock(createSession).mock.calls[0]?.[0].sessionKind).toBe("huddle");
    expect(asMock(createSession).mock.calls[0]?.[0].clientLabel).toBe("Standup");
  });

  it("500 (fail-honest) when the insert returns null — 0237 likely unapplied", async () => {
    asMock(createSession).mockResolvedValue(null);
    expect((await POST(req(good))).status).toBe(500);
  });
});

describe("GET meeting-session (list)", () => {
  it("401 when unauthenticated", async () => {
    setAuth(null);
    expect((await GET()).status).toBe(401);
  });

  it("returns only meeting/huddle sessions, filtering out sales", async () => {
    asMock(listAgentSessions).mockResolvedValue([
      { id: "m1", clientLabel: "Sync", sessionKind: "meeting", startedAt: "2026-08-22T00:00:00Z", endedAt: null },
      { id: "s1", clientLabel: "Deal", sessionKind: "sales", startedAt: "2026-08-21T00:00:00Z", endedAt: null },
      { id: "h1", clientLabel: "Standup", sessionKind: "huddle", startedAt: "2026-08-20T00:00:00Z", endedAt: null },
    ]);
    const json = await (await GET()).json();
    expect(json.meetings.map((m: { id: string }) => m.id)).toEqual(["m1", "h1"]);
    expect(json.meetings[0]).toMatchObject({ id: "m1", title: "Sync", kind: "meeting" });
  });
});
