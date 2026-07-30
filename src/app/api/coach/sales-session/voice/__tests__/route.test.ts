import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * POST /api/coach/sales-session/voice — sets the company's live-cue voice (shared team config). Manager-write
 * boundary: a rep can't change the team's voice, and the write's company_id comes from AUTH (not the client),
 * so it can't be aimed at another tenant. isSalesCoachManager is the real predicate; the upsert is captured.
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { POST } from "../route";

const setCaller = (userId: string | null, profile: unknown) =>
  (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null } }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: profile }) }) }) }),
  });

const captured: { upsert?: unknown } = {};
const mockAdmin = () =>
  (createAdminClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    from: () => ({
      upsert: async (payload: unknown) => {
        captured.upsert = payload;
        return { error: null };
      },
    }),
  });

const postReq = (body: unknown) => ({ json: async () => body }) as unknown as Parameters<typeof POST>[0];
const REP = { role: "member", company_id: "co1", sales_coach_role: null };
const MANAGER = { role: "admin", company_id: "co1", sales_coach_role: null };

beforeEach(() => {
  vi.clearAllMocks();
  captured.upsert = undefined;
  mockAdmin();
});

describe("POST /voice — manager write gate", () => {
  it("403 for a rep, and NO voice write happens", async () => {
    setCaller("rep1", REP);
    const res = await POST(postReq({ voiceId: "voice_abc" }));
    expect(res.status).toBe(403);
    expect(captured.upsert).toBeUndefined();
  });

  it("200 for a manager, writing under the caller's OWN company_id (auth-derived, not client)", async () => {
    setCaller("boss", MANAGER);
    const res = await POST(postReq({ voiceId: "voice_abc" }));
    expect(res.status).toBe(200);
    expect(captured.upsert).toMatchObject({ company_id: "co1", sales_coach_voice_id: "voice_abc" });
  });
});
