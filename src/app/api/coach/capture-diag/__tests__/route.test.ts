import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Generic coach capture-diag endpoint (capture-blindness sweep, founder 2026-08-23) — records WHY a live / meeting
 * / C.A.R.E recorder produced no audio. Gate: authenticated + company-PINNED (INV15), a bounded/validated body,
 * subject scoped to the session when present, and best-effort (a store failure never surfaces).
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
const DIAG = { sawData: false, trackEnded: true, ua: "iPhone" };

beforeEach(() => {
  vi.clearAllMocks();
  inserted.length = 0;
  setAuth({ id: "rep1" });
  (getCurrentCompanyId as unknown as ReturnType<typeof vi.fn>).mockResolvedValue("co1");
});

describe("POST /api/coach/capture-diag", () => {
  it("appends coach.capture_failed scoped to the SESSION, company pinned + surface tagged", async () => {
    const res = await POST(req({ surface: "live", sessionId: "s9", diag: DIAG }));
    expect(res.status).toBe(200);
    expect(inserted).toHaveLength(1);
    const row = inserted[0]!;
    expect(row.kind).toBe("coach.capture_failed");
    expect(row.company_id).toBe("co1"); // INV15 — pinned, never client-supplied
    expect(row.subject).toBe("coaching_session:s9");
    const payload = row.payload as Record<string, unknown>;
    expect(payload.surface).toBe("live");
    expect(payload.trackEnded).toBe(true);
  });

  it("PERSISTS capturedBytes — the stub-vs-real-audio signal (was stripped by the schema; A30 drift guard)", async () => {
    // buildCaptureDiag always emits capturedBytes; the door-log twin route was fixed to keep it, this one was missed.
    // A tiny capturedBytes with sawData=true is the exact iOS-stub fingerprint the whole capture-diag system exists
    // to record — if the schema strips it, live/meeting/care diagnosis goes blind on the one field that matters.
    const res = await POST(req({ surface: "meeting", sessionId: "s1", diag: { sawData: true, capturedBytes: 5, chunksUploaded: 0 } }));
    expect(res.status).toBe(200);
    const payload = inserted[0]!.payload as Record<string, unknown>;
    expect(payload.capturedBytes).toBe(5); // survived the schema, not stripped to undefined
  });

  it("scopes to the REP when there is no sessionId (e.g. C.A.R.E)", async () => {
    const res = await POST(req({ surface: "care", diag: DIAG }));
    expect(res.status).toBe(200);
    expect(inserted[0]!.subject).toBe("rep:rep1");
  });

  it("401 unauthenticated, 403 no-company — no write in either", async () => {
    setAuth(null);
    expect((await POST(req({ surface: "live", diag: DIAG }))).status).toBe(401);
    setAuth({ id: "rep1" });
    (getCurrentCompanyId as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    expect((await POST(req({ surface: "live", diag: DIAG }))).status).toBe(403);
    expect(inserted).toHaveLength(0);
  });

  it("400 on an unknown surface / malformed body", async () => {
    expect((await POST(req({ surface: "hacker", diag: DIAG }))).status).toBe(400);
    expect((await POST(req({ surface: "live", diag: { ua: 5 } }))).status).toBe(400);
    expect(inserted).toHaveLength(0);
  });
});
