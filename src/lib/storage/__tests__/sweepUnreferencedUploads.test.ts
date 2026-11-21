import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../audit/recordAudit", () => ({ recordAudit: vi.fn(async () => true) }));
import { recordAudit } from "../../audit/recordAudit";
import { sweepUnreferencedUploads } from "../sweepUnreferencedUploads";

type Cand = { name: string; company_id: string; bytes: number; created_at: string; mimetype: string };
const cand = (co: string, n: number, bytes = 1000): Cand => ({ name: `${co}/2026/09/f${n}.m4a`, company_id: co, bytes, created_at: "2026-09-01T00:00:00Z", mimetype: "audio/m4a" });

function fakeAdmin(opts: { list?: Cand[]; listError?: string; confirm?: (batch: string[]) => string[]; removeErrorAt?: number }) {
  const calls = { rpc: [] as Array<{ fn: string; args: unknown }>, removes: [] as string[][] };
  const admin = {
    rpc: async (fn: string, args: unknown) => {
      calls.rpc.push({ fn, args });
      return opts.listError ? { data: null, error: { message: opts.listError } } : { data: opts.list ?? [], error: null };
    },
    storage: {
      from: (bucket: string) => ({
        remove: async (batch: string[]) => {
          expect(bucket).toBe("assets-v1");
          calls.removes.push(batch);
          if (opts.removeErrorAt !== undefined && calls.removes.length - 1 === opts.removeErrorAt) return { data: null, error: { message: "storage down" } };
          const ok = opts.confirm ? opts.confirm(batch) : batch;
          return { data: ok.map((name) => ({ name })), error: null };
        },
      }),
    },
  };
  return { admin: admin as never, calls };
}

beforeEach(() => vi.clearAllMocks());

describe("sweepUnreferencedUploads", () => {
  it("asks the ONE rule (rss_unreferenced_uploads) with the minimum age; a dry run removes nothing and audits nothing", async () => {
    const { admin, calls } = fakeAdmin({ list: [cand("A", 1, 500), cand("B", 2, 700)] });
    const r = await sweepUnreferencedUploads(admin, { minAgeHours: 168, dryRun: true });
    expect(calls.rpc).toEqual([{ fn: "rss_unreferenced_uploads", args: { p_min_age: "168 hours", p_limit: 500 } }]);
    expect(calls.removes).toEqual([]);
    expect(recordAudit).not.toHaveBeenCalled();
    expect(r).toMatchObject({ dryRun: true, candidates: 2, candidateBytes: 1200, removed: 0, byCompany: { A: { files: 1, bytes: 500 }, B: { files: 1, bytes: 700 } } });
  });
  it("removes in batches of 100 and counts ONLY what Storage confirms (a silent no-op is not a removal)", async () => {
    const list = Array.from({ length: 150 }, (_, i) => cand("A", i));
    const { admin, calls } = fakeAdmin({ list, confirm: (b) => b.filter((n) => !n.endsWith("f7.m4a")) });
    const r = await sweepUnreferencedUploads(admin, { minAgeHours: 24, dryRun: false });
    expect(calls.removes.map((b) => b.length)).toEqual([100, 50]);
    expect(r).toMatchObject({ candidates: 150, removed: 149, error: null });
  });
  it("one audit row per company, system actor, naming exactly the removed paths", async () => {
    const { admin } = fakeAdmin({ list: [cand("A", 1), cand("A", 2), cand("B", 3)], confirm: (b) => b.filter((n) => n !== "A/2026/09/f2.m4a") });
    await sweepUnreferencedUploads(admin, { minAgeHours: 24, dryRun: false });
    expect(recordAudit).toHaveBeenCalledTimes(2);
    const byCo = Object.fromEntries(vi.mocked(recordAudit).mock.calls.map(([, e]) => [e.companyId, e]));
    expect(byCo.A).toMatchObject({ actorId: null, action: "recording.orphan_purge", objectType: "storage_bucket", objectId: "assets-v1" });
    expect(byCo.A!.meta).toMatchObject({ files: 1, paths: ["A/2026/09/f1.m4a"], minAgeHours: 24 });
    expect(byCo.B!.meta).toMatchObject({ files: 1, paths: ["B/2026/09/f3.m4a"] });
  });
  it("a removal failure stops the run, reports it, and still audits what was removed before it", async () => {
    const list = Array.from({ length: 150 }, (_, i) => cand("A", i));
    const { admin, calls } = fakeAdmin({ list, removeErrorAt: 1 });
    const r = await sweepUnreferencedUploads(admin, { minAgeHours: 24, dryRun: false });
    expect(calls.removes).toHaveLength(2);
    expect(r.removed).toBe(100);
    expect(r.error).toContain("remove failed after 100");
    expect(vi.mocked(recordAudit).mock.calls[0]![1].meta).toMatchObject({ files: 100 });
  });
  it("a failed list removes nothing and says so (never 'nothing to sweep')", async () => {
    const { admin, calls } = fakeAdmin({ listError: "permission denied" });
    const r = await sweepUnreferencedUploads(admin, { minAgeHours: 24, dryRun: false });
    expect(calls.removes).toEqual([]);
    expect(r.error).toContain("list failed");
  });
  it("the minimum age never goes below one hour", async () => {
    const { admin, calls } = fakeAdmin({ list: [] });
    await sweepUnreferencedUploads(admin, { minAgeHours: 0, dryRun: true });
    expect((calls.rpc[0]!.args as { p_min_age: string }).p_min_age).toBe("1 hours");
  });
});
