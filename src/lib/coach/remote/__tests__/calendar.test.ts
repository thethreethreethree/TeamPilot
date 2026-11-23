import { describe, it, expect } from "vitest";
import { addDays, buildWeek, localDay, weekStart } from "../calendar";

describe("calendar dates", () => {
  it("weekStart is the Monday on or before the day", () => {
    expect(weekStart("2026-11-23")).toBe("2026-11-23"); // a Monday
    expect(weekStart("2026-11-29")).toBe("2026-11-23"); // Sunday belongs to the week before it
    expect(weekStart("2026-11-25")).toBe("2026-11-23");
    expect(weekStart("2027-01-01")).toBe("2026-12-28"); // across a year
  });
  it("addDays crosses months", () => expect(addDays("2026-11-30", 1)).toBe("2026-12-01"));
  it("localDay uses the viewer's offset (getTimezoneOffset: minutes behind UTC)", () => {
    expect(localDay("2026-11-24T03:00:00Z", 300)).toBe("2026-11-23"); // 10pm the evening before in New York
    expect(localDay("2026-11-24T03:00:00Z", 0)).toBe("2026-11-24");
    expect(localDay("2026-11-23T20:00:00Z", -600)).toBe("2026-11-24"); // 6am next day in Sydney
  });
});

describe("buildWeek", () => {
  const held = (id: string, startedAt: string) => ({ sessionId: id, repId: "r", startedAt, label: null, outcome: null, prospectId: null, prospectName: null });
  it("seven days; booked by date, held by local day and in time order; outside the week dropped", () => {
    const w = buildWeek(
      "2026-11-23",
      [
        { day: "2026-11-24", prospectId: "p1", repId: "r", name: "Acme", organization: null },
        { day: "2026-12-05", prospectId: "p2", repId: "r", name: "Later", organization: null },
      ],
      [held("s2", "2026-11-24T18:00:00Z"), held("s1", "2026-11-24T15:00:00Z"), held("s3", "2026-11-23T03:00:00Z")],
      300,
    );
    expect(w.map((d) => d.day)).toEqual(["2026-11-23", "2026-11-24", "2026-11-25", "2026-11-26", "2026-11-27", "2026-11-28", "2026-11-29"]);
    expect(w[1]!.booked.map((b) => b.prospectId)).toEqual(["p1"]);
    expect(w[1]!.held.map((h) => h.sessionId)).toEqual(["s1", "s2"]);
    expect(w.flatMap((d) => d.held).map((h) => h.sessionId)).not.toContain("s3"); // Sunday evening of the week before, local
    expect(w.flatMap((d) => d.booked).map((b) => b.prospectId)).not.toContain("p2");
  });
});

describe("booked calls with a time (0325)", () => {
  it("timed calls first in time order, untimed after", () => {
    const b = (prospectId: string, time: string | null) => ({ day: "2026-11-23", prospectId, repId: "r", name: prospectId, organization: null, time });
    const w = buildWeek("2026-11-23", [b("none", null), b("late", "16:00"), b("early", "09:30")], [], 0);
    expect(w[0]!.booked.map((x) => x.prospectId)).toEqual(["early", "late", "none"]);
  });
});
