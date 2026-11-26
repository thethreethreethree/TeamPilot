import { describe, it, expect } from "vitest";
import { removeMember } from "../removeMember";

/** removeMember (2026-11-26): the one place removal rules live — never yourself, never the last active admin, honest. */
function db(opts: { target: Record<string, unknown> | null; activeAdmins?: number; updated?: number }) {
  const writes: unknown[] = [];
  return {
    writes,
    client: {
      from: () => {
        const q: Record<string, unknown> = {};
        let head = false;
        q.select = (_c: string, o?: { head?: boolean }) => ((head = !!o?.head), q);
        q.eq = () => q;
        q.in = () => (head ? Promise.resolve({ count: opts.activeAdmins ?? 2, error: null }) : q);
        q.maybeSingle = async () => ({ data: opts.target, error: null });
        q.update = (v: unknown) => (writes.push(v), { eq: () => ({ eq: () => ({ eq: () => ({ select: async () => ({ data: Array.from({ length: opts.updated ?? 1 }, () => ({ id: "x" })), error: null }) }) }) }) });
        return q;
      },
    } as never,
  };
}

describe("removeMember", () => {
  it("removes an active member (soft: status removed)", async () => {
    const d = db({ target: { id: "m1", role: "Member", status: "active" } });
    expect(await removeMember(d.client, "co1", "admin1", "m1")).toEqual({ ok: true });
    expect(d.writes[0]).toMatchObject({ status: "removed" });
  });
  it("never yourself; never the last active admin; a removed or unknown person is 404", async () => {
    expect(await removeMember(db({ target: { id: "a1", role: "CEO", status: "active" } }).client, "co1", "a1", "a1")).toMatchObject({ ok: false, status: 400 });
    const last = db({ target: { id: "a2", role: "CEO", status: "active" }, activeAdmins: 1 });
    expect(await removeMember(last.client, "co1", "a1", "a2")).toMatchObject({ ok: false, status: 409 });
    expect(last.writes).toEqual([]);
    expect(await removeMember(db({ target: { id: "m1", role: "Member", status: "removed" } }).client, "co1", "a1", "m1")).toMatchObject({ ok: false, status: 404 });
    expect(await removeMember(db({ target: null }).client, "co1", "a1", "m1")).toMatchObject({ ok: false, status: 404 });
  });
  it("a write that touched no row is reported, not claimed", async () => {
    expect(await removeMember(db({ target: { id: "m1", role: "Member", status: "active" }, updated: 0 }).client, "co1", "a1", "m1")).toMatchObject({ ok: false, status: 404 });
  });
});
