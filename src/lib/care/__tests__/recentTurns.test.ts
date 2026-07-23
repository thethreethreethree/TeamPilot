import { describe, it, expect } from "vitest";
import {
  buildRecentTurns,
  VISIBLE_TURNS_IN_CONTEXT,
  type RecentTurnSource,
} from "../recentTurns";

const m = (
  id: string,
  authorType: RecentTurnSource["authorType"],
  body: string
): RecentTurnSource => ({ id, authorType, body });

describe("buildRecentTurns", () => {
  it("maps authorType → role (customer→customer, agent→agent, ai/system→ai)", () => {
    const out = buildRecentTurns(
      [
        m("1", "customer", "hi"),
        m("2", "agent", "hello"),
        m("3", "ai", "auto"),
        m("4", "system", "a human is joining"),
      ],
      "none"
    );
    expect(out).toEqual([
      { role: "customer", body: "hi" },
      { role: "agent", body: "hello" },
      { role: "ai", body: "auto" },
      // system folds to "ai" (the non-customer/non-human bucket) — matches the widget route.
      { role: "ai", body: "a human is joining" },
    ]);
  });

  it("excludes the just-inserted customer message (it goes in as newMessage)", () => {
    const out = buildRecentTurns([m("1", "customer", "old"), m("2", "customer", "new")], "2");
    expect(out).toEqual([{ role: "customer", body: "old" }]);
  });

  it("keeps only the last `cap` turns", () => {
    const many = Array.from({ length: 20 }, (_, i) => m(String(i), "customer", `t${i}`));
    const out = buildRecentTurns(many, "none", 5);
    expect(out).toHaveLength(5);
    expect(out[0]!.body).toBe("t15");
    expect(out[4]!.body).toBe("t19");
  });

  it("slices to the cap BEFORE excluding — so excluding a recent message can yield cap-1", () => {
    const many = Array.from({ length: 12 }, (_, i) => m(String(i), "customer", `t${i}`));
    const out = buildRecentTurns(many, "11", 12); // exclude the last, which is within the window
    expect(out).toHaveLength(11);
  });

  it("defaults the cap to VISIBLE_TURNS_IN_CONTEXT", () => {
    const many = Array.from({ length: 30 }, (_, i) => m(String(i), "customer", `t${i}`));
    expect(buildRecentTurns(many, "none")).toHaveLength(VISIBLE_TURNS_IN_CONTEXT);
  });

  it("handles an empty thread", () => {
    expect(buildRecentTurns([], "none")).toEqual([]);
  });
});
