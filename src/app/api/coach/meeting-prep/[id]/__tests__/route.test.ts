import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

/**
 * GET/PATCH /api/coach/meeting-prep/[id]. GET returns prep + documents (404 for a non-owner via RLS-null).
 * PATCH updates goal/topics (404 when the RLS-scoped update matches nothing).
 */
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/data/meetingPrep", () => ({
  getMeetingPrep: vi.fn(),
  updateMeetingPrep: vi.fn(),
  listPrepDocuments: vi.fn(async () => []),
}));

import { createClient } from "@/lib/supabase/server";
import { getMeetingPrep, updateMeetingPrep } from "@/lib/data/meetingPrep";
import { GET, PATCH } from "../route";

function setAuth(userId: string | null) {
  (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null } }) },
  });
}
function req(body?: unknown): NextRequest {
  return { json: async () => body ?? {}, headers: new Headers({ "content-type": "application/json" }) } as unknown as NextRequest;
}
const ctx = { params: Promise.resolve({ id: "p1" }) };

beforeEach(() => {
  vi.clearAllMocks();
  setAuth("u1");
});

describe("meeting-prep [id]", () => {
  it("GET 404 for a non-owner (RLS-scoped read is null)", async () => {
    (getMeetingPrep as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    expect((await GET(req(), ctx)).status).toBe(404);
  });
  it("GET 200 returns prep + documents", async () => {
    (getMeetingPrep as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "p1", goal: "g", topics: [] });
    const res = await GET(req(), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ prep: { id: "p1" }, documents: [] });
  });
  it("PATCH updates goal + topics", async () => {
    (updateMeetingPrep as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "p1", goal: "new", topics: [{ id: "t1", text: "pricing", covered: false }] });
    const res = await PATCH(req({ goal: "new", topics: [{ id: "t1", text: "pricing", covered: false }] }), ctx);
    expect(res.status).toBe(200);
    expect((updateMeetingPrep as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toMatchObject({ prepId: "p1", goal: "new" });
  });
  it("PATCH 404 when the RLS-scoped update matches nothing (not owner)", async () => {
    (updateMeetingPrep as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    expect((await PATCH(req({ goal: "x" }), ctx)).status).toBe(404);
  });
});
