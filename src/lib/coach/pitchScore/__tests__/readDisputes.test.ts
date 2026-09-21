import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The dispute queue, derived by replaying events (§3.1) rather than stored as state.
 *
 * The interesting cases are all about WHEN something is open. A queue that shows an answered
 * dispute forever wastes a manager's attention; a queue that hides a RE-filed one loses a rep's
 * second complaint, which is the one they made because the first answer did not land.
 */

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { createAdminClient } from "@/lib/supabase/admin";
import { readDisputes, labelForItem } from "../readDisputes";

const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

/**
 * A mock that RESPECTS `.eq("kind", ...)` and `.in("subject", ...)`.
 *
 * The first version ignored both and handed every query the whole fixture. That was fine while
 * the reader made one call, and it silently double-counted the moment it made two — the mock was
 * agreeing with the code rather than testing it. A mock that answers every query identically
 * cannot tell a correct two-query read from a broken one.
 */
const setEvents = (
  rows: ({ kind: string; subject?: string } & Record<string, unknown>)[],
  error: { message: string } | null = null,
  answerError: { message: string } | null = null
) =>
  asMock(createAdminClient).mockReturnValue({
    from: () => {
      const filters: { kind?: string; subjects?: string[] } = {};
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.eq = (col: string, val: string) => {
        if (col === "kind") filters.kind = val;
        return chain;
      };
      chain.in = (col: string, vals: string[]) => {
        if (col === "subject") filters.subjects = vals;
        return chain;
      };
      chain.order = () => chain;
      chain.limit = async () => {
        const isAnswerQuery = filters.kind === "coach.pitch_score_answered";
        if (!isAnswerQuery && error) return { data: null, error };
        if (isAnswerQuery && answerError) return { data: null, error: answerError };
        let out = rows.filter((r) => !filters.kind || r.kind === filters.kind);
        if (filters.subjects) out = out.filter((r) => filters.subjects!.includes(String(r.subject)));
        // The dispute query orders DESCENDING; the answer query ascending.
        if (!isAnswerQuery) out = [...out].reverse();
        return { data: out, error: null };
      };
      return chain;
    },
  });

const dispute = (o: {
  id: string;
  at: string;
  pitch?: string;
  item?: string | null;
  rep?: string;
  actor?: string;
  note?: string;
  ts?: number | null;
}) => ({
  id: o.id,
  actor: o.actor ?? "rep1",
  kind: "coach.pitch_score_disputed",
  subject: `pitch:${o.pitch ?? "p1"}`,
  created_at: o.at,
  payload: {
    pitch_id: o.pitch ?? "p1",
    rep_id: o.rep ?? "rep1",
    session_id: "s1",
    item_id: o.item === undefined ? null : o.item,
    timestamp_s: o.ts ?? null,
    note: o.note ?? "This grade is wrong",
  },
});

const answer = (o: { id: string; at: string; pitch?: string; item?: string | null; note?: string }) => ({
  id: o.id,
  actor: "mgr1",
  kind: "coach.pitch_score_answered",
  subject: `pitch:${o.pitch ?? "p1"}`,
  created_at: o.at,
  payload: {
    pitch_id: o.pitch ?? "p1",
    item_id: o.item === undefined ? null : o.item,
    note: o.note ?? "Reviewed, the grade stands",
  },
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("what counts as open", () => {
  it("a dispute with no answer is open", async () => {
    setEvents([dispute({ id: "d1", at: "2026-09-20T10:00:00Z" })]);
    const rows = (await readDisputes({ companyId: "c1" }))!;
    expect(rows).toHaveLength(1);
    expect(rows[0]!.open).toBe(true);
    expect(rows[0]!.answer).toBeNull();
  });

  it("an answered dispute drops out of the default queue", async () => {
    setEvents([
      dispute({ id: "d1", at: "2026-09-20T10:00:00Z" }),
      answer({ id: "a1", at: "2026-09-20T11:00:00Z" }),
    ]);
    expect(await readDisputes({ companyId: "c1" })).toHaveLength(0);
  });

  it("but is returned, with its answer, when asked for", async () => {
    setEvents([
      dispute({ id: "d1", at: "2026-09-20T10:00:00Z" }),
      answer({ id: "a1", at: "2026-09-20T11:00:00Z", note: "Grade stands, here is why" }),
    ]);
    const rows = (await readDisputes({ companyId: "c1", includeAnswered: true }))!;
    expect(rows[0]!.open).toBe(false);
    expect(rows[0]!.answer).toMatchObject({ note: "Grade stands, here is why", actorId: "mgr1" });
  });

  it("RE-FILING after an answer opens it again", async () => {
    // The rep read the answer and disagreed. Treating the old answer as covering the new dispute
    // would silently swallow the complaint they made because the first reply did not land.
    setEvents([
      dispute({ id: "d1", at: "2026-09-20T10:00:00Z" }),
      answer({ id: "a1", at: "2026-09-20T11:00:00Z" }),
      dispute({ id: "d2", at: "2026-09-20T12:00:00Z", note: "Still wrong" }),
    ]);
    const rows = (await readDisputes({ companyId: "c1" }))!;
    expect(rows).toHaveLength(1);
    expect(rows[0]!).toMatchObject({ id: "d2", note: "Still wrong", open: true });
  });

  it("an answer to one ITEM does not close a dispute about another", async () => {
    setEvents([
      dispute({ id: "d1", at: "2026-09-20T10:00:00Z", item: "close.paperwork" }),
      dispute({ id: "d2", at: "2026-09-20T10:05:00Z", item: "deliv.tone" }),
      answer({ id: "a1", at: "2026-09-20T11:00:00Z", item: "close.paperwork" }),
    ]);
    const rows = (await readDisputes({ companyId: "c1" }))!;
    expect(rows.map((r) => r.itemId)).toEqual(["deliv.tone"]);
  });

  it("an answer to the WHOLE score does not close an item-level dispute", async () => {
    setEvents([
      dispute({ id: "d1", at: "2026-09-20T10:00:00Z", item: "deliv.tone" }),
      answer({ id: "a1", at: "2026-09-20T11:00:00Z", item: null }),
    ]);
    expect(await readDisputes({ companyId: "c1" })).toHaveLength(1);
  });

  it("the LAST answer wins when a manager replies twice", async () => {
    setEvents([
      dispute({ id: "d1", at: "2026-09-20T10:00:00Z" }),
      answer({ id: "a1", at: "2026-09-20T11:00:00Z", note: "Stands" }),
      answer({ id: "a2", at: "2026-09-20T12:00:00Z", note: "Actually, re-scored" }),
    ]);
    const rows = (await readDisputes({ companyId: "c1", includeAnswered: true }))!;
    expect(rows[0]!.answer!.note).toBe("Actually, re-scored");
  });
});

describe("what a manager sees", () => {
  it("newest first", async () => {
    setEvents([
      dispute({ id: "d1", at: "2026-09-20T10:00:00Z" }),
      dispute({ id: "d2", at: "2026-09-20T12:00:00Z", item: "deliv.tone" }),
    ]);
    const rows = (await readDisputes({ companyId: "c1" }))!;
    expect(rows.map((r) => r.id)).toEqual(["d2", "d1"]);
  });

  it("resolves the item to its rubric label, across all three vocabularies", async () => {
    expect(labelForItem("deliv.tone")).toBe("Tone and certainty");
    expect(labelForItem("bonus.directv")).toBeTruthy();
    expect(labelForItem("viol.talkingOver")).toBeTruthy();
    expect(labelForItem(null)).toBeNull();
  });

  it("keeps a dispute whose item the rubric has since retired", async () => {
    // Dropping it would discard a rep's complaint because the rubric moved on.
    setEvents([dispute({ id: "d1", at: "2026-09-20T10:00:00Z", item: "retired.thing" })]);
    const rows = (await readDisputes({ companyId: "c1" }))!;
    expect(rows[0]!.itemLabel).toBe("retired.thing");
  });

  it("separates who FILED it from whose score it is", async () => {
    // A manager filing on a rep's behalf must not be recorded as the rep complaining.
    setEvents([dispute({ id: "d1", at: "2026-09-20T10:00:00Z", rep: "rep9", actor: "mgr1" })]);
    const rows = (await readDisputes({ companyId: "c1" }))!;
    expect(rows[0]!).toMatchObject({ repId: "rep9", actorId: "mgr1" });
  });

  it("filters to one rep when asked", async () => {
    setEvents([
      dispute({ id: "d1", at: "2026-09-20T10:00:00Z", rep: "rep1" }),
      dispute({ id: "d2", at: "2026-09-20T11:00:00Z", rep: "rep2", item: "deliv.tone" }),
    ]);
    const rows = (await readDisputes({ companyId: "c1", repId: "rep2" }))!;
    expect(rows.map((r) => r.repId)).toEqual(["rep2"]);
  });
});

describe("a failed read is not an empty queue", () => {
  it("returns null and logs", async () => {
    setEvents([], { message: "connection reset" });
    expect(await readDisputes({ companyId: "c1" })).toBeNull();
    // "No disputes" is an answer a manager acts on by doing nothing, which is the worst possible
    // response to a queue that is actually full.
    expect(console.error).toHaveBeenCalled();
  });

  it("returns null when the ANSWER read fails, rather than showing everything as open", async () => {
    // Continuing without answers would fill the queue with work that is already done, and a
    // manager re-answering a handled dispute is a worse outcome than seeing an error.
    setEvents([dispute({ id: "d1", at: "2026-09-20T10:00:00Z" })], null, { message: "timeout" });
    expect(await readDisputes({ companyId: "c1" })).toBeNull();
    expect(console.error).toHaveBeenCalled();
  });

  it("does not issue an answer query at all when there are no disputes", async () => {
    // `.in("subject", [])` is a query that can only return nothing; skipping it saves a round trip
    // on the common case, which is a company with an empty queue.
    setEvents([], null, { message: "this must never be reached" });
    expect(await readDisputes({ companyId: "c1" })).toEqual([]);
  });

  it("returns an empty array, not null, when there genuinely are none", async () => {
    setEvents([]);
    expect(await readDisputes({ companyId: "c1" })).toEqual([]);
    expect(console.error).not.toHaveBeenCalled();
  });

  it("skips a malformed event rather than throwing on the whole queue", async () => {
    setEvents([
      { id: "bad", actor: "x", kind: "coach.pitch_score_disputed", subject: "pitch:?", created_at: "2026-09-20T09:00:00Z", payload: {} },
      dispute({ id: "d1", at: "2026-09-20T10:00:00Z" }),
    ]);
    const rows = (await readDisputes({ companyId: "c1" }))!;
    expect(rows.map((r) => r.id)).toEqual(["d1"]);
  });
});
