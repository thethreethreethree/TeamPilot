import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

/**
 * POST /api/coach/sales-session/door-log/audio-chunk — the DoorLog pitch recording durability endpoint (founder
 * 2026-08-22). Unlike the live /audio-chunk, the chunks upload BEFORE the pitch row exists, so there is no
 * session/owner to check — the boundary is authenticated + the storage path pinned to the caller's OWN company
 * and a shape-validated recordingId (no path smuggling). Boundaries locked: 401 unauth; 403 no company; 400 on
 * a bad rid / bad seq / empty body; happy path writes `${companyId}/doorlog/${rid}/chunks/${seq}.webm`.
 */
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/auth-helpers", () => ({ getCurrentCompanyId: vi.fn(async () => "co1") }));
vi.mock("@/lib/storage/assets", () => ({ uploadAssetBytes: vi.fn(async () => ({ ok: true })) }));

import { createClient } from "@/lib/supabase/server";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { uploadAssetBytes } from "@/lib/storage/assets";
import { POST } from "../route";

const RID = "abcd1234-5678-90ab-cdef-1234567890ab";
function setAuth(userId: string | null) {
  (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null } }) },
  });
}
function req(opts: { rid?: string; seq?: string; bytes?: number } = {}): NextRequest {
  const rid = opts.rid ?? RID;
  const seq = opts.seq ?? "0";
  return {
    nextUrl: { searchParams: new URLSearchParams(`rid=${rid}&seq=${seq}`) },
    headers: new Headers({ "content-type": "audio/webm" }),
    arrayBuffer: async () => new ArrayBuffer(opts.bytes ?? 128),
  } as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  setAuth("rep-1");
  (getCurrentCompanyId as unknown as ReturnType<typeof vi.fn>).mockResolvedValue("co1");
});

describe("POST door-log audio-chunk", () => {
  it("401 when unauthenticated", async () => {
    setAuth(null);
    expect((await POST(req())).status).toBe(401);
  });

  it("403 when there is no company context", async () => {
    (getCurrentCompanyId as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    expect((await POST(req())).status).toBe(403);
    expect(uploadAssetBytes).not.toHaveBeenCalled();
  });

  it("400 on a path-smuggling / malformed recordingId — never touches storage", async () => {
    expect((await POST(req({ rid: "../evil" }))).status).toBe(400);
    expect((await POST(req({ rid: "a/b" }))).status).toBe(400);
    expect((await POST(req({ rid: "short" }))).status).toBe(400);
    expect(uploadAssetBytes).not.toHaveBeenCalled();
  });

  it("400 on a non-numeric seq and on an empty body", async () => {
    expect((await POST(req({ seq: "x" }))).status).toBe(400);
    expect((await POST(req({ bytes: 0 }))).status).toBe(400);
  });

  it("stores the chunk at the company/recordingId/seq-pinned path on the happy path", async () => {
    const res = await POST(req({ seq: "3" }));
    expect(res.status).toBe(200);
    expect(uploadAssetBytes).toHaveBeenCalledTimes(1);
    const arg = (uploadAssetBytes as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(arg?.storagePath).toBe(`co1/doorlog/${RID}/chunks/3.webm`);
  });
});
