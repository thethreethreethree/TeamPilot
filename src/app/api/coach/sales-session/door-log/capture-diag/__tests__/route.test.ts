import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * capture-diag endpoint (founder 2026-08-23) — records WHY a DoorLog pitch produced no audio so the cause is on
 * the record, not assumed. Gate: authenticated + company-PINNED (the event's company_id is the caller's own, never
 * client-supplied — INV15), a bounded/validated diag body, and best-effort (a store failure never surfaces).
 */
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/auth-helpers", () => ({ getCurrentCompanyId: vi.fn(async () => "co1") }));
const inserted: Array<Record<string, unknown>> = [];
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({ insert: async (row: Record<string, unknown>) => { inserted.push(row); return { error: null }; } }),
  }),
}));

import { createClient } from "@/lib/supabase/server";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { POST } from "../route";

const setAuth = (user: { id: string } | null) =>
  (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user } }) },
  });
const req = (body: unknown) => ({ json: async () => body }) as unknown as Parameters<typeof POST>[0];
const DIAG = { sawData: false, chunkCount: 0, chunksUploaded: 0, durationMs: 42000, mimeType: "audio/mp4", recorderError: null, trackEnded: true, trackMuted: false, trackReadyState: "ended", wakeLockGranted: false, hiddenDuringRecording: 1, ua: "iPhone Safari" };

beforeEach(() => {
  vi.clearAllMocks();
  inserted.length = 0;
  setAuth({ id: "rep1" });
  (getCurrentCompanyId as unknown as ReturnType<typeof vi.fn>).mockResolvedValue("co1");
});

describe("POST /door-log/capture-diag", () => {
  it("appends a doorlog.capture_failed event with the caller's company pinned + the diag payload", async () => {
    const res = await POST(req({ localDate: "2026-08-23", diag: DIAG }));
    expect(res.status).toBe(200);
    expect(inserted).toHaveLength(1);
    const row = inserted[0]!;
    expect(row.kind).toBe("doorlog.capture_failed");
    expect(row.company_id).toBe("co1"); // pinned server-side (INV15), never from the client body
    expect(row.actor).toBe("rep1");
    expect((row.payload as Record<string, unknown>).trackEnded).toBe(true);
    expect((row.payload as Record<string, unknown>).localDate).toBe("2026-08-23");
  });

  it("401 when not authenticated (no diag written)", async () => {
    setAuth(null);
    const res = await POST(req({ diag: DIAG }));
    expect(res.status).toBe(401);
    expect(inserted).toHaveLength(0);
  });

  it("403 when there is no company context", async () => {
    (getCurrentCompanyId as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const res = await POST(req({ diag: DIAG }));
    expect(res.status).toBe(403);
    expect(inserted).toHaveLength(0);
  });

  it("400 on a malformed body (bounded/validated — no arbitrary payload stored)", async () => {
    const res = await POST(req({ diag: { ua: 123 } }));
    expect(res.status).toBe(400);
    expect(inserted).toHaveLength(0);
  });
});
