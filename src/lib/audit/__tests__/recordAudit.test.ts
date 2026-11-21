import { describe, it, expect, vi } from "vitest";
import { recordAudit } from "../recordAudit";

/** recordAudit (RSS Phase 8, 0284): one row per action, never throws, says whether the row landed. */
function db(result: { error: { message: string } | null } | Error) {
  const rows: Array<{ table: string; row: unknown }> = [];
  return {
    rows,
    client: {
      from: (table: string) => ({
        insert: async (row: unknown) => {
          if (result instanceof Error) throw result;
          rows.push({ table, row });
          return result;
        },
      }),
    } as never,
  };
}

describe("recordAudit", () => {
  it("writes one audit_log row in the 0284 shape", async () => {
    const { client, rows } = db({ error: null });
    const ok = await recordAudit(client, {
      companyId: "co1", actorId: "m1", action: "recording.delete", objectType: "coaching_session", objectId: "s1", meta: { chunksRemoved: 2 },
    });
    expect(ok).toBe(true);
    expect(rows).toEqual([
      { table: "audit_log", row: { company_id: "co1", actor_id: "m1", action: "recording.delete", object_type: "coaching_session", object_id: "s1", meta: { chunksRemoved: 2 } } },
    ]);
  });
  it("a refused insert is logged and reported, not thrown (the action already happened)", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = db({ error: { message: 'relation "audit_log" does not exist' } });
    expect(await recordAudit(client, { companyId: "co1", actorId: "m1", action: "session.export", objectType: "call_search", objectId: "d" })).toBe(false);
    expect(err.mock.calls[0]![0]).toContain("NOT RECORDED session.export");
  });
  it("a throwing client is reported, not thrown", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = db(new Error("down"));
    await expect(recordAudit(client, { companyId: "co1", actorId: null, action: "score.override", objectType: "pitch_score", objectId: "p" })).resolves.toBe(false);
  });
});
