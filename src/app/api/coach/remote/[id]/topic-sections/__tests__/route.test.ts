import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * /api/coach/remote/:id/topic-sections (F11.11). Pinned: the call is opened through the caller's client (none → 404);
 * a stored split for the CURRENT transcript is returned without an AI read; a new one is run once and kept as an event
 * of the call's own company; a short transcript isn't split.
 */
const st = vi.hoisted(() => ({
  session: { id: "s1", companyId: "co1", agentId: "r1", context: "phone", sessionKind: "sales", startedAt: "2026-11-27T10:00:00Z", audioStartedAt: null } as unknown,
  lines: Array.from({ length: 8 }, (_, i) => ({ seq: i + 1, speaker: "rep", text: "x", atMs: i * 1000 })),
  stored: null as unknown,
  inserted: [] as unknown[],
  aiCalls: 0,
  ai: { text: JSON.stringify({ sections: [{ label: "Introductions", from: 1, to: 4 }, { label: "Pricing", from: 5, to: 8 }] }) } as { text: string; suppressed?: boolean },
}));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/resolveApiAuth", () => ({ resolveApiAuth: vi.fn(async () => ({ userId: "u1", companyId: "co1" })) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/data/salesCoach", () => ({ getSession: vi.fn(async () => st.session) }));
vi.mock("@/lib/coach/remote/followThrough", () => ({ loadLines: vi.fn(async () => ({ lines: st.lines, version: 3 })), numberedTranscript: () => "T" }));
vi.mock("@/lib/claude", () => ({ topicSectionsCoach: vi.fn(async () => (st.aiCalls++, st.ai)) }));
vi.mock("@/lib/care/toolPrompts", () => ({ CONVERSATION_IS_DATA: "" }));
const q = () => {
  const b: Record<string, unknown> = {};
  for (const m of ["select", "eq", "order", "limit"]) b[m] = () => b;
  b.maybeSingle = async () => ({ data: st.stored ? { payload: st.stored } : null, error: null });
  b.insert = async (row: unknown) => (st.inserted.push(row), { error: null });
  return b;
};
vi.mock("@/lib/api/callerScopedDb", () => ({ callerScopedDb: () => ({ from: q }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: q }) }));
import { GET, POST } from "../route";
import { getSession } from "@/lib/data/salesCoach";
const P = { params: Promise.resolve({ id: "11111111-1111-4111-8111-111111111111" }) };
beforeEach(() => {
  st.stored = null;
  st.inserted = [];
  st.aiCalls = 0;
});

describe("topic sections route", () => {
  it("a call the caller can't open is 404", async () => {
    vi.mocked(getSession).mockResolvedValueOnce(null);
    expect((await GET(new NextRequest("http://x/api"), P)).status).toBe(404);
  });
  it("POST splits once and keeps it as an event of the call's company; a second POST returns the stored split, no AI", async () => {
    const r = await (await POST(new NextRequest("http://x/api", { method: "POST" }), P)).json();
    expect(r.sections.map((s: { label: string }) => s.label)).toEqual(["Introductions", "Pricing"]);
    expect(st.inserted[0]).toMatchObject({ company_id: "co1", kind: "coach.session_topic_sections", subject: "sales_session:11111111-1111-4111-8111-111111111111", payload: { transcript_version: 3 } });
    st.stored = (st.inserted[0] as { payload: unknown }).payload;
    const again = await (await POST(new NextRequest("http://x/api", { method: "POST" }), P)).json();
    expect(again.stored).toBe(true);
    expect(st.aiCalls).toBe(1);
  });
  it("an unusable AI answer stores nothing", async () => {
    st.ai = { text: "nope" };
    expect((await POST(new NextRequest("http://x/api", { method: "POST" }), P)).status).toBe(502);
    expect(st.inserted).toEqual([]);
    st.ai = { text: JSON.stringify({ sections: [{ label: "Introductions", from: 1, to: 4 }, { label: "Pricing", from: 5, to: 8 }] }) };
  });
  it("a transcript too short to split is refused", async () => {
    const keep = st.lines;
    st.lines = keep.slice(0, 3);
    expect((await POST(new NextRequest("http://x/api", { method: "POST" }), P)).status).toBe(409);
    st.lines = keep;
  });
});
