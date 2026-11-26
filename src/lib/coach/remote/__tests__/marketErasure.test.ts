import { describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { membersOnlyOn, topicMembersOnlyIn } from "../marketErasure";
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

describe("topicMembersOnlyIn (review 2026-11-27)", () => {
  // groups: g-old is RETIRED (an edited group's earlier version) — still stored, so still erased.
  const make = (intel: Record<string, string[]>, sessions: string[]) => {
    const reads: string[] = [];
    const admin = {
      from: (table: string) => {
        let subjects: string[] = [];
        const q: Record<string, unknown> = {};
        for (const m of ["select", "eq", "order"]) q[m] = () => q;
        q.in = (_c: string, v: string[]) => ((subjects = v), q);
        q.range = (f: number) => {
          if (f > 0) return Promise.resolve({ data: [], error: null });
          reads.push(table);
          if (table === "market_topic_groups") return Promise.resolve({ data: [{ id: "g-old", members: ["betty's divorce", "pricing"] }, { id: "g-new", members: ["betty's divorce", "price"] }], error: null });
          if (table === "coaching_sessions") return Promise.resolve({ data: sessions.map((id) => ({ id })), error: null });
          if (table === "events") return Promise.resolve({ data: subjects.flatMap((sub, i) => { const sid = sub.slice("sales_session:".length); return intel[sid] ? [{ id: `${sid}-${i}`, subject: sub, topics: intel[sid] }] : []; }), error: null });
          return Promise.resolve({ data: [], error: null });
        };
        return q;
      },
    } as never;
    return { admin, reads };
  };
  it("erases a member only on erased calls in every group, retired versions included; a member also on a kept call stays", async () => {
    const { admin } = make({ s1: ["Betty's divorce", "Pricing"], s2: ["pricing"] }, ["s1", "s2"]);
    const r = await topicMembersOnlyIn(admin, "co1", ["s1"]);
    expect(r!.members).toEqual(["betty's divorce"]);
    expect(r!.groups.sort()).toEqual(["g-new", "g-old"]);
  });
  it("when the erased calls mention no group member, the company's other calls aren't read at all", async () => {
    const { admin, reads } = make({ s1: ["weather"] }, ["s1", "s2"]);
    expect(await topicMembersOnlyIn(admin, "co1", ["s1"])).toEqual({ groups: [], members: [] });
    expect(reads).not.toContain("coaching_sessions");
  });
});

