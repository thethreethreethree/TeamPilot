import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

/**
 * POST /api/coach/sales-session/[id]/audio-chunk — the incremental-recording durability endpoint (founder
 * 2026-08-21). Boundaries locked: 401 unauthenticated; 404 inaccessible session; 403 for a non-owner (only
 * the session's own rep uploads its recording — mirrors /segments); 400 on a bad seq / empty body; and on the
 * happy path a service-role storage write pinned to `${companyId}/${sessionId}/chunks/${seq}.webm`.
 */
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/auth-helpers", () => ({ getCurrentCompanyId: vi.fn(async () => "co1") }));
vi.mock("@/lib/data/salesCoach", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/storage/assets", () => ({ uploadAssetBytes: vi.fn(async () => ({ ok: true })) }));

import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/data/salesCoach";
import { uploadAssetBytes } from "@/lib/storage/assets";
import { POST } from "../route";

const OWNER = "rep-1";
function setAuth(userId: string | null) {
  (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null } }) },
  });
}
function req(opts: { seq?: string; bytes?: number } = {}): NextRequest {
  return {
    nextUrl: { searchParams: new URLSearchParams(opts.seq !== undefined ? `seq=${opts.seq}` : "seq=0") },
    headers: new Headers({ "content-type": "audio/webm" }),
    arrayBuffer: async () => new ArrayBuffer(opts.bytes ?? 128),
  } as unknown as NextRequest;
}
const ctx = { params: Promise.resolve({ id: "s1" }) };

beforeEach(() => {
  vi.clearAllMocks();
  setAuth(OWNER);
  (getSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "s1", agentId: OWNER });
});

describe("POST audio-chunk", () => {
  it("401 when unauthenticated", async () => {
    setAuth(null);
    expect((await POST(req(), ctx)).status).toBe(401);
  });

  it("404 when the session isn't found/accessible", async () => {
    (getSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    expect((await POST(req(), ctx)).status).toBe(404);
  });

  it("403 for a colleague who is not the session's owner", async () => {
    (getSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "s1", agentId: "someone-else" });
    expect((await POST(req(), ctx)).status).toBe(403);
    expect(uploadAssetBytes).not.toHaveBeenCalled();
  });

  it("400 on a non-numeric seq and on an empty body", async () => {
    expect((await POST(req({ seq: "x" }), ctx)).status).toBe(400);
    expect((await POST(req({ bytes: 0 }), ctx)).status).toBe(400);
  });

  it("stores the chunk at the company/session/seq-pinned path on the happy path", async () => {
    const res = await POST(req({ seq: "3" }), ctx);
    expect(res.status).toBe(200);
    expect(uploadAssetBytes).toHaveBeenCalledTimes(1);
    const arg = (uploadAssetBytes as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(arg?.storagePath).toBe("co1/s1/chunks/3.webm");
  });
});
