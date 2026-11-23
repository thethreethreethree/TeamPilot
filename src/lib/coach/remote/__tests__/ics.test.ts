import { describe, it, expect } from "vitest";
import { buildIcs } from "../ics";

/** Calendar reminders as .ics (Macro Mode spec). A malformed file is silently ignored by calendars, so the format matters. */
describe("buildIcs", () => {
  const ics = buildIcs(
    [
      { uid: "p1-next", date: "2026-11-28", title: "Call Betty, Acme", description: "Next call; bring pricing", url: "https://elostate.com/dashboard/remote-sales/pipeline?p=p1" },
      { uid: "bad", date: "soon", title: "dropped" },
    ],
    new Date("2026-11-22T10:00:00Z"),
  );
  it("is a valid calendar with one all-day event and a reminder, CRLF line endings", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1); // the event with no real date is dropped
    expect(ics).toContain("DTSTART;VALUE=DATE:20261128\r\nDTEND;VALUE=DATE:20261129");
    expect(ics).toContain("UID:p1-next@elostate.com");
    expect(ics).toContain("DTSTAMP:20261122T100000Z");
    expect(ics).toContain("BEGIN:VALARM");
  });
  it("escapes commas, semicolons and new lines, and folds long lines at 75", () => {
    expect(ics).toContain("SUMMARY:Call Betty\\, Acme");
    expect(ics).toContain("Next call\; bring pricing\\n");
    for (const line of ics.split("\r\n")) expect(line.length).toBeLessThanOrEqual(75);
  });
});

describe("a next call with a time (0325)", () => {
  it("is a 30-minute floating-time event with a 15-minute reminder; an untimed one stays all-day", () => {
    const out = buildIcs([{ uid: "a", date: "2026-12-01", time: "23:45", title: "Call Betty" }, { uid: "b", date: "2026-12-02", title: "To-do" }], new Date("2026-11-23T00:00:00Z"));
    expect(out).toContain("DTSTART:20261201T234500");
    expect(out).toContain("DTEND:20261202T001500"); // crosses midnight
    expect(out).toContain("TRIGGER:-PT15M");
    expect(out).toContain("DTSTART;VALUE=DATE:20261202");
    expect(out).toContain("TRIGGER:-PT15H");
    expect(out).not.toMatch(/DTSTART:\d{8}T\d{6}Z/); // floating: no zone
  });
});
