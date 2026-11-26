import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * /api/coach/remote/prospects/:pid/playbook (0373; Gong F20.7). Pinned: the replay decides what a note may do (validate
 * needs a written note); the reviewer stores only evidence that cites a line, only where the note's state allows; a
 * suppressed, unusable or failed run says so and stores nothing; a failed read is a 500, never an empty playbook.
 */
const st = vi.hoisted(() => ({
  deal: { id: "d1", rep_id: "rep-1", company_id: "co1" } as unknown,
  playbook: { id: 7, key: "bant", name: "BANT", elements: [{ letter: "B", name: "Budget", question: "Money?" }, { letter: "A", name: "Authority", question: "Who?" }] } as unknown,
  notes: [] as unknown[],
  notesError: null as unknown,
  links: [{ session_id: "s1" }] as unknown[],
  sessions: [{ id: "s1", started_at: "2026-11-20T10:00:00Z", audio_started_at: null, context: "phone", session_kind: "sales" }] as unknown[],
  inserts: [] as Array<{ table: string; rows: unknown; admin: boolean }>,
  insertError: null as { code?: string; message: string } | null,
  ai: { text: "", suppressed: false } as { text: string; suppressed?: boolean },
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/resolveApiAuth", () => ({ resolveApiAuth: vi.fn(async () => ({ userId: "rep-1", companyId: "co1", isAdmin: false })) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/coach/remote/followThrough", () => ({
  loadLines: vi.fn(async () => ({ version: 1, lines: [{ seq: 3, speaker: "customer", text: "Budget is 10k.", atMs: 4000 }] })),
  numberedTranscript: (l: Array<{ seq: number; text: string }>) => l.map((x) => `[${x.seq}] ${x.text}`).join("\n"),
}));
vi.mock("@/lib/claude", () => ({ dealReviewCoach: vi.fn(async () => st.ai) }));
const builder = (table: string, admin: boolean) => {
  const q: Record<string, unknown> = {};
  for (const m of ["select", "eq", "in", "order", "limit"]) q[m] = () => q;
  q.maybeSingle = async () =>
    table === "remote_prospects" ? { data: st.deal, error: null } : table === "deal_playbook_current" ? { data: st.playbook, error: null } : { data: null, error: null };
  q.then = (res: (v: unknown) => unknown) =>
    res(
      table === "deal_element_notes" ? { data: st.notesError ? null : st.notes, error: st.notesError }
      : table === "remote_prospect_calls" ? { data: st.links, error: null }
      : table === "coaching_sessions" ? { data: st.sessions, error: null }
      : { data: [], error: null },
    );
  q.insert = async (rows: unknown) => (st.inserts.push({ table, rows, admin }), { error: st.insertError });
  return q;
};
vi.mock("@/lib/api/callerScopedDb", () => ({ callerScopedDb: () => ({ from: (t: string) => builder(t, false), rpc: async () => ({ data: false }) }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: (t: string) => builder(t, true) }) }));

import { NextRequest } from "next/server";
import { GET, POST } from "../route";
const P = { params: Promise.resolve({ pid: "11111111-1111-4111-8111-111111111111" }) };
const post = (body: unknown) => POST(new NextRequest("http://x/api", { method: "POST", body: JSON.stringify(body) }), P);
const note = (element: number, action: string, extra: Record<string, unknown> = {}) => ({ element, action, note: null, ai: null, actor_id: "rep-1", created_at: "2026-11-27", ...extra });

beforeEach(() => {
  st.notes = [];
  st.notesError = null;
  st.inserts = [];
  st.insertError = null;
  st.ai = { text: "", suppressed: false };
});

describe("the deal's playbook", () => {
  it("each element's current note, from the replay; the deal's rep may validate", async () => {
    st.notes = [note(0, "write", { note: "Budget 10k" }), note(0, "validate"), note(1, "validate")];
    const j = await (await GET(new NextRequest("http://x/api"), P)).json();
    expect(j.notes.map((n: { state: string }) => n.state)).toEqual(["validated", "empty"]);
    expect(j.canValidate).toBe(true);
  });
  it("a failed notes read is a 500, never an empty playbook", async () => {
    st.notesError = { message: "boom" };
    expect((await GET(new NextRequest("http://x/api"), P)).status).toBe(500);
  });
  it("validate needs a written note (409); a write goes through the caller's client", async () => {
    expect((await post({ action: "validate", element: 0 })).status).toBe(409);
    expect(st.inserts).toEqual([]);
    expect((await post({ action: "write", element: 0, note: "Budget 10k" })).status).toBe(200);
    expect(st.inserts).toEqual([{ table: "deal_element_notes", admin: false, rows: expect.objectContaining({ action: "write", note: "Budget 10k", playbook_id: 7, element: 0, company_id: "co1" }) }]);
  });
  it("the policy refusing a validation says who may (403)", async () => {
    st.notes = [note(0, "write", { note: "x" })];
    st.insertError = { code: "42501", message: "rls" };
    expect((await post({ action: "validate", element: 0 })).status).toBe(403);
  });
});

describe("the reviewer", () => {
  it("stores only cited evidence, with the service role, and says how much it found", async () => {
    st.ai = { text: JSON.stringify({ elements: [{ n: 1, answer: "Budget is 10k.", cites: [{ call: "C1", seq: 3 }] }, { n: 2, answer: "Someone.", cites: [] }] }) };
    const j = await (await post({ action: "review" })).json();
    expect(j).toMatchObject({ found: 1, of: 2, calls: 1 });
    expect(st.inserts).toHaveLength(1);
    expect(st.inserts[0]).toMatchObject({ admin: true, rows: [{ element: 0, action: "ai_suggest", ai: { answer: "Budget is 10k.", cites: [{ sessionId: "s1", seq: 3, atMs: 4000 }] } }] });
  });
  it("suppressed (409) and an unusable reply (502) store nothing", async () => {
    st.ai = { text: "", suppressed: true };
    expect((await post({ action: "review" })).status).toBe(409);
    st.ai = { text: "not json" };
    expect((await post({ action: "review" })).status).toBe(502);
    expect(st.inserts).toEqual([]);
  });
  it("no linked calls → says to link them (409)", async () => {
    const links = st.links;
    st.links = [];
    expect((await post({ action: "review" })).status).toBe(409);
    st.links = links;
  });
});
