import { describe, it, expect } from "vitest";
import { accountsFrom } from "../accountsFrom";

/** 2026-11-23: a failed accounts read must never become the empty list that means "Finance isn't set up yet". */
describe("accountsFrom", () => {
  it("returns the list, empty included (a real empty Chart of Accounts)", () => {
    expect(accountsFrom({ accounts: [{ id: "a" }] })).toEqual([{ id: "a" }]);
    expect(accountsFrom({ accounts: [] })).toEqual([]);
  });
  it("throws on an error body, a missing list, or nothing", () => {
    expect(() => accountsFrom({ error: "Could not load the Chart of Accounts." })).toThrow(/chart of accounts/i);
    expect(() => accountsFrom({})).toThrow();
    expect(() => accountsFrom(null)).toThrow();
    expect(() => accountsFrom({ accounts: "nope" })).toThrow();
  });
});
