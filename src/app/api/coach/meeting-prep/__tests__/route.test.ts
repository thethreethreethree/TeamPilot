import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

/** POST /api/coach/meeting-prep — create a draft prep. 401 unauth / 403 no company / 200 with the prep. */
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/auth-helpers", () => ({ getCurrentCompanyId: vi.fn(async () => "co1") }));
vi.mock("@/lib/data/meetingPrep", () => ({
  createMeetingPrep: vi.fn(async () => ({ id: "p1", companyId: "co1", createdBy: "u1", goal: "", topics: [], status: "draft", sessionId: null })),
}));

import { createClient } from "@/lib/supabase/server";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { POST } from "../route";

function setAuth(userId: string | null) {
  (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null } }) },
  });
}
const req = {} as unknown as NextRequest;

beforeEach(() => {
  vi.clearAllMocks();
  setAuth("u1");
  (getCurrentCompanyId as unknown as ReturnType<typeof vi.fn>).mockResolvedValue("co1");
});

describe("POST meeting-prep (create)", () => {
  it("401 when unauthenticated", async () => {
    setAuth(null);
    expect((await POST(req)).status).toBe(401);
  });
  it("403 when no company context", async () => {
    (getCurrentCompanyId as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    expect((await POST(req)).status).toBe(403);
  });
  it("200 returns a draft prep", async () => {
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ prep: { id: "p1", status: "draft" } });
  });
});
