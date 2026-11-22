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
