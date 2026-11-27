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
const upd = vi.hoisted(() => ({ calls: [] as Array<{ patch: unknown; filters: string[] }>, error: null as unknown }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (t: string) => ({
      update: (patch: unknown) => {
        const filters: string[] = [`table:${t}`];
        const b = {
          eq: (c: string, v: unknown) => (filters.push(`${c}=${String(v)}`), b),
          is: (c: string, v: unknown) => {
            filters.push(`${c} is ${String(v)}`);
            upd.calls.push({ patch, filters });
            return Promise.resolve({ error: upd.error });
          },
        };
        return b;
      },
    }),
  }),
}));

import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/data/salesCoach";
import { uploadAssetBytes } from "@/lib/storage/assets";
import { POST } from "../route";

const OWNER = "rep-1";
const STARTED = "2026-11-21T10:00:00.000Z";
const START_MS = Date.parse(STARTED);
function setAuth(userId: string | null) {
  (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null } }) },
  });
}
function req(opts: { seq?: string; bytes?: number; recStart?: number } = {}): NextRequest {
  const qs = `seq=${opts.seq ?? "0"}${opts.recStart !== undefined ? `&recStart=${opts.recStart}` : ""}`;
  return {
    nextUrl: { searchParams: new URLSearchParams(qs) },
    headers: new Headers({ "content-type": "audio/webm" }),
    arrayBuffer: async () => new ArrayBuffer(opts.bytes ?? 128),
  } as unknown as NextRequest;
}
const ctx = { params: Promise.resolve({ id: "s1" }) };

beforeEach(() => {
  vi.clearAllMocks();
  setAuth(OWNER);
  (getSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "s1", agentId: OWNER, startedAt: STARTED });
  upd.calls = [];
  upd.error = null;
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

  it("six-hour cap (F5.7): audio from a recorder that started over six hours (+ grace) ago is refused, not stored", async () => {
    const longAgo = new Date(Date.now() - (6 * 60 + 20) * 60_000).toISOString();
    (getSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "s1", agentId: OWNER, startedAt: longAgo, audioStartedAt: longAgo });
    const r = await POST(req({ seq: "1500" }), ctx);
    expect(r.status).toBe(409);
    expect((await r.json()).capped).toBe(true);
    expect(uploadAssetBytes).not.toHaveBeenCalled();
  });
  it("a session made long before it records still takes its first chunk (the cap counts from the recorder's start)", async () => {
    const longAgo = new Date(Date.now() - 10 * 3_600_000).toISOString();
    (getSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "s1", agentId: OWNER, startedAt: longAgo, audioStartedAt: null });
    expect((await POST(req({ seq: "0" }), ctx)).status).toBe(200);
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

// 0300: chunk 0 carries the recorder's start on the browser clock spokenAt uses, stored once as audio_started_at.
describe("POST audio-chunk — the recorder start (0300)", () => {
  it("chunk 0 with a plausible recStart stores it once: company-scoped, only while unset", async () => {
    const late = START_MS + 56_000; // the production case: a recorder ~56 s after the session row
    const res = await POST(req({ seq: "0", recStart: late }), ctx);
    expect(res.status).toBe(200);
    expect(upd.calls).toEqual([
      { patch: { audio_started_at: new Date(late).toISOString() }, filters: ["table:coaching_sessions", "id=s1", "company_id=co1", "audio_started_at is null"] },
    ]);
  });
  it("a recStart more than an hour from started_at is not a recorder start — ignored", async () => {
    await POST(req({ seq: "0", recStart: START_MS + 2 * 3600_000 }), ctx);
    expect(upd.calls).toEqual([]);
  });
  it("only chunk 0 sets it, and a chunk without recStart sets nothing", async () => {
    await POST(req({ seq: "3", recStart: START_MS + 1000 }), ctx);
    await POST(req({ seq: "0" }), ctx);
    expect(upd.calls).toEqual([]);
  });
  it("a failed write never fails the chunk (the audio is what must not be lost)", async () => {
    upd.error = { code: "XX000", message: "boom" };
    const res = await POST(req({ seq: "0", recStart: START_MS + 1000 }), ctx);
    expect(res.status).toBe(200);
  });
});

