import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * POST /api/coach/sales-session/pitch-score/override.
 *
 * The status codes are the least interesting thing here. An override is the one write in this
 * feature that lets a human move a number on a leaderboard, so every test below is about a way
 * that power could be exercised by someone who should not have it, or against a pitch that is not
 * theirs — each of which succeeds silently if the gate is missing.
 *
 *   1. Manager-only, and it CANNOT be delegated to RLS. The write runs through a SECURITY DEFINER
 *      RPC with the service role, which bypasses RLS by definition, so a missing check here is a
 *      rep editing their own score with no policy left to stop them.
 *   2. The tenant is proven on the way IN. The pitch is read with the service role, which has no
 *      RLS, so nothing but the explicit company_id comparison stops a manager correcting a score
 *      in another company by guessing a uuid.
 *   3. companyId and actorId come from the PROVEN session, never the body. A body-supplied actor
 *      is an override logged against somebody who did not make it — which destroys the audit
 *      trail the whole feature exists to create.
 *   4. A blind override is refused. If the evidence cannot be read, the correction does not
 *      happen: recomputing from a pitch you could not load is guessing.
 */

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/api/requireSalesCoachManager", () => ({ requireSalesCoachManager: vi.fn() }));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: vi.fn(() => null) }));
vi.mock("@/lib/coach/pitchScore/readPitchScore", () => ({ readPitchScore: vi.fn() }));
vi.mock("@/lib/coach/pitchScore/applyOverride", () => ({ applyOverride: vi.fn() }));

import { createAdminClient } from "@/lib/supabase/admin";
import { requireSalesCoachManager } from "@/lib/api/requireSalesCoachManager";
import { rateLimit } from "@/lib/api/rateLimit";
import { readPitchScore } from "@/lib/coach/pitchScore/readPitchScore";
import { applyOverride } from "@/lib/coach/pitchScore/applyOverride";
import { POST } from "../route";

const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

const PITCH_ID = "22222222-2222-4222-8222-222222222222";
const SESSION_ID = "33333333-3333-4333-8333-333333333333";

const BODY = {
  pitchId: PITCH_ID,
  itemType: "element",
  itemId: "close.paperwork",
  newValue: "hit",
  reason: "Listened back — they moved straight to customer info at 8:44.",
};

const req = (body: unknown = BODY) =>
  new Request("https://x.test/api/coach/sales-session/pitch-score/override", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as never;

/** The service-role read of pitch_scores. */
const mockPitchRow = (row: unknown, error: { message: string } | null = null) => {
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.eq = () => chain;
  chain.maybeSingle = async () => ({ data: row, error });
  asMock(createAdminClient).mockReturnValue({ from: () => chain });
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  asMock(rateLimit).mockReturnValue(null);
  asMock(requireSalesCoachManager).mockResolvedValue({ companyId: "co1", userId: "mgr1" });
  mockPitchRow({ id: PITCH_ID, company_id: "co1", session_id: SESSION_ID });
  asMock(readPitchScore).mockResolvedValue({ id: PITCH_ID, elements: [], events: [] });
  asMock(applyOverride).mockResolvedValue({
    ok: true,
    overrideId: "ovr-1",
    base: 45,
    total: 65,
    qualifying: true,
  });
});

describe("only a manager can move a score", () => {
  it("refuses a rep, and writes nothing", async () => {
    asMock(requireSalesCoachManager).mockResolvedValue(null);
    const res = await POST(req());
    expect(res.status).toBe(403);
    // The assertion that matters: not the status, but that the write never ran. The RPC is
    // service-role and bypasses RLS, so reaching it at all is the breach.
    expect(applyOverride).not.toHaveBeenCalled();
  });

  it("refuses before spending anything when rate limited", async () => {
    asMock(rateLimit).mockReturnValue(new Response(null, { status: 429 }));
    const res = await POST(req());
    expect(res.status).toBe(429);
    expect(requireSalesCoachManager).not.toHaveBeenCalled();
    expect(applyOverride).not.toHaveBeenCalled();
  });
});

describe("the tenant is proven on the way in", () => {
  it("will not correct a pitch in another company, even for a real manager", async () => {
    mockPitchRow({ id: PITCH_ID, company_id: "OTHER-CO", session_id: SESSION_ID });
    const res = await POST(req());
    expect(res.status).toBe(404);
    expect(applyOverride).not.toHaveBeenCalled();
  });

  it("answers a foreign pitch exactly as it answers a missing one, so a uuid cannot be probed", async () => {
    mockPitchRow({ id: PITCH_ID, company_id: "OTHER-CO", session_id: SESSION_ID });
    const other = await POST(req());
    mockPitchRow(null);
    const missing = await POST(req());
    expect(other.status).toBe(missing.status);
    expect(await other.json()).toEqual(await missing.json());
  });
});

describe("who and where come from the session, never the body", () => {
  it("passes the proven companyId and actorId, ignoring anything the caller sent", async () => {
    await POST(req({ ...BODY, companyId: "attacker-co", actorId: "somebody-else" }));
    expect(applyOverride).toHaveBeenCalledTimes(1);
    const arg = asMock(applyOverride).mock.calls[0]![0] as Record<string, unknown>;
    expect(arg).toMatchObject({ companyId: "co1", actorId: "mgr1", pitchId: PITCH_ID });
  });

  it("reads the evidence for the pitch's own session", async () => {
    await POST(req());
    expect(asMock(readPitchScore).mock.calls[0]![0]).toBe(SESSION_ID);
  });
});

describe("a correction is never applied blind", () => {
  it("refuses when the pitch has no session to read", async () => {
    mockPitchRow({ id: PITCH_ID, company_id: "co1", session_id: null });
    const res = await POST(req());
    expect(res.status).toBe(409);
    expect(applyOverride).not.toHaveBeenCalled();
  });

  it("refuses when the evidence cannot be read", async () => {
    asMock(readPitchScore).mockResolvedValue(null);
    const res = await POST(req());
    expect(res.status).toBe(500);
    expect(applyOverride).not.toHaveBeenCalled();
  });

  it("refuses when the pitch read itself errors", async () => {
    mockPitchRow(null, { message: "permission denied for table pitch_scores" });
    const res = await POST(req());
    expect(res.status).toBe(500);
    expect(applyOverride).not.toHaveBeenCalled();
    // On the record, but not in the reply.
    expect(console.error).toHaveBeenCalled();
    expect(JSON.stringify(await res.json())).not.toMatch(/permission denied/i);
  });
});

describe("a reason is required — three times over, and this is the first", () => {
  it("rejects a missing reason", async () => {
    const { reason: _reason, ...noReason } = BODY;
    expect((await POST(req(noReason))).status).toBe(400);
    expect(applyOverride).not.toHaveBeenCalled();
  });

  it("rejects whitespace pretending to be a reason", async () => {
    expect((await POST(req({ ...BODY, reason: "   " }))).status).toBe(400);
    expect(applyOverride).not.toHaveBeenCalled();
  });

  it("passes the manager's actual words through", async () => {
    await POST(req());
    const arg = asMock(applyOverride).mock.calls[0]![0] as { reason: string };
    expect(arg.reason).toContain("8:44");
  });
});

describe("the body is validated before anything is spent", () => {
  it("rejects an item type outside the three vocabularies", async () => {
    expect((await POST(req({ ...BODY, itemType: "vibes" }))).status).toBe(400);
  });

  it("rejects a value that is neither a grade nor an award", async () => {
    expect((await POST(req({ ...BODY, newValue: "excellent" }))).status).toBe(400);
  });

  it("rejects a pitch id that is not a uuid", async () => {
    expect((await POST(req({ ...BODY, pitchId: "p1" }))).status).toBe(400);
  });
});

describe("failures are reported as what they are", () => {
  it("maps an unknown item to 422, not 500", async () => {
    asMock(applyOverride).mockResolvedValue({ ok: false, reason: "unknown_item" });
    expect((await POST(req())).status).toBe(422);
  });

  it("maps an invalid value to 422", async () => {
    asMock(applyOverride).mockResolvedValue({ ok: false, reason: "invalid_value" });
    expect((await POST(req())).status).toBe(422);
  });

  it("maps a failed write to 500", async () => {
    asMock(applyOverride).mockResolvedValue({ ok: false, reason: "write_failed" });
    expect((await POST(req())).status).toBe(500);
  });

  it("returns the recomputed verdict on success, so the screen need not re-read", async () => {
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      overrideId: "ovr-1",
      base: 45,
      total: 65,
      qualifying: true,
    });
  });
});
