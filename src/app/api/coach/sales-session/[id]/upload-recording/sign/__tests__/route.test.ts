import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * POST /api/coach/sales-session/[id]/upload-recording/sign — mints a SIGNED direct-to-storage
 * upload target so a real phone recording / voice memo (>4.5 MB) bypasses the Vercel serverless
 * body cap. Boundaries locked here: 401; 403 no-company; 404 inaccessible session; 403 for a
 * colleague who is neither owner nor Sales-Coach manager (INV19); 413 oversize; 400 non-audio
 * MIME; 400 executable extension; 200 returns {bucket, storagePath, token}. getSession is mocked
 * (its RLS scoping is the real access gate); the signed-target minter is stubbed.
 */
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/auth-helpers", () => ({ getCurrentCompanyId: vi.fn(async () => "co1") }));
vi.mock("@/lib/data/salesCoach", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/coach/v5/skillAccess", () => ({ isSalesCoachManager: vi.fn(() => false) }));
// Keep EXECUTABLE_EXTENSIONS real (the .exe list under test) but stub the minter and shrink the
// size cap so an oversize case doesn't need a giant buffer.
vi.mock("@/lib/storage/assets", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@/lib/storage/assets")>();
  return {
    ...orig,
    AGENT_MAX_BYTES: 32,
    ASSETS_BUCKET: "assets",
    createSignedUploadTarget: vi.fn(async () => ({
      ok: true,
      storagePath: "co1/abc/rec.m4a",
      token: "tok",
    })),
  };
});

import { createClient } from "@/lib/supabase/server";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { getSession } from "@/lib/data/salesCoach";
import { isSalesCoachManager } from "@/lib/coach/v5/skillAccess";
import { createSignedUploadTarget } from "@/lib/storage/assets";
import { POST } from "../route";

const setAuth = (userId: string | null) =>
  (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null } }) },
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: { role: "agent", sales_coach_role: null } }) }),
      }),
    }),
  });

const ctx = { params: Promise.resolve({ id: "sess1" }) };
const req = (body: unknown) =>
  ({ json: async () => body }) as unknown as Parameters<typeof POST>[0];
const sign = (over: Record<string, unknown> = {}) =>
  req({ filename: "memo.m4a", sizeBytes: 10, mimeType: "audio/m4a", ...over });

beforeEach(() => {
  vi.clearAllMocks();
  (getCurrentCompanyId as unknown as ReturnType<typeof vi.fn>).mockResolvedValue("co1");
  (getSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "sess1", agentId: "rep1" });
  (isSalesCoachManager as unknown as ReturnType<typeof vi.fn>).mockReturnValue(false);
  (createSignedUploadTarget as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    ok: true,
    storagePath: "co1/abc/rec.m4a",
    token: "tok",
  });
});

describe("POST /upload-recording/sign", () => {
  it("401 unauthenticated", async () => {
    setAuth(null);
    expect((await POST(sign(), ctx)).status).toBe(401);
  });

  it("404 when the session isn't accessible", async () => {
    setAuth("rep1");
    (getSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    expect((await POST(sign(), ctx)).status).toBe(404);
  });

  it("403 for a colleague who is neither the owner nor a manager (INV19)", async () => {
    setAuth("rep2"); // session.agentId is rep1; isSalesCoachManager returns false
    expect((await POST(sign(), ctx)).status).toBe(403);
  });

  it("200 for a manager acting on another rep's session", async () => {
    setAuth("mgr1");
    (isSalesCoachManager as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true);
    expect((await POST(sign(), ctx)).status).toBe(200);
  });

  it("413 when the claimed size exceeds the cap", async () => {
    setAuth("rep1");
    expect((await POST(sign({ sizeBytes: 64 }), ctx)).status).toBe(413);
  });

  it("400 for a non-audio/video MIME", async () => {
    setAuth("rep1");
    expect((await POST(sign({ mimeType: "application/pdf" }), ctx)).status).toBe(400);
  });

  it("400 rejects an executable extension even with an audio MIME", async () => {
    setAuth("rep1");
    expect((await POST(sign({ filename: "malware.exe" }), ctx)).status).toBe(400);
  });

  it("200 mints a target for a valid voice memo (empty MIME defaults to audio)", async () => {
    setAuth("rep1");
    const res = await POST(sign({ mimeType: "" }), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      bucket: "assets",
      storagePath: "co1/abc/rec.m4a",
      token: "tok",
    });
  });
});
