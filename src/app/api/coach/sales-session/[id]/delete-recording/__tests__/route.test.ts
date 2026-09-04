import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * POST /api/coach/sales-session/[id]/delete-recording — the authz contract and the deletion order.
 *
 * Two things here are worth more than the rest.
 *
 * **The rep must be refused.** This is the founder's stated rule and it is asymmetric on purpose: a recording is
 * evidence of how a call was handled, and a rep who could delete their own worst call could curate what their
 * manager sees. The sibling `save-recording` route deliberately DOES authorise the owning rep, so the two look
 * inconsistent unless the reason is pinned — hence a test that names it.
 *
 * **The bytes go before the pointer.** If the pointer were cleared first and storage then failed, the audio of a
 * real customer conversation would still exist with nothing referring to it and nothing that would ever clean it
 * up. Every failure path below therefore asserts that the row was NOT touched.
 *
 * Handler logic only (mocked storage and DB).
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/coach/v5/removeRecordingAudio", () => ({ removeRecordingAudio: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { removeRecordingAudio } from "@/lib/coach/v5/removeRecordingAudio";
import { POST } from "../route";

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const req = () => ({ headers: new Headers() }) as never;

/** Records every update the handler attempts, so "the row was not touched" is assertable. */
let updates: Record<string, unknown>[];

function setup(opts: {
  userId?: string | null;
  profile?: { company_id: string | null; role: string | null; sales_coach_role: string | null } | null;
  session?: { id: string; company_id: string; audio_asset_url: string | null } | null;
  updateReturns?: { data: { id: string }[] | null; error: { message: string } | null };
}) {
  const {
    userId = "u1",
    profile = { company_id: "c1", role: "staff", sales_coach_role: "admin" },
    session = { id: "s1", company_id: "c1", audio_asset_url: "assets-v1/c1/s1/recording.webm" },
    updateReturns = { data: [{ id: "s1" }], error: null },
  } = opts;

  updates = [];

  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null } }) },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: profile }) }) }),
    }),
  } as never);

  vi.mocked(createAdminClient).mockReturnValue({
    storage: {},
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: session }) }) }),
      update: (patch: Record<string, unknown>) => {
        updates.push(patch);
        return { eq: () => ({ eq: () => ({ select: async () => updateReturns }) }) };
      },
    }),
  } as never);
}

beforeEach(() => {
  vi.mocked(createClient).mockReset();
  vi.mocked(createAdminClient).mockReset();
  vi.mocked(removeRecordingAudio).mockReset();
  vi.mocked(removeRecordingAudio).mockResolvedValue({ ok: true, chunksRemoved: 0 });
});

describe("who may delete a recording", () => {
  it("401s a caller who is not signed in", async () => {
    setup({ userId: null });
    expect((await POST(req(), ctx("s1"))).status).toBe(401);
    expect(removeRecordingAudio).not.toHaveBeenCalled();
  });

  it("REFUSES the owning rep — the founder's rule, and the opposite of save-recording", async () => {
    // A rep who could delete their own worst call could curate what their manager sees.
    setup({ profile: { company_id: "c1", role: "staff", sales_coach_role: "staff" } });
    const res = await POST(req(), ctx("s1"));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      error: "Only a manager or an administrator can delete a recording.",
    });
    expect(removeRecordingAudio).not.toHaveBeenCalled();
    expect(updates).toHaveLength(0);
  });

  it("allows a sales-coach manager", async () => {
    setup({ profile: { company_id: "c1", role: "staff", sales_coach_role: "admin" } });
    expect((await POST(req(), ctx("s1"))).status).toBe(200);
    expect(removeRecordingAudio).toHaveBeenCalledOnce();
  });

  it("allows a company administrator", async () => {
    setup({ profile: { company_id: "c1", role: "admin", sales_coach_role: "staff" } });
    expect((await POST(req(), ctx("s1"))).status).toBe(200);
  });

  it("404s a session in another company, never a 403 that confirms it exists", async () => {
    setup({ session: { id: "s1", company_id: "OTHER", audio_asset_url: "assets-v1/x/y.webm" } });
    const res = await POST(req(), ctx("s1"));
    expect(res.status).toBe(404);
    expect(removeRecordingAudio).not.toHaveBeenCalled();
  });

  it("403s a caller with no company rather than reading anything", async () => {
    setup({ profile: { company_id: null, role: "admin", sales_coach_role: "admin" } });
    expect((await POST(req(), ctx("s1"))).status).toBe(403);
  });
});

describe("the bytes go before the pointer", () => {
  it("does NOT clear the row when storage refuses", async () => {
    setup({});
    vi.mocked(removeRecordingAudio).mockResolvedValue({
      ok: false,
      reason: "storage-failed",
      message: "permission denied",
    });
    const res = await POST(req(), ctx("s1"));
    expect(res.status).toBe(500);
    // The whole point: a cleared pointer plus live bytes is a recording nobody can find and nothing will remove.
    expect(updates).toHaveLength(0);
  });

  it("does NOT clear the row for a pointer it cannot interpret", async () => {
    setup({});
    vi.mocked(removeRecordingAudio).mockResolvedValue({ ok: false, reason: "malformed-pointer" });
    const res = await POST(req(), ctx("s1"));
    expect(res.status).toBe(409);
    expect(updates).toHaveLength(0);
  });

  it("clears the pointer AND the saved flag once the bytes are gone", async () => {
    setup({});
    const res = await POST(req(), ctx("s1"));
    expect(res.status).toBe(200);
    expect(updates).toEqual([
      {
        audio_asset_url: null,
        recording_saved: false,
        recording_saved_by: null,
        recording_saved_at: null,
      },
    ]);
  });

  it("404s rather than reporting success when the row moved between read and write", async () => {
    setup({ updateReturns: { data: [], error: null } });
    expect((await POST(req(), ctx("s1"))).status).toBe(404);
  });
});

describe("a recording that is already gone", () => {
  it("is a success, and is idempotent for a double-tap", async () => {
    setup({ session: { id: "s1", company_id: "c1", audio_asset_url: null } });
    const res = await POST(req(), ctx("s1"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deleted: true, alreadyGone: true });
    // Nothing to remove and nothing to clear — the end state the caller asked for already holds.
    expect(removeRecordingAudio).not.toHaveBeenCalled();
    expect(updates).toHaveLength(0);
  });
});
