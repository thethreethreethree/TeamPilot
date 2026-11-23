import { describe, it, expect, vi } from "vitest";

/**
 * Gong F16.9: coaching is counted by WHEN IT HAPPENED (last 30 days), not by when the call started. A manager who
 * reviews a 45-day-old call today did coaching today; a comment from 40 days ago is outside the window.
 */
const DAY = 86_400_000;
const now = Date.now();
const iso = (daysAgo: number) => new Date(now - daysAgo * DAY).toISOString();

vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/audit/recordAudit", () => ({ recordAudit: vi.fn(async () => true) }));
vi.mock("@/lib/api/requireSalesCoachManager", () => ({ requireSalesCoachManager: vi.fn(async () => ({ userId: "mgr1", companyId: "co1" })) }));
vi.mock("@/lib/api/treeAccess", () => ({ treeFilterReps: vi.fn(async (_r: unknown, ids: string[]) => ids) }));
vi.mock("@/lib/coach/remote/feedback", async (orig) => ({
  ...(await orig<typeof import("@/lib/coach/remote/feedback")>()),
  loadCoachingEvents: vi.fn(async () => [
    { kind: "comment_sent_to_rep", managerId: "m1", repId: "r1", at: new Date(iso(1)), sessionId: "old" }, // today-ish, old call → counts
    { kind: "comment_sent_to_rep", managerId: "m2", repId: "r1", at: new Date(iso(40)), sessionId: "old" }, // 40 days ago → not
    { kind: "comment_draft", managerId: "m1", repId: "r1", at: new Date(iso(1)), sessionId: "old" }, // a draft never counts
  ]),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const q: Record<string, unknown> = {};
      const filters: Array<[string, unknown]> = [];
      for (const m of ["select", "eq", "in", "order", "range", "limit"]) q[m] = () => q;
      q.gte = (col: string, v: unknown) => (filters.push([col, v]), q);
      (q as { then: unknown }).then = (res: (v: unknown) => unknown) => {
        if (table === "profiles") return Promise.resolve(res({ data: [{ id: "m1", full_name: "=Mia (manager)" }], error: null }));
        if (table === "coaching_sessions") {
          // The calls window reaches back far enough for a 45-day-old call.
          const since = String(filters.find(([c]) => c === "started_at")?.[1]);
          const rows = [{ id: "old", agent_id: "r1", started_at: iso(45), ended_at: iso(45), audio_duration_seconds: 600 }].filter((r) => r.started_at >= since);
          return Promise.resolve(res({ data: rows, error: null }));
        }
        // listen_events: the read must be limited to the last 30 days (created_at).
        const since = String(filters.find(([c]) => c === "created_at")?.[1]);
        const rows = [
          { session_id: "old", listener_id: "m1", rep_id: "r1", from_ms: 0, to_ms: 400_000, created_at: iso(2) },
          { session_id: "old", listener_id: "m2", rep_id: "r1", from_ms: 0, to_ms: 600_000, created_at: iso(35) },
        ].filter((r) => r.created_at >= since);
        return Promise.resolve(res({ data: rows, error: null }));
      };
      return q;
    },
  }),
}));

import { GET } from "../route";
import { recordAudit } from "@/lib/audit/recordAudit";

describe("coaching export (F16.11)", () => {
  it("?format=csv: the same numbers as the panel, one row per person, formula-safe, audited", async () => {
    const res = await GET(new Request("http://t/x?format=csv") as never);
    expect(res.headers.get("Content-Type")).toContain("text/csv");
    expect(res.headers.get("Content-Disposition")).toMatch(/attachment; filename="coaching-\d{4}-\d{2}-\d{2}\.csv"/);
    const csv = await res.text();
    const [header, row] = csv.trim().split("\r\n");
    expect(header).toBe("person,feedback_given,calls_listened,period_start,period_end");
    expect(row).toMatch(/^"?'=Mia \(manager\)"?,1,1,/); // a leading "=" is neutralized so a spreadsheet can't run it
    expect(recordAudit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: "session.export", meta: { kind: "coaching_metrics", rows: 1 } }));
  });
});
