import { describe, it, expect } from "vitest";
import { addDaysIso, resolveVaToPreview } from "../vaResolve";
import { parseVaGrid, type VaParseResult } from "../vaGrid";
import { planImport } from "../importPlanner";

/**
 * R-VA-3: the recurring VA template resolves to a dated ImportPreview for a target week, and that preview
 * flows through the EXISTING planImport → apply_schedule_import commit path (composition, not a parallel
 * writer). The end-to-end test proves grid → parse → resolve → plan produces the right dated shifts +
 * assignments, so the VA import reuses the committed CSV pipeline rather than a second one.
 */

describe("addDaysIso (UTC-deterministic)", () => {
  it("adds days within and across a month boundary", () => {
    expect(addDaysIso("2026-08-17", 4)).toBe("2026-08-21");
    expect(addDaysIso("2026-08-30", 3)).toBe("2026-09-02");
  });
  it("malformed → null", () => expect(addDaysIso("2026-8-1", 1)).toBeNull());
});

describe("resolveVaToPreview", () => {
  const parse: VaParseResult = {
    shiftsByStaff: { Alex: [{ start: "10:00", end: "14:00" }], Bob: [] },
    unparsedBlocks: [],
  };
  it("emits each staff shift on Mon–Fri of the target week (any in-week date normalizes to Monday)", () => {
    const preview = resolveVaToPreview(parse, { weekStart: "2026-08-19" }); // Wed → week of Mon 08-17
    expect(preview.staff).toEqual(["Alex", "Bob"]);
    expect(preview.entries.map((e) => e.date)).toEqual([
      "2026-08-17", "2026-08-18", "2026-08-19", "2026-08-20", "2026-08-21",
    ]);
    expect(preview.entries[0]).toEqual({
      employeeName: "Alex", date: "2026-08-17", rawCode: "10:00-14:00",
      kind: "shift", times: { start: "10:00", end: "14:00" },
    });
  });
  it("a staff member with no shifts contributes no entries", () => {
    const preview = resolveVaToPreview(parse, { weekStart: "2026-08-19" });
    expect(preview.entries.every((e) => e.employeeName !== "Bob")).toBe(true);
  });
  it("a malformed week → empty entries (but keeps the staff list), never throws", () => {
    const preview = resolveVaToPreview(parse, { weekStart: "not-a-date" });
    expect(preview.entries).toEqual([]);
    expect(preview.staff).toEqual(["Alex", "Bob"]);
  });
});

describe("grid → parse → resolve → planImport (end-to-end convergence on the commit path)", () => {
  it("produces dated shifts + assignments the existing planImport commits", () => {
    const parse = parseVaGrid({
      staff: ["Alex", "Kaye"],
      rows: [
        { block: "10 AM - 12 PM", onDuty: ["Alex"] },
        { block: "12 PM - 1 PM", onDuty: ["Alex"] }, // coalesces with the above → Alex 10:00–13:00
        { block: "1 PM - 2 PM", onDuty: ["Kaye"] },
      ],
    });
    const preview = resolveVaToPreview(parse, { weekStart: "2026-08-17" }); // Monday
    const plan = planImport(preview, []); // no existing roster → both are new staff

    expect(plan.newStaff.sort()).toEqual(["Alex", "Kaye"]);
    // Alex 10:00–13:00 on Mon–Fri (5) + Kaye 13:00–14:00 on Mon–Fri (5) = 10 distinct dated shifts.
    expect(plan.shifts).toHaveLength(10);
    expect(plan.assignments).toHaveLength(10);
    // Monday's Alex shift is present with the coalesced 10:00–13:00 window.
    expect(plan.shifts.some((s) => s.date === "2026-08-17" && s.start === "10:00" && s.end === "13:00")).toBe(true);
  });
});
