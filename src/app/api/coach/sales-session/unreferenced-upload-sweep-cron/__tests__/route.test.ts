import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/storage/sweepUnreferencedUploads", () => ({ sweepUnreferencedUploads: vi.fn() }));
import { sweepUnreferencedUploads } from "@/lib/storage/sweepUnreferencedUploads";
import { GET } from "../route";

const req = (q = "", auth = "Bearer s3cret") => new Request(`http://x/api${q}`, { headers: { authorization: auth } }) as never;
const ok = { dryRun: false, minAgeHours: 24, candidates: 3, candidateBytes: 30, removed: 3, removedBytes: 30, byCompany: {}, error: null };

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "s3cret";
  vi.mocked(sweepUnreferencedUploads).mockResolvedValue(ok);
});

describe("GET unreferenced-upload-sweep-cron", () => {
  it("503 when CRON_SECRET is not set (never runs ungated)", async () => {
    delete process.env.CRON_SECRET;
    expect((await GET(req())).status).toBe(503);
    expect(sweepUnreferencedUploads).not.toHaveBeenCalled();
  });
  it("401 on a wrong secret", async () => {
    expect((await GET(req("", "Bearer nope"))).status).toBe(401);
    expect(sweepUnreferencedUploads).not.toHaveBeenCalled();
  });
  it("sweeps with a 24-hour minimum age", async () => {
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(vi.mocked(sweepUnreferencedUploads).mock.calls[0]![1]).toEqual({ minAgeHours: 24, dryRun: false });
  });
  it("?dryRun=1 lists without removing", async () => {
    await GET(req("?dryRun=1"));
    expect(vi.mocked(sweepUnreferencedUploads).mock.calls[0]![1]).toEqual({ minAgeHours: 24, dryRun: true });
  });
  it("a sweep that did not finish is a 500 that still carries what was removed", async () => {
    vi.mocked(sweepUnreferencedUploads).mockResolvedValue({ ...ok, removed: 1, error: "remove failed after 1 file(s): x" });
    const res = await GET(req());
    expect(res.status).toBe(500);
    const j = await res.json();
    expect(j.removed).toBe(1);
    expect(j.error).not.toContain("remove failed"); // the detail stays in the server log (CWE-209)
  });
});
