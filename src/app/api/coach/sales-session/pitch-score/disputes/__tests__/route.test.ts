import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The manager's dispute queue, and the reply that closes one.
 *
 * Three things must hold and each fails silently if it does not:
 *   1. Managers only, BOTH verbs. A rep who could answer could close their own complaint.
 *   2. A reply writes NO points. Folding a score change into an answer makes the leaderboard
 *      quietly editable by whoever handles the most complaints.
 *   3. A failed read is never an empty queue — "no disputes" is an answer a manager acts on by
 *      doing nothing, which is the worst possible response to a queue that is full.
 */

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/api/requireSalesCoachManager", () => ({ requireSalesCoachManager: vi.fn() }));
vi.mock("@/lib/coach/pitchScore/readDisputes", () => ({ readDisputes: vi.fn() }));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: vi.fn(() => null) }));

import { createAdminClient } from "@/lib/supabase/admin";
import { requireSalesCoachManager } from "@/lib/api/requireSalesCoachManager";
import { readDisputes } from "@/lib/coach/pitchScore/readDisputes";
import { rateLimit } from "@/lib/api/rateLimit";
import { GET, POST, AnswerSchema } from "../route";

const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;
const PITCH_ID = "11111111-1111-4111-8111-111111111111";

let inserted: Record<string, unknown> | null;
let insertError: { message: string } | null;

const setDb = (opts: { pitch?: unknown; readError?: { message: string } | null } = {}) => {
  inserted = null;
  insertError = null;
  asMock(createAdminClient).mockReturnValue({
    from: (table: string) => {
      if (table === "pitches") {
        const chain: Record<string, unknown> = {};
        chain.select = () => chain;
        chain.eq = () => chain;
        chain.maybeSingle = async () => ({
          data: "pitch" in opts ? opts.pitch : { id: PITCH_ID, rep_id: "rep1", company_id: "c1" },
          error: opts.readError ?? null,
        });
        return chain;
      }
      return {
        insert: async (row: Record<string, unknown>) => {
          inserted = row;
          return { error: insertError };
        },
      };
    },
  });
};

const getReq = (qs = "") =>
  ({ nextUrl: { searchParams: new URLSearchParams(qs) }, headers: new Headers() }) as unknown as Parameters<typeof GET>[0];

const postReq = (body: unknown) =>
  ({ json: async () => body, headers: new Headers() }) as unknown as Parameters<typeof POST>[0];

const GOOD = { pitchId: PITCH_ID, note: "Listened again — the objection was real, re-scoring." };

beforeEach(() => {
  vi.clearAllMocks();
  asMock(rateLimit).mockReturnValue(null);
  asMock(requireSalesCoachManager).mockResolvedValue({ userId: "mgr1", companyId: "c1" });
  asMock(readDisputes).mockResolvedValue([]);
  setDb();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("managers only, both verbs", () => {
  it("403s a non-manager on GET, and reads nothing", async () => {
    asMock(requireSalesCoachManager).mockResolvedValue(null);
    expect((await GET(getReq())).status).toBe(403);
    expect(readDisputes).not.toHaveBeenCalled();
  });

  it("403s a non-manager on POST, and writes nothing", async () => {
    // A rep who could answer could close their own complaint, and the queue would mean nothing.
    asMock(requireSalesCoachManager).mockResolvedValue(null);
    expect((await POST(postReq(GOOD))).status).toBe(403);
    expect(inserted).toBeNull();
  });

  it("scopes the queue to the MANAGER'S company, never one from the request", async () => {
    await GET(getReq("companyId=someone-elses"));
    expect(asMock(readDisputes).mock.calls[0]![0]).toMatchObject({ companyId: "c1" });
  });
});

describe("GET — the queue", () => {
  it("returns the open disputes", async () => {
    asMock(readDisputes).mockResolvedValue([{ id: "d1", note: "wrong", open: true }]);
    const body = await (await GET(getReq())).json();
    expect(body.disputes).toHaveLength(1);
  });

  it("500s rather than showing an empty queue when the read fails", async () => {
    asMock(readDisputes).mockResolvedValue(null);
    const res = await GET(getReq());
    expect(res.status).toBe(500);
    expect((await res.json()).disputes).toBeUndefined();
  });

  it("passes the rep filter and the answered flag through", async () => {
    await GET(getReq("repId=rep9&includeAnswered=1"));
    expect(asMock(readDisputes).mock.calls[0]![0]).toMatchObject({
      repId: "rep9",
      includeAnswered: true,
    });
  });

  it("defaults to open-only", async () => {
    await GET(getReq());
    expect(asMock(readDisputes).mock.calls[0]![0].includeAnswered).toBe(false);
  });
});

describe("POST — the reply", () => {
  it("appends an answer event", async () => {
    const res = await POST(postReq(GOOD));
    expect(res.status).toBe(200);
    expect(inserted).toMatchObject({
      company_id: "c1",
      actor: "mgr1",
      kind: "coach.pitch_score_answered",
      subject: `pitch:${PITCH_ID}`,
    });
  });

  it("writes NO score fields — a reply is not a re-score", async () => {
    await POST(postReq(GOOD));
    const payload = inserted!.payload as Record<string, unknown>;
    for (const forbidden of ["total", "base", "bonus", "violations", "points", "qualifying", "grade"]) {
      expect(payload[forbidden]).toBeUndefined();
    }
  });

  it("records the rep the score belongs to, taken from the PITCH not the request", async () => {
    await POST(postReq({ ...GOOD, repId: "an-attacker-chose-this" }));
    expect((inserted!.payload as Record<string, unknown>).rep_id).toBe("rep1");
  });

  it("has no field through which a caller could name the rep", () => {
    // Found by mutation: the behavioural test above passes even against a route that reads
    // body.repId, because zod strips the key before the route sees it. Real protection, but it
    // lives in the SCHEMA — so it is asserted there. Adding repId here breaks this deliberately.
    expect(Object.keys(AnswerSchema.shape).sort()).toEqual(["itemId", "note", "pitchId"]);
  });

  it("answers a specific item when given one", async () => {
    await POST(postReq({ ...GOOD, itemId: "deliv.tone" }));
    expect(inserted!.payload).toMatchObject({ item_id: "deliv.tone" });
  });

  it("404s a pitch in another tenant, and writes nothing", async () => {
    // events is filtered by company on the way OUT; a WRITE has to prove the tenant on the way IN,
    // or a manager could answer into another company by guessing a uuid.
    setDb({ pitch: { id: PITCH_ID, rep_id: "x", company_id: "other-co" } });
    expect((await POST(postReq(GOOD))).status).toBe(404);
    expect(inserted).toBeNull();
  });

  it("404s a pitch that does not exist", async () => {
    setDb({ pitch: null });
    expect((await POST(postReq(GOOD))).status).toBe(404);
  });

  it("500s, not 404s, when the pitch read itself fails", async () => {
    setDb({ readError: { message: "connection reset" } });
    expect((await POST(postReq(GOOD))).status).toBe(500);
    expect(inserted).toBeNull();
  });
});

describe("a reply that was not saved is never reported as sent", () => {
  it("500s when the insert fails", async () => {
    setDb();
    insertError = { message: "new row violates row-level security policy" };
    const res = await POST(postReq(GOOD));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBeUndefined();
    expect(body.error).toMatch(/not saved/i);
  });

  it("does not leak the database's message", async () => {
    setDb();
    insertError = { message: "new row violates row-level security policy for table events" };
    const body = await (await POST(postReq(GOOD))).json();
    expect(JSON.stringify(body)).not.toMatch(/row-level security|table events/i);
    expect(console.error).toHaveBeenCalled();
  });
});

describe("validation and limits", () => {
  it("rejects an empty reply", async () => {
    expect((await POST(postReq({ pitchId: PITCH_ID, note: "  " }))).status).toBeGreaterThanOrEqual(400);
    expect(inserted).toBeNull();
  });

  it("rejects a non-uuid pitch id", async () => {
    expect((await POST(postReq({ pitchId: "nope", note: "hi" }))).status).toBeGreaterThanOrEqual(400);
  });

  it("honours the rate limiter before checking anything", async () => {
    asMock(rateLimit).mockReturnValue(new Response(null, { status: 429 }));
    expect((await GET(getReq())).status).toBe(429);
    expect(requireSalesCoachManager).not.toHaveBeenCalled();
  });
});
