import { describe, it, expect } from "vitest";
import { dealDrivers, type DriverDeal } from "../drivers";

/** Deal drivers (Gong F20.11): shares per rep from dealRisk's verdict; top three; a team-wide habit. */
const T = "2026-11-27";
const deal = (repId: string, o: Partial<DriverDeal> = {}): DriverDeal => ({
  id: "d", repId, name: "D", status: "open", amount: 100, nextCallDate: "2026-11-30", lastCallAt: "2026-11-25T10:00:00Z", createdAt: "2026-11-01T00:00:00Z", nextTodo: null, ...o,
});
describe("dealDrivers", () => {
  it("shares per rep over open deals only; a missing amount is not a warning", () => {
    const d = dealDrivers([deal("a", { nextCallDate: null }), deal("a"), deal("a", { status: "won", nextCallDate: null }), deal("b", { amount: null })], T);
    expect(d.rows.find((r) => r.repId === "a")).toEqual({ repId: "a", open: 2, share: { no_next_call: 0.5 } });
    expect(d.rows.find((r) => r.repId === "b")).toEqual({ repId: "b", open: 1, share: {} });
    expect(d.reasons).toEqual(["no_next_call"]);
  });
  it("top three per warning; more than three reps at half or more is team-wide", () => {
    const reps = ["a", "b", "c", "d", "e"];
    const d = dealDrivers(reps.flatMap((r, i) => [deal(r, { nextCallDate: null }), deal(r, i === 4 ? {} : { nextCallDate: null })]), T);
    expect(d.top.no_next_call).toHaveLength(3);
    expect(d.teamWide).toEqual(["no_next_call"]);
    const few = dealDrivers(reps.slice(0, 3).map((r) => deal(r, { nextCallDate: null })), T);
    expect(few.teamWide).toEqual([]);
  });
});
