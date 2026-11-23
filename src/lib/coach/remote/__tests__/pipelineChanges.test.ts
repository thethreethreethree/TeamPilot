import { describe, it, expect } from "vitest";
import { pipelineChanges, summarize, type ProspectEvent } from "../pipelineChanges";

let n = 0;
const ev = (prospectId: string, at: string, kind: string, value: Record<string, unknown>): ProspectEvent => ({ prospectId, kind, value, at, id: ++n });
const FROM = "2026-11-16T00:00:00Z";
const TO = "2026-11-23T00:00:00Z";

describe("pipelineChanges", () => {
  it("a deal created in the week is new (its creation events are not changes); later events are", () => {
    const c = pipelineChanges([
      ev("a", "2026-11-17T10:00:00Z", "name", { text: "Acme" }),
      ev("a", "2026-11-17T10:00:01Z", "stage", { status: "open", label: "Discovery" }),
      ev("a", "2026-11-17T10:00:01Z", "amount", { amount: 900 }),
      ev("a", "2026-11-19T10:00:00Z", "stage", { status: "open", label: "Demo" }),
    ], FROM, TO);
    expect(c.map((x) => x.kind).sort()).toEqual(["new", "stage"]);
    expect(c.find((x) => x.kind === "new")).toMatchObject({ amount: 900 });
    expect(c.find((x) => x.kind === "stage")).toMatchObject({ from: "Discovery", to: "Demo" });
  });
  it("won and lost carry the amount at the time; amount and close-date moves are classified; events outside the week are ignored", () => {
    const c = pipelineChanges([
      ev("b", "2026-11-01T10:00:00Z", "stage", { status: "open" }),
      ev("b", "2026-11-01T10:00:00Z", "amount", { amount: 500 }),
      ev("b", "2026-11-01T10:00:00Z", "close_date", { date: "2026-11-30" }),
      ev("b", "2026-11-10T10:00:00Z", "amount", { amount: 600 }), // before the week
      ev("b", "2026-11-18T10:00:00Z", "close_date", { date: "2026-12-15" }),
      ev("b", "2026-11-19T10:00:00Z", "amount", { amount: 800 }),
      ev("b", "2026-11-20T10:00:00Z", "stage", { status: "won" }),
      ev("c", "2026-11-01T10:00:00Z", "stage", { status: "open" }),
      ev("c", "2026-11-01T10:00:00Z", "close_date", { date: "2026-12-20" }),
      ev("c", "2026-11-21T10:00:00Z", "close_date", { date: "2026-12-01" }),
      ev("c", "2026-11-22T10:00:00Z", "stage", { status: "lost" }),
    ], FROM, TO);
    expect(c.map((x) => [x.prospectId, x.kind])).toEqual([
      ["c", "lost"], ["c", "close_pulled_in"], ["b", "won"], ["b", "amount"], ["b", "close_slipped"],
    ]);
    expect(c.find((x) => x.kind === "won")).toMatchObject({ amount: 800 });
    expect(c.find((x) => x.kind === "amount")).toMatchObject({ from: 600, to: 800 });
    expect(summarize(c)).toMatchObject({ won: 1, wonValue: 800, lost: 1, slipped: 1, new: 0 });
  });
});
