import { describe, it, expect } from "vitest";
import { coverageShare, MIN_CALLS } from "../coverageShare";

const intel = (id: string, topics: string[]) => ({ subject: `sales_session:${id}`, payload: { intel: { topics } } });

describe("coverageShare (F10.11)", () => {
  const callIds = ["c1", "c2", "c3", "c4"];
  const trackers = [
    { id: "t1", name: "Pricing", active: true },
    { id: "t2", name: "Competitor", active: true },
    { id: "t3", name: "Old one", active: false },
    { id: "t4", name: "Retired but fired", active: false },
  ];
  it("a tracker's share is the calls it fired on (once per call), out of the period's calls", () => {
    const out = coverageShare({
      callIds,
      trackers,
      hits: [
        { trackerId: "t1", sessionId: "c1" },
        { trackerId: "t1", sessionId: "c1" }, // two hits, one call
        { trackerId: "t1", sessionId: "c3" },
        { trackerId: "t1", sessionId: "zz" }, // a call outside the period doesn't count
        { trackerId: "t4", sessionId: "c2" },
      ],
      intel: [],
    });
    expect(out).toMatchObject({ calls: 4, enough: true });
    expect(out.trackers).toEqual([
      { id: "t1", name: "Pricing", active: true, calls: 2, share: 0.5 },
      { id: "t4", name: "Retired but fired", active: false, calls: 1, share: 0.25 },
      { id: "t2", name: "Competitor", active: true, calls: 0, share: 0 },
    ]); // an active tracker at 0% is listed; a retired one that didn't fire isn't
  });
  it("topics come from each call's LATEST read, case-insensitively merged", () => {
    const out = coverageShare({
      callIds,
      trackers: [],
      hits: [],
      intel: [intel("c1", ["Pricing", "Timeline"]), intel("c1", ["Old topic"]), intel("c2", ["pricing"]), intel("c9", ["Pricing"])],
    });
    expect(out.topics).toEqual([
      { topic: "Pricing", calls: 2, share: 0.5 },
      { topic: "Timeline", calls: 1, share: 0.25 },
    ]); // c1's older read and the out-of-period c9 don't count
  });
  it(`under ${MIN_CALLS} calls the shares aren't meaningful`, () => {
    expect(coverageShare({ callIds: ["c1", "c2", "c3"], trackers, hits: [], intel: [] }).enough).toBe(false);
    expect(coverageShare({ callIds: [], trackers: [], hits: [], intel: [] })).toEqual({ calls: 0, enough: false, trackers: [], topics: [] });
  });
});
