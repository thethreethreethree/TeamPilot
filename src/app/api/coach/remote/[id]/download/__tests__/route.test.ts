import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/callerScopedDb", () => ({ callerScopedDb: () => ({}) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => ({})) }));
vi.mock("@/lib/api/requireSalesCoachManager", () => ({ requireSalesCoachManager: vi.fn() }));
vi.mock("@/lib/api/treeAccess", () => ({ treeAllowsRep: vi.fn(async () => true) }));
vi.mock("@/lib/audit/recordAudit", () => ({ recordAudit: vi.fn(async () => true) }));
vi.mock("@/lib/data/salesCoach", () => ({ getSession: vi.fn(), getSessionTranscript: vi.fn() }));
vi.mock("@/lib/storage/assets", () => ({
  assetUrlToStoragePath: (u: string | null) => (u ? u.replace(/^assets-v1\//, "") : null),
  signAssetUrl: vi.fn(async () => "https://signed.example/audio"),
}));
const db = vi.hoisted(() => ({ trims: [] as Array<{ id: string }>, restores: [] as Array<{ trim_id: string }> }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (t: string) => {
      const b: Record<string, unknown> = {};
      for (const m of ["select", "eq", "in"]) b[m] = () => b;
      b.then = (res: (v: unknown) => unknown) => res({ data: t === "recording_trims" ? db.trims : db.restores, error: null });
      return b;
    },
  }),
}));

import { requireSalesCoachManager } from "@/lib/api/requireSalesCoachManager";
import { treeAllowsRep } from "@/lib/api/treeAccess";
import { recordAudit } from "@/lib/audit/recordAudit";
import { getSession, getSessionTranscript } from "@/lib/data/salesCoach";
import { GET } from "../route";

const ID = "11111111-1111-4111-8111-111111111111";
const req = (q: string) => {
  const u = new URL(`http://x/api/coach/remote/${ID}/download?${q}`);
  return { nextUrl: u, url: u.toString(), headers: new Headers() } as never;
};
const ctx = { params: Promise.resolve({ id: ID }) };
const SESSION = { id: ID, companyId: "co1", agentId: "rep1", clientLabel: "Acme", startedAt: "2026-11-20T10:00:00.000Z", audioStartedAt: null, audioAssetUrl: "assets-v1/co1/2026/11/a.m4a" };

beforeEach(() => {
  vi.clearAllMocks();
  db.trims = [];
  db.restores = [];
  vi.mocked(requireSalesCoachManager).mockResolvedValue({ userId: "mgr1", companyId: "co1" });
  vi.mocked(getSession).mockResolvedValue(SESSION as never);
  vi.mocked(getSessionTranscript).mockResolvedValue([
    { speaker: "agent", text: "Hi there", spokenAt: "2026-11-20T10:00:05.000Z" },
    { speaker: "customer", text: "Hello", spokenAt: "2026-11-20T10:01:10.000Z" },
  ] as never);
});

describe("GET /api/coach/remote/[id]/download", () => {
  it("managers only", async () => {
    vi.mocked(requireSalesCoachManager).mockResolvedValue(null);
    expect((await GET(req("kind=transcript"), ctx)).status).toBe(403);
  });
  it("another company's call, or a rep outside the tree, is not found", async () => {
    vi.mocked(getSession).mockResolvedValueOnce({ ...SESSION, companyId: "co2" } as never);
    expect((await GET(req("kind=transcript"), ctx)).status).toBe(404);
    vi.mocked(treeAllowsRep).mockResolvedValueOnce(false);
    expect((await GET(req("kind=transcript"), ctx)).status).toBe(404);
  });
  it("transcript: the current version as text, timed from the audio clock, audited", async () => {
    const res = await GET(req("kind=transcript"), ctx);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toContain("Acme-2026-11-20-transcript.txt");
    const body = await res.text();
    expect(body).toContain("[0:05] Rep: Hi there");
    expect(body).toContain("[1:10] Customer: Hello");
    expect(recordAudit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: "session.download", objectId: ID, meta: { kind: "transcript" } }));
  });
  it("audio with an active trim is refused — the file still holds what was trimmed", async () => {
    db.trims = [{ id: "t1" }];
    const res = await GET(req("kind=audio&json=1"), ctx);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toContain("trimmed sections");
    expect(recordAudit).not.toHaveBeenCalled();
  });
  it("audio with every trim restored: a short signed link, audited", async () => {
    db.trims = [{ id: "t1" }];
    db.restores = [{ trim_id: "t1" }];
    const res = await GET(req("kind=audio&json=1"), ctx);
    expect(res.status).toBe(200);
    expect((await res.json()).url).toBe("https://signed.example/audio");
    expect(recordAudit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ meta: { kind: "audio" } }));
  });
  it("a bad kind or id is a 400", async () => {
    expect((await GET(req("kind=video"), ctx)).status).toBe(400);
  });
});
