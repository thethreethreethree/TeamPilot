import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/resolveApiAuth", () => ({ resolveApiAuth: vi.fn(async () => ({ userId: "u1", companyId: "co1", isAdmin: false })) }));
vi.mock("@/lib/storage/assets", () => ({ assetUrlToStoragePath: () => "p", signAssetUrl: vi.fn(async () => "https://signed/a") }));
const st = vi.hoisted(() => ({ grant: null as unknown, audits: [] as unknown[], reads: [] as string[] }));
vi.mock("@/lib/coach/remote/callGrants", () => ({ activeGrant: vi.fn(async () => st.grant) }));
vi.mock("@/lib/audit/recordAudit", () => ({ recordAudit: vi.fn(async (_a: unknown, e: unknown) => (st.audits.push(e), true)) }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (t: string) => {
      st.reads.push(t);
      const q: Record<string, unknown> = {};
      for (const m of ["select", "eq", "order", "limit", "in"]) q[m] = () => q;
      q.maybeSingle = async () => ({ data: t === "coaching_sessions" ? { agent_id: "rep1", client_label: "Acme", started_at: "2026-11-20T10:00:00Z", audio_asset_url: "assets/a" } : { full_name: "Rae" }, error: null });
      q.then = (res: (v: unknown) => unknown) =>
        res({ data: t === "coaching_transcript_segments_current" ? [{ speaker: "customer", text: "Too pricey", seq: 1 }] : t === "remote_call_briefs" ? [{ key_points: [{ text: "Price matters" }], next_steps: [] }] : [], error: null });
      return q;
    },
  }),
}));
import { GET } from "../route";

const get = () => GET(new Request("http://x") as never, { params: Promise.resolve({ id: "s1" }) });
beforeEach(() => {
  st.grant = null;
  st.audits = [];
  st.reads = [];
});

describe("GET shared call (0336)", () => {
  it("no active grant: 404 and nothing about the call is read", async () => {
    expect((await get()).status).toBe(404);
    expect(st.reads).toEqual([]);
    expect(st.audits).toEqual([]);
  });
  it("an active grant: the call, transcript, highlights and audio — and the open is audited", async () => {
    st.grant = { id: "g1", reason: "training" };
    const j = await (await get()).json();
    expect(j).toMatchObject({ call: { label: "Acme", repName: "Rae" }, reason: "training", audioUrl: "https://signed/a", highlights: { keyPoints: ["Price matters"] } });
    expect(j.transcript).toEqual([{ speaker: "customer", text: "Too pricey", seq: 1 }]);
    expect(st.audits).toEqual([expect.objectContaining({ action: "call.view_granted", objectId: "s1", meta: { grantId: "g1" } })]);
  });
});
