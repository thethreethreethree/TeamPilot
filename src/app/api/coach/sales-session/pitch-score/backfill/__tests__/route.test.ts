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

/**
 * `fetchAllPaged` is called twice per resolve (scored ids, then candidate sessions) and, for the GET count, a
 * third time: the rep's transcript lines per candidate (`repLines`, default one line for every session, so a
 * test that is not about rep speech is not changed by it).
 */
const serve = (scoredIds: string[], sessionIds: string[], repLines?: string[]) => {
  asMock(fetchAllPaged).mockReset();
  asMock(fetchAllPaged)
    .mockImplementationOnce(async () => scoredIds.map((id) => ({ session_id: id })))
    .mockImplementationOnce(async () => sessionIds.map((id) => ({ id })))
    .mockImplementationOnce(async () => (repLines ?? sessionIds).map((id) => ({ session_id: id })));
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
    expect(await res.json()).toEqual({ unscored: 2, unscorable: 0 });
  });

  /**
   * 2026-10-01, from production: all 92 recordings left in one company's backlog had no rep speech, which the
   * scorer refuses every time (MIN_AGENT_SEGMENTS). Counting them offered a button that could score none.
   */
  it("counts recordings with no rep speech as unscorable, not as backlog", async () => {
    serve([], ["s1", "s2", "s3", "s4"], ["s2", "s2", "s4"]);
    const res = await GET(req());
    expect(await res.json()).toEqual({ unscored: 2, unscorable: 2 });
  });

  it("applies the scorer's own threshold, not a copy of it", async () => {
    // The route compares each session's rep-line count with the exported MIN_AGENT_SEGMENTS. A session with
    // exactly that many lines is scorable; one below it is not.
    const { MIN_AGENT_SEGMENTS } = await import("@/lib/coach/pitchScore/generatePitchScore");
    const enough = Array.from({ length: MIN_AGENT_SEGMENTS }, () => "s1");
    const fewer = Array.from({ length: MIN_AGENT_SEGMENTS - 1 }, () => "s2");
    serve([], ["s1", "s2"], [...enough, ...fewer]);
    const body = await (await GET(req())).json();
    expect(body).toEqual({ unscored: 1, unscorable: 1 });
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

/**
 * 2026-09-25, from production: an empty DeepSeek balance. Before this, a drain walked all 194
 * recordings in 25 passes and reported "failed unexpectedly for 194".
 */
describe("an out-of-credit AI provider stops the run and says so", () => {
  const outOfCredit = {
    ok: false,
    reason: "provider_out_of_credit",
    humanMessage: "The AI provider account is out of credit, so nothing can be scored until it is topped up.",
  };

  it("stops at the first one — every remaining recording would refuse identically", async () => {
    serve([], ["s1", "s2", "s3", "s4", "s5"]);
    asMock(scoreSession).mockResolvedValue(outOfCredit);
    const body = (await (await POST(req())).json()) as { more: boolean; note: string | null };
    expect(asMock(scoreSession).mock.calls).toHaveLength(1);
    expect(body.more).toBe(false);
  });

  it("names the account, and does not claim nothing was ever scored", async () => {
    serve([], ["s1", "s2"]);
    asMock(scoreSession).mockResolvedValue(outOfCredit);
    const body = (await (await POST(req())).json()) as { note: string | null };
    expect(body.note).toMatch(/out of credit/i);
    // A balance can empty mid-run, after earlier passes scored — "nothing MORE", never "nothing".
    expect(body.note).toMatch(/Nothing more can be scored/);
  });
});

/**
 * 2026-09-29. A recording the candidate read calls unscored but scoreSession calls already-scored is
 * neither scored nor refused, so the cursor never moved and `more` stayed true: the client would re-request
 * the same batch forever. Not seen in production; the loop's termination claim was simply false for it.
 */
describe("a pass that makes no progress ends the run", () => {
  it("stops, and names the mismatch, when every candidate is already scored", async () => {
    serve([], ["s1", "s2", "s3"]);
    asMock(scoreSession).mockResolvedValue({ ok: true, pitchId: "p", alreadyScored: true });
    const body = (await (await POST(req())).json()) as { more: boolean; note: string | null; scored: number };
    expect(body.scored).toBe(0);
    expect(body.more).toBe(false);
    expect(body.note).toMatch(/already have a score/i);
  });
});

/**
 * 2026-09-30, from production: 164 saves refused on 2026-09-26..28, every one the same missing
 * rubric_config row. A save fails AFTER the paid grading, so the drain graded and threw away every one,
 * and the panel said only "could not be saved".
 */
describe("database refusals in a row stop the run and say so", () => {
  const storeFailed = { ok: false, reason: "store_failed", humanMessage: "could not be saved" };
  const noSpeech = { ok: false, reason: "no_agent_turns", humanMessage: "no rep speech" };

  it("stops at the SECOND consecutive one — not after grading the whole batch", async () => {
    serve([], ["s1", "s2", "s3", "s4", "s5"]);
    asMock(scoreSession).mockResolvedValue(storeFailed);
    const body = (await (await POST(req())).json()) as { more: boolean; note: string | null };
    expect(asMock(scoreSession).mock.calls).toHaveLength(2);
    expect(body.more).toBe(false);
    expect(body.note).toMatch(/graded but could not be saved/i);
    expect(body.note).toMatch(/fault on our side/i);
    expect(body.note).not.toMatch(/your pitch/i); // a manager watching a run, not a rep
  });

  it("does NOT stop on one alone — a single bad recording must not block the backlog behind it", async () => {
    serve([], ["s1", "s2", "s3", "s4"]);
    asMock(scoreSession)
      .mockResolvedValueOnce(storeFailed)
      .mockResolvedValueOnce(scored())
      .mockResolvedValueOnce(storeFailed)
      .mockResolvedValueOnce(noSpeech);
    const body = (await (await POST(req())).json()) as { note: string | null };
    expect(asMock(scoreSession).mock.calls).toHaveLength(4);
    expect(body.note ?? "").not.toMatch(/in a row/i);
  });
});
