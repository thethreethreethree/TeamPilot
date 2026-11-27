import { describe, it, expect } from "vitest";
import { fieldChanges, valueWord } from "../fieldHistory";

const fmt = { money: (n: number) => `$${n}`, date: (d: string) => d };
const names = new Map([["u1", "Ana"]]);
const ev = (kind: string, value: Record<string, unknown> | null, at: string, actor: string | null = "u1") => ({ kind, value, actor_id: actor, created_at: at });

describe("a deal's field history (F23.11)", () => {
  it("each change says from → to, who and when, newest first; the oldest has no 'from'", () => {
    const out = fieldChanges([
      ev("amount", { amount: 5000 }, "t3"),
      ev("stage", { status: "won" }, "t2", "u9"),
      ev("amount", { amount: 3000 }, "t1"),
    ], names, fmt);
    expect(out).toEqual([
      { at: "t3", who: "Ana", field: "Amount", from: "$3000", to: "$5000" },
      { at: "t2", who: "A teammate", field: "Stage", from: null, to: "Won" },
      { at: "t1", who: "Ana", field: "Amount", from: null, to: "$3000" },
    ]);
  });
  it("a save with the same value isn't a change; unknown kinds are left out", () => {
    const out = fieldChanges([ev("close_date", { date: "2026-12-01" }, "t2"), ev("close_date", { date: "2026-12-01" }, "t1"), ev("mystery", {}, "t0")], names, fmt);
    expect(out.map((c) => c.at)).toEqual(["t1"]);
  });
  it("words for each kind, including cleared values", () => {
    expect(valueWord("stage", { status: "open", label: "Proposal" }, fmt)).toBe("Proposal (open)");
    expect(valueWord("next_call", { date: "2026-12-02", time: "09:30" }, fmt)).toBe("2026-12-02 09:30");
    expect(valueWord("close_date", { date: null }, fmt)).toBe("none");
    expect(valueWord("account", { account_id: null }, fmt)).toBe("none");
    expect(valueWord("source", { text: "Referral" }, fmt)).toBe("Referral");
  });
  it("an account move shows both names; the same account saved again isn't a change", () => {
    const f = { ...fmt, account: (id: string) => ({ a1: "Acme", a2: "Globex" } as Record<string, string>)[id] };
    const out = fieldChanges([ev("account", { account_id: "a2" }, "t3"), ev("account", { account_id: "a1" }, "t2"), ev("account", { account_id: "a1" }, "t1")], names, f);
    expect(out).toEqual([
      { at: "t3", who: "Ana", field: "Account", from: "Acme", to: "Globex" },
      { at: "t1", who: "Ana", field: "Account", from: null, to: "Acme" },
    ]);
    // two accounts the reader can't name are still two accounts
    expect(fieldChanges([ev("account", { account_id: "x2" }, "t2"), ev("account", { account_id: "x1" }, "t1")], names, fmt).map((c) => c.at)).toEqual(["t2", "t1"]);
  });
});
