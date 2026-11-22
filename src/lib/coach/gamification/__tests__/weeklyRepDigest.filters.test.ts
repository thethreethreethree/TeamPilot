import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/care/email/configured", () => ({ emailConfigured: () => true }));
vi.mock("@/lib/care/email/outbound", () => ({ sendTransactionalEmail: vi.fn() }));

import { runWeeklyRepDigest } from "../weeklyDigest";

/**
 * 2026-11-23. The reps' weekly email counted "Deals" with its outcome and week filters sitting INSIDE a code comment, so
 * every in-person session ever, of any outcome, was a deal this week. The fake below APPLIES in/eq/gte to its rows, so
 * a query that loses a filter returns the wrong rows here exactly as it would against the database.
 */

type Row = Record<string, unknown>;

function tableDb(tables: Record<string, Row[]>) {
  const query = (table: string) => {
    let rows = [...(tables[table] ?? [])];
    const q: Record<string, unknown> = {
      select: () => q,
      in: (col: string, vals: unknown[]) => ((rows = rows.filter((r) => vals.includes(r[col]))), q),
      eq: (col: string, val: unknown) => ((rows = rows.filter((r) => r[col] === val)), q),
      gte: (col: string, val: string) => ((rows = rows.filter((r) => String(r[col]) >= val)), q),
      then: (res: (v: unknown) => unknown) => res({ data: rows, error: null }),
    };
    return q;
  };
  return {
    from: query,
    auth: { admin: { getUserById: async (id: string) => ({ data: { user: { email: `${id}@example.test` } } }) } },
  } as never;
}

const NOW = Date.parse("2026-11-23T12:00:00Z");
const THIS_WEEK = "2026-11-21T10:00:00Z";
const LAST_MONTH = "2026-10-20T10:00:00Z";

describe("the reps' weekly email counts deals from this week's sold in-person calls only", () => {
  it("not a no-sale, not last month's sale, not a phone call", async () => {
    const sent: Array<{ to: string; textBody: string }> = [];
    const admin = tableDb({
      agent_point_ledger_by_channel: [
        { agent_id: "rep-1", points: 70, session_id: "s1", channel: "in_person", reason: "session_score", created_at: THIS_WEEK },
      ],
      coaching_sessions: [
        { agent_id: "rep-1", context: "in_person", outcome: "sold", created_at: THIS_WEEK },
        { agent_id: "rep-1", context: "in_person", outcome: "no_sale", created_at: THIS_WEEK },
        { agent_id: "rep-1", context: "in_person", outcome: "sold", created_at: LAST_MONTH },
        { agent_id: "rep-1", context: "phone", outcome: "sold", created_at: THIS_WEEK },
      ],
      profiles: [{ id: "rep-1", full_name: "Pat Rep" }],
    });
    const result = await runWeeklyRepDigest({
      admin,
      now: NOW,
      appBaseUrl: "https://app.test",
      send: (async (m: { to: string; textBody: string }) => {
        sent.push(m);
        return { ok: true };
      }) as never,
    });
    expect(result.repsEmailed).toBe(1);
    expect(sent[0]!.textBody).toContain("Deals: 1");
  });

  it("a rep whose only in-person sessions are old or unsold gets no email", async () => {
    const send = vi.fn(async () => ({ ok: true }));
    const admin = tableDb({
      agent_point_ledger_by_channel: [],
      coaching_sessions: [
        { agent_id: "rep-2", context: "in_person", outcome: "no_sale", created_at: THIS_WEEK },
        { agent_id: "rep-2", context: "in_person", outcome: "sold", created_at: LAST_MONTH },
      ],
      profiles: [{ id: "rep-2", full_name: "Sam" }],
    });
    const result = await runWeeklyRepDigest({ admin, now: NOW, send: send as never });
    expect(send).not.toHaveBeenCalled();
    expect(result.repsEmailed).toBe(0);
  });
});
