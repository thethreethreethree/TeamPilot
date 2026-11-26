import { describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { membersOnlyOn } from "../marketErasure";
import { topicKey } from "../market";

/** Erasure and topic groups (0385): a member is blanked only when every call it appears on is being erased. */
describe("membersOnlyOn", () => {
  const on = (pairs: Array<[string, string[]]>) => new Map(pairs.map(([t, s]) => [topicKey(t), new Set(s)]));
  const groups = [{ id: "g1", members: ["betty's divorce", "pricing"] }, { id: "g2", members: ["internet speed", "speed"] }];
  it("only on erased calls → erased; also on a kept call → kept (Market's own matcher, so wording variants count)", () => {
    const r = membersOnlyOn(groups, on([["Betty's divorce", ["s1"]], ["Pricing", ["s1", "s2"]], ["internet speeds", ["s1"]]]), new Set(["s1"]));
    expect(r.members.sort()).toEqual(["betty's divorce", "internet speed"]);
    expect(r.groups.sort()).toEqual(["g1", "g2"]);
  });
  it("a member seen on no call isn't touched (no evidence it came from these calls); an already-erased one is skipped", () => {
    const r = membersOnlyOn([{ id: "g", members: ["[erased]", "unknown topic"] }], on([]), new Set(["s1"]));
    expect(r).toEqual({ groups: [], members: [] });
  });
});
