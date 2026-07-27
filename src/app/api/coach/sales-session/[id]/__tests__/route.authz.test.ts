import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * PATCH /api/coach/sales-session/[id] — authz contract (pins the 2026-07-15 fix
 * 6d7938d + the deliberate distinction from the write-authz audit).
 *
 *   - RENAME (clientLabel) is OWNER-ONLY: getSession is company-scoped ("a member
 *     sees any session in their company"), which is the right bar for a manager
 *     STATUS transition but NOT for a rename. A non-owner rename must 403, or any
 *     company member could relabel a colleague's session via a crafted PATCH (the
 *     UI already owner-gates it; this proves the API does too).
 *   - STATUS (ended/reviewed) stays company-scoped ON PURPOSE — a manager ending
 *     or reviewing a rep's session is an intended workflow. A non-owner status
 *     change must still succeed.
 *
 * Handler logic only (mocked DB); runtime against a live row is separate.
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/data/salesCoach", () => ({
  getSession: vi.fn(),
  renameSession: vi.fn(),
  setSessionStatus: vi.fn(),
  getSessionTranscript: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";
import { getSession, renameSession, setSessionStatus } from "@/lib/data/salesCoach";
import { PATCH } from "../route";

function mockAuth(userId: string | null) {
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null } }) },
  } as never);
}
function req(body: unknown) {
  return { json: async () => body } as never;
}
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.mocked(createClient).mockReset();
  vi.mocked(getSession).mockReset();
  vi.mocked(renameSession).mockReset();
  vi.mocked(setSessionStatus).mockReset();
});

describe("rename is owner-only", () => {
  it("403s a non-owner rename and never touches the DB", async () => {
    mockAuth("intruder");
    vi.mocked(getSession).mockResolvedValue({ id: "s1", agentId: "owner" } as never);
    const res = await PATCH(req({ clientLabel: "angry customer" }), ctx("s1"));
    expect(res.status).toBe(403);
    expect(renameSession).not.toHaveBeenCalled();
  });

  it("lets the owner rename their own session", async () => {
    mockAuth("owner");
    vi.mocked(getSession).mockResolvedValue({ id: "s1", agentId: "owner" } as never);
    vi.mocked(renameSession).mockResolvedValue({ id: "s1", clientLabel: "angry customer" } as never);
    const res = await PATCH(req({ clientLabel: "angry customer" }), ctx("s1"));
    expect(res.status).toBe(200);
    expect(renameSession).toHaveBeenCalledWith("s1", "angry customer");
  });
});

describe("status transition stays company-scoped (intentional manager workflow)", () => {
  it("lets a non-owner (manager) end a rep's session", async () => {
    mockAuth("manager");
    vi.mocked(getSession).mockResolvedValue({ id: "s1", agentId: "rep" } as never);
    vi.mocked(setSessionStatus).mockResolvedValue({ id: "s1", status: "ended" } as never);
    const res = await PATCH(req({ status: "ended" }), ctx("s1"));
    expect(res.status).toBe(200);
    expect(setSessionStatus).toHaveBeenCalled();
    // A pure status change must NOT be blocked by the rename owner-check.
    expect(renameSession).not.toHaveBeenCalled();
  });
});

describe("retention-hole guard: a status PATCH never writes an audio pointer (regression, e52363bf)", () => {
  it("does NOT forward a smuggled full-URL audioAssetUrl to setSessionStatus", async () => {
    // The PATCH zod used to carry `audioAssetUrl: z.string().url()` — whose
    // full-URL shape the recording-purge cron cannot delete (it flags it
    // `malformed` and leaves the bytes), silently breaking the 2-day deletion
    // promise. That write path was removed. This locks it: even when the body
    // tries to smuggle a full URL, the status transition must reach
    // setSessionStatus WITHOUT any audio pointer, so no unpurgeable
    // audio_asset_url can ever be written through this route.
    mockAuth("manager");
    vi.mocked(getSession).mockResolvedValue({ id: "s1", agentId: "rep" } as never);
    vi.mocked(setSessionStatus).mockResolvedValue({ id: "s1", status: "ended" } as never);
    const res = await PATCH(
      req({ status: "ended", audioAssetUrl: "https://evil.example/orphan.mp3" }),
      ctx("s1")
    );
    expect(res.status).toBe(200);
    const callArg = vi.mocked(setSessionStatus).mock.calls[0]?.[0] ?? {};
    expect(callArg).not.toHaveProperty("audioAssetUrl");
  });
});

describe("gate + validation", () => {
  it("401s an anonymous caller", async () => {
    mockAuth(null);
    vi.mocked(getSession).mockResolvedValue({ id: "s1", agentId: "owner" } as never);
    const res = await PATCH(req({ status: "ended" }), ctx("s1"));
    expect(res.status).toBe(401);
  });

  it("404s when the session isn't visible", async () => {
    mockAuth("u1");
    vi.mocked(getSession).mockResolvedValue(null as never);
    const res = await PATCH(req({ status: "ended" }), ctx("nope"));
    expect(res.status).toBe(404);
  });

  it("400s an empty patch (neither status nor label)", async () => {
    mockAuth("u1");
    const res = await PATCH(req({}), ctx("s1"));
    expect(res.status).toBe(400);
  });
});
