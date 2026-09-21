import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * POST /api/coach/sales-session/pitch-score/dispute.
 *
 * The rubric screen already shipped telling reps "Think a score is wrong? Tap Dispute on the
 * pitch." These tests pin the two ways that promise can be broken quietly:
 *
 *   1. Telling a rep their dispute was SENT when nothing was recorded. A dispute they believe is
 *      filed and which does not exist is worse than an error they could retry.
 *   2. Letting a dispute change the score. A rep who can edit their own leaderboard position by
 *      complaining destroys the only thing that makes the number worth anything.
 */

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/api/callerScopedDb", () => ({ callerScopedDb: vi.fn(() => null) }));
vi.mock("@/lib/api/callerCompanyId", () => ({ callerCompanyId: vi.fn(async () => "co1") }));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: vi.fn(() => null) }));

import { createClient } from "@/lib/supabase/server";
import { callerCompanyId } from "@/lib/api/callerCompanyId";
import { rateLimit } from "@/lib/api/rateLimit";
import { POST } from "../route";

const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;
const PITCH_ID = "11111111-1111-4111-8111-111111111111";

const PITCH_ROW = { id: PITCH_ID, rep_id: "rep1", session_id: "sess1", company_id: "co1" };

let inserted: Record<string, unknown> | null;
let insertError: { message: string } | null;

const setup = (opts: {
  user?: string | null;
  pitch?: unknown;
  readError?: { message: string } | null;
} = {}) => {
  inserted = null;
  insertError = null;
  const from = vi.fn((table: string) => {
    if (table === "pitch_scores") {
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.eq = () => chain;
      chain.maybeSingle = async () => ({
        data: "pitch" in opts ? opts.pitch : PITCH_ROW,
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
  });
  const userId = "user" in opts ? opts.user : "rep1";
  asMock(createClient).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null } }) },
    from,
  });
  return { from };
};

const req = (body: unknown) =>
  ({ json: async () => body, headers: new Headers() }) as unknown as Parameters<typeof POST>[0];

const GOOD = { pitchId: PITCH_ID, note: "The customer never objected here." };

beforeEach(() => {
  vi.clearAllMocks();
  asMock(rateLimit).mockReturnValue(null);
  asMock(callerCompanyId).mockResolvedValue("co1");
  setup();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("filing a dispute", () => {
  it("appends an event and confirms", async () => {
    const res = await POST(req(GOOD));
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    expect(inserted).toMatchObject({
      company_id: "co1",
      actor: "rep1",
      kind: "coach.pitch_score_disputed",
      subject: `pitch:${PITCH_ID}`,
    });
  });

  it("records the rep the score belongs to, separately from who filed it", async () => {
    // Usually the same person. When a manager files on a rep's behalf, conflating them would
    // attribute the complaint to the wrong person on a record that is append-only.
    setup({ user: "a-manager" });
    await POST(req(GOOD));
    expect((inserted!.payload as Record<string, unknown>)).toMatchObject({
      rep_id: "rep1",
      session_id: "sess1",
    });
    expect(inserted!.actor).toBe("a-manager");
  });

  it("carries the item and the moment, so a manager lands on it rather than hunting", async () => {
    await POST(req({ ...GOOD, itemId: "deliv.objectionHandling", timestampS: 312 }));
    expect(inserted!.payload).toMatchObject({ item_id: "deliv.objectionHandling", timestamp_s: 312 });
  });

  it("allows a whole-score dispute with no item", async () => {
    await POST(req(GOOD));
    expect(inserted!.payload).toMatchObject({ item_id: null, timestamp_s: null });
  });

  it("writes NO score fields — a dispute is not a re-score", async () => {
    await POST(req(GOOD));
    const payload = inserted!.payload as Record<string, unknown>;
    for (const forbidden of ["total", "base", "bonus", "violations", "points", "qualifying"]) {
      expect(payload[forbidden]).toBeUndefined();
    }
    // And it touched nothing but `events`.
    expect(inserted!.kind).toBe("coach.pitch_score_disputed");
  });
});

describe("access", () => {
  it("401 unauthenticated", async () => {
    setup({ user: null });
    expect((await POST(req(GOOD))).status).toBe(401);
  });

  it("403 with no company context", async () => {
    asMock(callerCompanyId).mockResolvedValue(null);
    expect((await POST(req(GOOD))).status).toBe(403);
  });

  it("404 for a peer rep — the pitch read IS the gate", async () => {
    // pitches RLS scopes the select to the owner or a manager, so a null row is the access check.
    setup({ pitch: null });
    const res = await POST(req(GOOD));
    expect(res.status).toBe(404);
    expect(inserted).toBeNull();
  });

  it("500, not 404, when the pitch read itself fails", async () => {
    // Reporting a failed read as "not found" tells a rep their pitch does not exist when the
    // database was merely unreachable.
    setup({ readError: { message: "connection reset" } });
    const res = await POST(req(GOOD));
    expect(res.status).toBe(500);
    expect(inserted).toBeNull();
    expect(console.error).toHaveBeenCalled();
  });

  it("honours the rate limiter before reading anything", async () => {
    asMock(rateLimit).mockReturnValue(new Response(null, { status: 429 }));
    expect((await POST(req(GOOD))).status).toBe(429);
    expect(inserted).toBeNull();
  });
});

describe("a dispute that was not recorded is never reported as sent", () => {
  it("500s when the event insert fails", async () => {
    setup();
    insertError = { message: "new row violates row-level security policy" };
    const res = await POST(req(GOOD));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBeUndefined();
    expect(body.error).toMatch(/not sent/i);
  });

  it("does not leak the database's message to the rep", async () => {
    setup();
    insertError = { message: "new row violates row-level security policy for table events" };
    const body = await (await POST(req(GOOD))).json();
    expect(JSON.stringify(body)).not.toMatch(/row-level security|table events/i);
    expect(console.error).toHaveBeenCalled();
  });
});

describe("validation", () => {
  it("rejects an empty note — a dispute with nothing in it is not actionable", async () => {
    const res = await POST(req({ pitchId: PITCH_ID, note: "   " }));
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(inserted).toBeNull();
  });

  it("rejects a non-uuid pitch id", async () => {
    const res = await POST(req({ pitchId: "nope", note: "wrong" }));
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(inserted).toBeNull();
  });

  it("rejects a note long enough to be an attack on the manager's queue", async () => {
    const res = await POST(req({ pitchId: PITCH_ID, note: "x".repeat(1001) }));
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(inserted).toBeNull();
  });
});
