import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after: (fn: () => unknown) => void fn() }));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/resolveApiAuth", () => ({ resolveApiAuth: vi.fn() }));
vi.mock("@/lib/api/requireSalesCoachManager", () => ({ requireSalesCoachManager: vi.fn() }));
vi.mock("@/lib/api/treeAccess", () => ({ treeAllowsRep: vi.fn() }));
vi.mock("@/lib/api/callerScopedDb", () => ({ callerScopedDb: () => null }));
vi.mock("@/lib/audit/recordAudit", () => ({ recordAudit: vi.fn(async () => true) }));
vi.mock("@/lib/coach/remote/trackerScan", () => ({ scanSessionTrackers: vi.fn(async () => 0) }));
vi.mock("@/lib/coach/remote/interactionStats", () => ({ storeInteractionStats: vi.fn(async () => null) }));
vi.mock("@/lib/data/salesCoach", () => ({ getSession: vi.fn(), getSessionTranscript: vi.fn() }));
vi.mock("@/lib/coach/v5/generateSessionArtifacts", () => ({ generateSessionArtifacts: vi.fn(async () => ({})) }));
const st = vi.hoisted(() => ({ rpc: vi.fn(), edits: { data: [] as unknown[] | null, error: null as unknown, count: 0 as number | null | undefined } as { data: unknown[] | null; error: unknown; count?: number | null } }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: st.rpc }) }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: () => {
      const b: Record<string, unknown> = {};
      for (const m of ["select", "eq", "in", "order", "limit"]) b[m] = () => b;
      b.then = (r: (v: unknown) => unknown) => r(st.edits);
      return b;
    },
  }),
}));

import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { requireSalesCoachManager } from "@/lib/api/requireSalesCoachManager";
import { treeAllowsRep } from "@/lib/api/treeAccess";
import { recordAudit } from "@/lib/audit/recordAudit";
import { scanSessionTrackers } from "@/lib/coach/remote/trackerScan";
import { getSession, getSessionTranscript } from "@/lib/data/salesCoach";
import { generateSessionArtifacts } from "@/lib/coach/v5/generateSessionArtifacts";
import { GET, POST, PUT } from "../route";

const P = { params: Promise.resolve({ id: "s1" }) };
const post = (body: unknown) => new Request("http://x/api", { method: "POST", body: JSON.stringify(body) }) as never;
const get = () => new Request("http://x/api") as never;
const asUser = (userId: string) => vi.mocked(resolveApiAuth).mockResolvedValue({ userId, companyId: "co1" } as never);

beforeEach(() => {
  vi.clearAllMocks();
  asUser("rep1");
  vi.mocked(getSession).mockResolvedValue({ id: "s1", companyId: "co1", agentId: "rep1", status: "completed" } as never);
  vi.mocked(getSessionTranscript).mockResolvedValue([{ seq: 1, text: "we can do fifty", speaker: "agent" }] as never);
  vi.mocked(requireSalesCoachManager).mockResolvedValue(null);
  vi.mocked(treeAllowsRep).mockResolvedValue(false);
  st.rpc.mockResolvedValue({ data: 2, error: null });
  st.edits = { data: [], error: null };
});

describe("POST transcript-edit", () => {
  it("the call's rep corrects a line: one versioned edit, audited, trackers redone", async () => {
    const r = await POST(post({ seq: 1, text: "  we can do fifteen " }), P);
    expect(await r.json()).toEqual({ ok: true, changed: true, version: 2 });
    expect(st.rpc).toHaveBeenCalledWith("edit_transcript_line", { p_session_id: "s1", p_seq: 1, p_text: "we can do fifteen", p_editor: "rep1" });
    expect(recordAudit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: "transcript.edit", objectId: "s1" }));
    expect(scanSessionTrackers).toHaveBeenCalled();
  });
  it("a manager over the rep may correct it; one outside the tree, or a peer, may not", async () => {
    asUser("mgr1");
    vi.mocked(requireSalesCoachManager).mockResolvedValue({ userId: "mgr1", companyId: "co1" });
    vi.mocked(treeAllowsRep).mockResolvedValue(true);
    expect((await POST(post({ seq: 1, text: "fixed" }), P)).status).toBe(200);
    vi.mocked(treeAllowsRep).mockResolvedValue(false);
    expect((await POST(post({ seq: 1, text: "fixed" }), P)).status).toBe(403);
    vi.mocked(requireSalesCoachManager).mockResolvedValue(null);
    asUser("peer");
    expect((await POST(post({ seq: 1, text: "fixed" }), P)).status).toBe(403);
    expect(st.rpc).toHaveBeenCalledTimes(1);
  });
  it("refuses a call the caller can't open, a live call, a missing (or trimmed) line, and a bad body", async () => {
    vi.mocked(getSession).mockResolvedValueOnce(null);
    expect((await POST(post({ seq: 1, text: "x" }), P)).status).toBe(404);
    vi.mocked(getSession).mockResolvedValueOnce({ id: "s1", companyId: "co1", agentId: "rep1", status: "active" } as never);
    expect((await POST(post({ seq: 1, text: "x" }), P)).status).toBe(409);
    expect((await POST(post({ seq: 7, text: "x" }), P)).status).toBe(404);
    expect((await POST(post({ seq: 1, text: "  " }), P)).status).toBe(400);
    expect(st.rpc).not.toHaveBeenCalled();
  });
  it("a typed card number is stored redacted, like every transcript line (D15)", async () => {
    await POST(post({ seq: 1, text: "card 4111 1111 1111 1111 please" }), P);
    expect(st.rpc).toHaveBeenCalledWith("edit_transcript_line", expect.objectContaining({ p_text: "card [number removed] please" }));
  });
  it("the same words change nothing", async () => {
    expect(await (await POST(post({ seq: 1, text: "we can do fifty" }), P)).json()).toEqual({ ok: true, changed: false });
    expect(st.rpc).not.toHaveBeenCalled();
  });
  it("a failed save is a 500, not a silent success", async () => {
    st.rpc.mockResolvedValue({ data: null, error: { code: "XX000", message: "boom" } });
    expect((await POST(post({ seq: 1, text: "fixed" }), P)).status).toBe(500);
    expect(recordAudit).not.toHaveBeenCalled();
  });
});

describe("GET transcript-edit", () => {
  it("canEdit for the rep, not while the call is live", async () => {
    expect(await (await GET(get(), P)).json()).toEqual({ canEdit: true, edits: [] });
    vi.mocked(getSession).mockResolvedValueOnce({ id: "s1", companyId: "co1", agentId: "rep1", status: "active" } as never);
    expect(await (await GET(get(), P)).json()).toMatchObject({ canEdit: false });
  });
  it("a failed edits read is a 500", async () => {
    st.edits = { data: null, error: { code: "XX000", message: "x" } };
    expect((await GET(get(), P)).status).toBe(500);
  });

  describe("POST { speaker } — who said the line (0328)", () => {
    it("the call's rep changes a line's speaker; audited as a transcript edit of the speaker", async () => {
      st.rpc.mockResolvedValueOnce({ data: 3, error: null });
      const r = await POST(post({ seq: 1, speaker: "customer" }), P);
      expect(await r.json()).toEqual({ ok: true, changed: true, version: 3 });
      expect(st.rpc).toHaveBeenCalledWith("edit_transcript_speaker", { p_session_id: "s1", p_seq: 1, p_speaker: "customer", p_editor: "rep1" });
      expect(vi.mocked(recordAudit).mock.calls[0]![1]).toMatchObject({ action: "transcript.edit", meta: { field: "speaker" } });
    });
    it("only rep or customer; a stranger is refused", async () => {
      expect((await POST(post({ seq: 1, speaker: "unknown" }), P)).status).toBe(400);
      asUser("stranger");
      expect((await POST(post({ seq: 1, speaker: "customer" }), P)).status).toBe(403);
      expect(st.rpc).not.toHaveBeenCalled();
    });
  });

  describe("PUT — refresh the AI notes after corrections", () => {
    const put = () => PUT(new Request("http://x/api", { method: "PUT" }) as never, P);
    it("the call's rep, with corrections: audited, then the notes are redone", async () => {
      st.edits = { data: null, error: null, count: 2 };
      const r = await put();
      expect(r.status).toBe(200);
      expect(vi.mocked(recordAudit).mock.calls[0]![1]).toMatchObject({ action: "transcript.refresh_notes", meta: { corrections: 2 } });
      await vi.waitFor(() => expect(generateSessionArtifacts).toHaveBeenCalledTimes(1));
    });
    it("no corrections: refused, nothing paid for", async () => {
      st.edits = { data: null, error: null, count: 0 };
      expect((await put()).status).toBe(409);
      expect(generateSessionArtifacts).not.toHaveBeenCalled();
    });
    it("a meeting or huddle has no AI notes: refused", async () => {
      vi.mocked(getSession).mockResolvedValue({ id: "s1", companyId: "co1", agentId: "rep1", status: "completed", sessionKind: "meeting" } as never);
      st.edits = { data: null, error: null, count: 2 };
      expect((await put()).status).toBe(409);
      expect(generateSessionArtifacts).not.toHaveBeenCalled();
    });
    it("someone who can't edit is refused", async () => {
      asUser("stranger");
      st.edits = { data: null, error: null, count: 2 };
      expect((await put()).status).toBe(403);
      expect(generateSessionArtifacts).not.toHaveBeenCalled();
    });
  });
});

