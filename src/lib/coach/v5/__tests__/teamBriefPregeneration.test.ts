import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * runTeamBriefPregeneration — a failed lookup is not an empty week.
 *
 * The company lookup decides which companies get a brief at all. It used to be caught into
 * `[]`, so a transient database error produced zero companies, zero briefs, and a cheerful
 * `{ ok: true, companies: 0, generated: 0 }` from the cron — indistinguishable from a
 * genuinely quiet week, which is a real and expected state. The weekly brief could stop for
 * every company on the platform and the only symptom would be a success response with two
 * zeroes in it.
 *
 * These pin the distinction. The empty fallback is KEPT — one bad query must not throw away
 * a whole run — but the run now says which zero it is.
 */

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ gte: () => ({ range: () => ({}) }) }) }),
    }),
  }),
}));
vi.mock("@/lib/supabase/paginate", () => ({ fetchAllPaged: vi.fn() }));

import { fetchAllPaged } from "@/lib/supabase/paginate";
import { runTeamBriefPregeneration } from "../teamTrainingBrief";

const mk = <T,>(fn: T) => fn as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("runTeamBriefPregeneration", () => {
  it("says the lookup FAILED, so a total outage cannot read as a quiet week", async () => {
    mk(fetchAllPaged).mockRejectedValue(new Error("connection reset"));
    const r = await runTeamBriefPregeneration();
    expect(r.lookupFailed).toBe(true);
    expect(r.companies).toBe(0);
    expect(r.generated).toBe(0);
  });

  it("a genuinely quiet week reports zero WITHOUT claiming a failure", async () => {
    // No company had coaching activity in the window. Real, expected, and not a problem —
    // flagging it would be the false alarm that teaches everyone to ignore the flag.
    mk(fetchAllPaged).mockResolvedValue([]);
    const r = await runTeamBriefPregeneration();
    expect(r.lookupFailed).toBeUndefined();
    expect(r.companies).toBe(0);
  });

  it("keeps the empty fallback — one bad query does not throw the run away", async () => {
    // The failure is REPORTED, not raised. A throw here would 500 the cron before any of
    // its other work, and the point is to say what happened, not to add a second failure.
    mk(fetchAllPaged).mockRejectedValue(new Error("boom"));
    await expect(runTeamBriefPregeneration()).resolves.toBeDefined();
  });

  it("counts distinct companies and honours the cap", async () => {
    mk(fetchAllPaged).mockResolvedValue([
      { company_id: "a" },
      { company_id: "a" },
      { company_id: "b" },
      { company_id: "c" },
    ]);
    const r = await runTeamBriefPregeneration(2);
    expect(r.companies).toBe(2); // deduped to 3, capped to 2
    expect(r.lookupFailed).toBeUndefined();
  });
});
