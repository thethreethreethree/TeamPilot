import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/requireSalesCoachManager", () => ({ requireSalesCoachManager: vi.fn(async () => ({ userId: "m1", companyId: "co1" })) }));
vi.mock("@/lib/api/treeAccess", () => ({ treeAllowsRep: vi.fn(async () => true) }));
vi.mock("@/lib/coach/recordings/notifyRecording", () => ({
  notifyRecordingEvent: vi.fn(async () => true),
  notifyCommentMention: vi.fn(async () => true),
}));
const db = vi.hoisted(() => ({
  inserts: [] as Array<{ table: string; row: unknown }>,
  canSee: new Set<string>(),
  people: [] as Array<{ id: string; full_name: string }>,
  rpcs: [] as Array<{ fn: string; args: Record<string, unknown> }>,
  hidden: false, // 0337: the call s1 has an active hide that applies to the commenting manager
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc: async (fn: string, a: Record<string, unknown>) => {
      db.rpcs.push({ fn, args: a });
      // 0296: a comment that carries visibility or mentions is written by rss_insert_comment in one transaction.
      if (fn === "rss_insert_comment") return { data: "c1", error: null };
      if (fn === "rss_call_hidden_for") return { data: db.hidden, error: null };
      return { data: db.canSee.has(a.viewer as string), error: null };
    },
    from: (table: string) => {
      const b: Record<string, unknown> = {};
      for (const m of ["select", "eq", "in"]) b[m] = () => b;
      b.maybeSingle = async () =>
        table === "pitch_scores"
          ? { data: { id: "p1", company_id: "co1", rep_id: "rep1", session_id: "s1" }, error: null }
          : { data: { full_name: "Mia Manager" }, error: null };
      b.then = (res: (v: unknown) => unknown) =>
        res({ data: table === "profiles" ? db.people : table === "call_hides" && db.hidden ? [{ session_id: "s1" }] : [], error: null });
      b.insert = (row: unknown) => {
        db.inserts.push({ table, row });
        const r: Record<string, unknown> = {
          select: () => r,
          maybeSingle: async () => ({ data: { id: "c1", timestamp_s: 10, body: "x", sent_to_rep: false, created_at: "t" }, error: null }),
        };
        r.then = (res: (v: unknown) => unknown) => res({ error: null });
        return r;
      };
      return b;
    },
  }),
}));

import { notifyCommentMention } from "@/lib/coach/recordings/notifyRecording";
import { POST } from "../route";

const post = (body: Record<string, unknown>) =>
  POST(new Request("http://x", { method: "POST", body: JSON.stringify({ pitchId: "p1", timestampS: 10, body: "Ask about budget here", ...body }) }) as never);
const commentRows = () => db.inserts.filter((i) => i.table === "recording_comments").map((i) => i.row);

beforeEach(() => {
  vi.clearAllMocks();
  db.inserts = [];
  db.rpcs = [];
  db.hidden = false;
  db.canSee = new Set(["m2", "rep1"]);
  db.people = [{ id: "m2", full_name: "Sam Manager" }, { id: "rep1", full_name: "Rae Rep" }, { id: "m9", full_name: "Out Oftree" }];
});

describe("POST pitch-recordings/comment — visibility and @mentions (0293)", () => {
  it("a plain comment is written exactly as before 0293 (no visibility column sent)", async () => {
    expect((await post({ sendToRep: true })).status).toBe(200);
    expect(commentRows()).toEqual([{ company_id: "co1", pitch_id: "p1", author_id: "m1", timestamp_s: 10, body: "Ask about budget here", sent_to_rep: true }]);
  });
  it("refuses contradictions: named with nobody, only-me with mentions, only-me sent to the rep, named+sent without the rep", async () => {
    expect((await post({ visibility: "named" })).status).toBe(400);
    expect((await post({ visibility: "only_me", mentions: ["m2"] })).status).toBe(400);
    expect((await post({ visibility: "only_me", sendToRep: true })).status).toBe(400);
    expect((await post({ visibility: "named", mentions: ["m2"], sendToRep: true })).status).toBe(400);
    expect(commentRows()).toEqual([]);
  });
  it("mentioning someone who can't see this call is refused by name, and nothing is written", async () => {
    const res = await post({ mentions: ["m2", "m9"] });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Out Oftree can't see this call/);
    expect(db.inserts).toEqual([]);
  });
  it("a named comment: saved with its visibility, the mention recorded, the person told", async () => {
    const res = await post({ visibility: "named", mentions: ["m2"] });
    expect(res.status).toBe(200);
    // Comment and mention land together (0296) — never a 'named' comment whose mentions failed.
    expect(db.rpcs.find((r) => r.fn === "rss_insert_comment")?.args).toMatchObject({
      p_company: "co1", p_pitch: "p1", p_author: "m1", p_visibility: "named", p_mentions: ["m2"],
    });
    expect(db.inserts).toEqual([]);
    expect(notifyCommentMention).toHaveBeenCalledWith(expect.objectContaining({ recipientId: "m2", repId: "rep1", sessionId: "s1" }));
    expect((await res.json()).mentioned).toBe(1);
  });
  it("the author is never mentioned (or notified) by their own comment", async () => {
    await post({ mentions: ["m1", "m2"] });
    expect(notifyCommentMention).toHaveBeenCalledTimes(1);
  });
});

describe("a call hidden by a company phrase (0337)", () => {
  it("a manager it's hidden from can't comment on it — 404, nothing written", async () => {
    db.hidden = true;
    expect((await post({ sendToRep: true })).status).toBe(404);
    expect(commentRows()).toEqual([]);
    expect(db.rpcs.map((r) => r.fn)).toEqual(["rss_call_hidden_for"]);
  });
});
