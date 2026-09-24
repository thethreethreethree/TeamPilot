import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * POST/GET /api/coach/sales-session/pitch-score/backfill — the backlog drain.
 *
 * What these pin is not "does it score things". It is the four ways a drain that spends money per
 * item can be quietly wrong:
 *
 *   1. It reports 0 and a manager reads "nothing to do" when the truth is "guidance is off for
 *      this account and nothing will ever be scored". Same shape as the 2026-08-14 empty-AI
 *      outage, one layer out (§1.5.3: fail loud, not silent).
 *   2. It keeps working through a batch after the first `suppressed`, turning one answerable
 *      message into eight identical ones and walking a whole history to learn what the first
 *      session already proved.
 *   3. It tells the caller to loop on `remaining`, which never reaches 0 when some recordings can
 *      never be scored — an unbounded loop of paid calls.
 *   4. It re-scores a recording that already has a score, billing the same pitch twice.
 */

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => DB) }));
vi.mock("@/lib/api/callerScopedDb", () => ({ callerScopedDb: vi.fn(() => null) }));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: vi.fn(() => null) }));
vi.mock("@/lib/supabase/paginate", () => ({ fetchAllPaged: vi.fn() }));
vi.mock("@/lib/coach/v5/skillAccess", () => ({ isSalesCoachManager: vi.fn(() => true) }));
vi.mock("@/lib/coach/pitchScore/scoreSession", async () => {
  const actual = await vi.importActual<typeof import("@/lib/coach/pitchScore/scoreSession")>(
    "@/lib/coach/pitchScore/scoreSession"
  );
  return { ...actual, scoreSession: vi.fn() };
});

import { fetchAllPaged } from "@/lib/supabase/paginate";
import { isSalesCoachManager } from "@/lib/coach/v5/skillAccess";
import { scoreSession } from "@/lib/coach/pitchScore/scoreSession";
import { POST, GET } from "../route";

const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

/** Only the profile read goes through the client here; the two list reads go through fetchAllPaged. */
const DB = {
  auth: { getUser: vi.fn(async () => ({ data: { user: { id: "mgr1" } } })) },
  from: vi.fn(() => ({
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({
          data: { role: "CEO", company_id: "co1", sales_coach_role: "manager" },
        }),
      }),
    }),
  })),
};

const req = (offset = 0) =>
  new Request(`http://t/api?offset=${offset}`, { method: "POST" }) as never;

/** `fetchAllPaged` is called twice per resolve: scored ids first, then candidate sessions. */
const serve = (scoredIds: string[], sessionIds: string[]) => {
  asMock(fetchAllPaged).mockReset();
  asMock(fetchAllPaged)
    .mockImplementationOnce(async () => scoredIds.map((id) => ({ session_id: id })))
    .mockImplementationOnce(async () => sessionIds.map((id) => ({ id })));
};

const scored = () => ({ ok: true as const, pitchId: "p", alreadyScored: false });

beforeEach(() => {
  vi.clearAllMocks();
  asMock(isSalesCoachManager).mockReturnValue(true);
  DB.auth.getUser.mockResolvedValue({ data: { user: { id: "mgr1" } } });
});

describe("the count a manager sees before anything is spent", () => {
  it("counts only the recordings that have no score", async () => {
    serve(["s1"], ["s1", "s2", "s3"]);
    const res = await GET(req());
    expect(await res.json()).toEqual({ unscored: 2 });
  });

  it("does not score anything while counting", async () => {
    serve([], ["s1", "s2"]);
    await GET(req());
    // The whole point of counting first is that the number is free. A GET that graded would make
    // "how big is this?" cost the same as "do it".
    expect(scoreSession).not.toHaveBeenCalled();
  });

  it("fails rather than reporting an empty backlog when the read breaks", async () => {
    asMock(fetchAllPaged).mockReset();
    asMock(fetchAllPaged).mockRejectedValueOnce(new Error("PostgREST exploded"));
    const res = await GET(req());
    expect(res.status).toBe(500);
    // `{ unscored: 0 }` here would say "nothing to do" about a backlog nobody counted.
    expect(await res.json()).not.toHaveProperty("unscored");
  });
});

describe("guidance being off is said out loud, not reported as zero", () => {
  it("stops at the first suppressed instead of working through the batch", async () => {
    serve([], ["s1", "s2", "s3", "s4", "s5"]);
    asMock(scoreSession).mockResolvedValue({
      ok: false,
      reason: "suppressed",
      humanMessage: "AI guidance is off for this account, so pitches are not scored yet.",
    });
    await POST(req());
    // Guidance is an ACCOUNT state — every remaining session would refuse identically.
    expect(asMock(scoreSession).mock.calls).toHaveLength(1);
  });

  it("tells the manager WHY nothing was scored", async () => {
    serve([], ["s1", "s2"]);
    asMock(scoreSession).mockResolvedValue({
      ok: false,
      reason: "suppressed",
      humanMessage: "AI guidance is off for this account, so pitches are not scored yet.",
    });
    const body = (await (await POST(req())).json()) as { scored: number; note: string | null };
    expect(body.scored).toBe(0);
    expect(body.note).toMatch(/guidance is off/i);
  });

  it("does not invite a retry that cannot succeed", async () => {
    serve([], ["s1", "s2"]);
    asMock(scoreSession).mockResolvedValue({ ok: false, reason: "suppressed", humanMessage: "off" });
    const body = (await (await POST(req())).json()) as { more: boolean };
    expect(body.more).toBe(false);
  });
});

describe("the loop terminates", () => {
  it("says to keep going while a pass is still scoring things", async () => {
    serve([], ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8", "s9"]);
    asMock(scoreSession).mockResolvedValue(scored());
    const body = (await (await POST(req())).json()) as { scored: number; remaining: number; more: boolean };
    expect(body.scored).toBe(8); // BATCH
    expect(body.remaining).toBe(1);
    expect(body.more).toBe(true);
  });

  it("says to STOP when a pass scored nothing, even with candidates left", async () => {
    // Recordings with no rep speech stay candidates forever — there is no attempted-at column. A
    // caller looping on `remaining > 0` would never stop; looping on `more` does.
    serve([], ["s1", "s2", "s3"]);
    asMock(scoreSession).mockResolvedValue({
      ok: false,
      reason: "no_agent_turns",
      humanMessage: "This recording has no rep speech to grade.",
    });
    const body = (await (await POST(req())).json()) as {
      more: boolean;
      remaining: number;
      refused: Record<string, number>;
      note: string | null;
    };
    expect(body.more).toBe(false);
    expect(body.remaining).toBe(3);
    expect(body.refused.no_agent_turns).toBe(3);
    expect(body.note).toBeTruthy();
  });

  it("names which refusals are pointless to retry, so a caller need not hard-code them", async () => {
    serve([], ["s1"]);
    asMock(scoreSession).mockResolvedValue(scored());
    const body = (await (await POST(req())).json()) as { permanent: string[] };
    expect(body.permanent).toContain("suppressed");
    expect(body.permanent).toContain("no_agent_turns");
    expect(body.permanent).not.toContain("llm_empty"); // a provider blip IS worth retrying
  });
});

describe("what it refuses to do", () => {
  it("never re-bills a recording that already has a score", async () => {
    serve([], ["s1"]);
    asMock(scoreSession).mockResolvedValue(scored());
    await POST(req());
    expect(asMock(scoreSession).mock.calls[0]?.[0]).toMatchObject({ skipIfScored: true });
  });

  it("does not count an already-scored recording as newly scored", async () => {
    serve([], ["s1", "s2"]);
    asMock(scoreSession).mockResolvedValue({ ok: true, pitchId: "p", alreadyScored: true });
    const body = (await (await POST(req())).json()) as { scored: number };
    expect(body.scored).toBe(0);
  });

  it("refuses a rep — this spends money across the whole company's history", async () => {
    asMock(isSalesCoachManager).mockReturnValue(false);
    const res = await POST(req());
    expect(res.status).toBe(403);
    expect(scoreSession).not.toHaveBeenCalled();
  });

  it("refuses an unauthenticated caller", async () => {
    DB.auth.getUser.mockResolvedValue({ data: { user: null } } as never);
    const res = await POST(req());
    expect(res.status).toBe(401);
  });
});

/**
 * THE FIRST REAL RUN. 2026-09-24: a manager pressed "Score them all" against 194 recordings and
 * got "Scoring stopped because the request failed", with nothing scored and no reason on screen.
 *
 * `scoreSession` returned a verdict for every decision it MADE and let everything else throw —
 * so one malformed recording propagated out of the loop and 500'd the whole request. These are
 * the three behaviours that were missing, each written so it fails without its fix.
 */
describe("one bad recording must not end the run", () => {
  it("counts a THROWING recording as a refusal and keeps going", async () => {
    serve([], ["bad", "s2", "s3"]);
    asMock(scoreSession)
      // The real scoreSession can no longer throw — it catches and returns `errored`. This
      // asserts the ROUTE's half: that an `errored` verdict is counted and the loop continues,
      // so a second defence is not silently the only one.
      .mockResolvedValueOnce({ ok: false, reason: "errored", humanMessage: "boom" })
      .mockResolvedValue({ ok: true, pitchId: "p", alreadyScored: false });

    const res = await POST(req());
    const body = (await res.json()) as {
      scored: number;
      refused: Record<string, number>;
      more: boolean;
      nextOffset: number;
    };

    expect(res.status).toBe(200);
    expect(body.refused.errored).toBe(1);
    // The two AFTER the bad one still scored. Before the fix this request was a 500 and they did not.
    expect(body.scored).toBe(2);
  });

  it("steps the cursor past recordings that can never be scored", async () => {
    // Eight unscorable recordings ahead of the scorable ones is what a real backlog looks like,
    // and `slice(0, BATCH)` would re-read these same eight on every pass forever.
    serve([], Array.from({ length: 20 }, (_, i) => `s${i}`));
    asMock(scoreSession).mockResolvedValue({
      ok: false,
      reason: "no_agent_turns",
      humanMessage: "no rep speech",
    });

    const body = (await (await POST(req(0))).json()) as { nextOffset: number; more: boolean };

    // 8 refused → the window moves to 8, and there is more of the list to reach.
    expect(body.nextOffset).toBe(8);
    expect(body.more).toBe(true);
  });

  it("stops once the cursor has walked the whole list, rather than looping forever", async () => {
    serve([], ["s1", "s2", "s3"]);
    asMock(scoreSession).mockResolvedValue({
      ok: false,
      reason: "no_agent_turns",
      humanMessage: "no rep speech",
    });

    const body = (await (await POST(req(0))).json()) as { nextOffset: number; more: boolean };

    expect(body.nextOffset).toBe(3);
    // nextOffset is no longer < remaining, so the caller stops. This is the termination argument
    // the cursor replaced `scored > 0` with.
    expect(body.more).toBe(false);
  });
});
