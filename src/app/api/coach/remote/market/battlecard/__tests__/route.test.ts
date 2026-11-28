import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/** The battlecard route (E14). Pinned: the asker's own calls (the Market read), newest 10 naming it, the fixed instruction, save: false; none → 404; a failed read → 500. */
const st = vi.hoisted(() => ({ inputs: null as unknown, asked: [] as unknown[] }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/resolveApiAuth", () => ({ resolveApiAuth: vi.fn(async () => ({ userId: "u1", companyId: "co1" })) }));
vi.mock("@/lib/api/callerScopedDb", () => ({ callerScopedDb: () => ({ caller: true, from: () => ({ select: () => ({ in: async () => ({ data: [] }) }) }) }) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/coach/remote/marketRead", () => ({ readMarketInputs: vi.fn(async () => st.inputs) }));
vi.mock("@/lib/coach/remote/askCoach", () => ({ askCoach: vi.fn(async (a: unknown) => (st.asked.push(a), { ok: true, chatId: null, answer: "x [1]", citations: [], suppressed: false })) }));
import { POST } from "../route";

const post = (b: unknown) => POST(new NextRequest("http://x/api", { method: "POST", body: JSON.stringify(b), headers: { "content-type": "application/json" } }));
const call = (id: string, at: string) => ({ sessionId: id, startedAt: at, outcome: null });
beforeEach(() => {
  st.asked = [];
  const calls = Array.from({ length: 12 }, (_, i) => call(`s${i}`, `2026-11-${String(10 + i).padStart(2, "0")}`)).concat([call("other", "2026-11-25")]);
  const intel = new Map(calls.map((c) => [c.sessionId, { competitors: c.sessionId === "other" ? ["Comcast"] : [" spectrum "], topics: [] }]));
  st.inputs = { ok: true, calls, intel };
});

describe("battlecard route", () => {
  it("asks the newest 10 calls that named it (the page's grouping), with the fixed instruction, not saved", async () => {
    const r = await post({ competitor: "Spectrum" });
    expect(r.status).toBe(200);
    expect((await r.json()).calls).toBe(10);
    const a = st.asked[0] as { sessionIds: string[]; question: string; save: boolean; db: unknown; userId: string };
    expect(a.sessionIds).toEqual(["s11", "s10", "s9", "s8", "s7", "s6", "s5", "s4", "s3", "s2"]);
    expect(a.question).toMatch(/battlecard about the competitor "Spectrum"/);
    expect(a).toMatchObject({ save: false, userId: "u1", db: { caller: true } });
    // the asker's own client names the cited calls
    expect(a.db).toHaveProperty("from");
  });
  it("no call named it → 404, nothing asked; a failed read → 500", async () => {
    expect((await post({ competitor: "Nobody" })).status).toBe(404);
    expect(st.asked).toEqual([]);
    st.inputs = { ok: false, what: "sessions", message: "boom" };
    expect((await post({ competitor: "Spectrum" })).status).toBe(500);
  });
});
