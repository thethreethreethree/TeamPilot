import { describe, it, expect, vi, beforeEach } from "vitest";

/** GET /api/coach/remote/:id/follow-through (RSS Phase 6). Pins §3.3: the AI's outcome is withheld ("after-yours")
 *  until the rep has recorded their own; callbacks carry the task they became. */
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/resolveApiAuth", () => ({ resolveApiAuth: vi.fn(async () => ({ userId: "rep1", companyId: "co1" })) }));
vi.mock("@/lib/api/callerScopedDb", () => ({ callerScopedDb: () => null }));
vi.mock("@/lib/data/salesCoach", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/coach/remote/followThrough", () => ({ runFollowThrough: vi.fn(async () => null) }));
const ROW = {
  id: "ft1", suggested_outcome: "follow_up", outcome_why: "Asked for a callback.", outcome_seq: 2, transcript_version: 1,
  callbacks: [{ what: "Call back", due: "2026-11-26", quote: "call me Thursday", seq: 2, atMs: 65000 }],
};
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (t: string) => {
      const b: Record<string, unknown> = {};
      for (const m of ["select", "eq", "order", "limit"]) b[m] = () => b;
      b.maybeSingle = async () => ({ data: ROW, error: null });
      b.then = (res: (v: unknown) => unknown) => res({ data: t === "callback_tasks" ? [{ item_index: 0, task_id: "t9" }] : [], error: null });
      return b;
    },
  }),
}));

import { getSession } from "@/lib/data/salesCoach";
import { GET } from "../route";
const mock = (f: unknown) => f as ReturnType<typeof vi.fn>;
const get = async () => (await GET(new Request("http://t/x") as never, { params: Promise.resolve({ id: "s1" }) })).json();

beforeEach(() => mock(getSession).mockResolvedValue({ id: "s1", context: "phone", outcome: null }));

describe("GET follow-through", () => {
  it("withholds the AI's outcome until the rep records theirs", async () => {
    const body = await get();
    expect(body.read.suggested).toBe("after-yours");
    expect(JSON.stringify(body)).not.toContain("follow_up");
    expect(body.read.callbacks[0]).toMatchObject({ what: "Call back", taskId: "t9" });
  });
  it("shows it beside the rep's once recorded", async () => {
    mock(getSession).mockResolvedValue({ id: "s1", context: "phone", outcome: "sold" });
    const body = await get();
    expect(body.read).toMatchObject({ repOutcome: "sold", suggested: { outcome: "follow_up", why: "Asked for a callback.", seq: 2 } });
  });
  it("door calls have no follow-through panel", async () => {
    mock(getSession).mockResolvedValue({ id: "s1", context: "in_person", outcome: null });
    expect(await get()).toMatchObject({ remote: false, read: null });
  });
});
