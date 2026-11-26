import { describe, it, expect } from "vitest";
import { AccountReadError, listAccounts } from "../accounts";

/** The accounts list (0370, 0375): roll-ups from the deals in view, activity from two-way calls, a failed read throws. */
function db(o: { deals: unknown[]; accounts: unknown[]; contacts?: unknown[]; activity?: unknown[]; fail?: string }) {
  const from = (table: string) => {
    const q: Record<string, unknown> = {};
    for (const m of ["select", "not", "order", "limit", "eq", "in", "ilike"]) q[m] = () => q;
    const data = table === "remote_prospects_current" ? o.deals : table === "accounts_current" ? o.accounts : table === "contacts_current" ? (o.contacts ?? []) : [];
    const res = o.fail === table ? { data: null, error: { message: "boom" } } : { data, error: null };
    q.then = (r: (v: unknown) => unknown) => Promise.resolve(r(res));
    q.range = (fromRow: number) => Promise.resolve(fromRow > 0 ? { data: [], error: null } : res);
    return q;
  };
  const rpc = async () => (o.fail === "activity" ? { data: null, error: { message: "boom" } } : { data: o.activity ?? [], error: null });
  return { from, rpc } as never;
}
const recent = new Date(Date.now() - 3 * 86_400_000).toISOString();

describe("listAccounts", () => {
  it("rolls up the deals in view and reads activity from two-way calls", async () => {
    const r = await listAccounts(db({
      deals: [
        { id: "d1", rep_id: "me", account_id: "a1", status: "open", amount: 500, last_call_at: recent, created_at: recent },
        { id: "d2", rep_id: "me", account_id: "a1", status: "won", amount: 900, last_call_at: null, created_at: recent },
      ],
      accounts: [{ id: "a1", name: "Acme", created_at: recent, created_by: "me" }],
      contacts: [{ id: "c1", account_id: "a1" }],
      activity: [{ account_id: "a1", call_at: recent }],
    }), "me", "mine");
    expect(r.accounts[0]).toMatchObject({ id: "a1", openDeals: 1, openAmount: 500, wonDeals: 1, contacts: 1, activity: { calls90: 1 } });
    expect(r.accounts[0]!.activity.level).not.toBe("inactive");
  });
  it("an account with no two-way calls is inactive, not missing", async () => {
    const r = await listAccounts(db({ deals: [], accounts: [{ id: "a2", name: "Quiet", created_at: recent, created_by: "me" }] }), "me", "mine");
    expect(r.accounts[0]!.activity).toEqual({ level: "inactive", score: 0, calls90: 0 });
  });
  it("a failed activity or contacts read throws (never an empty or quiet list)", async () => {
    const base = { deals: [], accounts: [{ id: "a2", name: "Q", created_at: recent, created_by: "me" }] };
    await expect(listAccounts(db({ ...base, fail: "activity" }), "me", "mine")).rejects.toBeInstanceOf(AccountReadError);
    await expect(listAccounts(db({ ...base, fail: "contacts_current" }), "me", "mine")).rejects.toBeInstanceOf(AccountReadError);
  });
});
