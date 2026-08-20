import { describe, it, expect } from "vitest";
import { pdfItemsToStaffDateGrid, gridToCsv, docxCellsToCsv, type PdfTextItem } from "../staffDatePdf";
import { parseCsvToGrid } from "../csvGrid";
import { parseScheduleGrid, type ShiftCodeMap } from "../gridParser";
import { planImport } from "../importPlanner";

/**
 * Verified against the REAL "frendz.pdf" (the founder's schedule) — the exact positioned coordinates dumped
 * from unpdf's extractTextItems. This is the adversarial layout the parser exists for: two cut-off blocks
 * (SEP 1-15, AUG 16-30), each WRAPPED across pages (dates 1-8 with names, then 9-15 nameless), with vertical
 * OVERFLOW (staff who don't fit continue header-less on the next page). If this reconstructs the schedule
 * correctly, the parser handles the real file.
 */

// Compact row builder: [y, [[str, x], ...]] → PdfTextItem[]
type RowSpec = [number, [string, number][]];
function page(rows: RowSpec[]): PdfTextItem[] {
  return rows.flatMap(([y, items]) => items.map(([str, x]) => ({ str, x, y })));
}

const P1 = page([
  [517, [["SCHEDULE CUT OFF (SEPTEMBER 1-15 2026)", 500]]],
  [501, [["1", 257], ["2", 324], ["3", 391], ["4", 457], ["5", 525], ["6", 592], ["7", 660], ["8", 727]]],
  [487, [["SAT", 201], ["SUN", 266], ["MON", 333], ["TUE", 400], ["WED", 466], ["THU", 534], ["FRI", 601], ["SAT", 669]]],
  [461, [["DARREN GUZMAN", 52], ["1--10", 201], ["1--10", 266], ["OFF", 347], ["OFF", 414], ["OFF", 481], ["1--10", 534], ["1--10", 601], ["1--10", 669]]],
  [433, [["REBECCA LACHICA", 52], ["6--3", 201], ["OFF", 280], ["1--10", 333], ["1--10", 400], ["1--10", 466], ["9--6", 534], ["OFF", 603], ["OFF", 683]]],
  [404, [["MONEBERT ALBURO", 52], ["GY", 201], ["GY", 266], ["GY", 333], ["GY", 400], ["GY", 466], ["GY", 534], ["GY", 601], ["OFF", 683]]],
  [375, [["CELESTINO MOLINA", 52], ["OFF", 214], ["OFF", 280], ["OFF", 347], ["9--6", 400], ["9--6", 466], ["9--6", 534], ["6--3", 601], ["6--3", 669]]],
  [343, [["CHALYN AUMAN", 52], ["1--10", 201], ["6--3", 266], ["6--3", 333], ["6--3", 400], ["6--3", 466], ["6--3", 534], ["1--10", 601], ["1--10", 669]]],
  [317, [["MARIE MALINAO", 52], ["OFF", 214], ["1--10", 266], ["1--10", 333], ["1--10", 400], ["1--10", 466], ["1--10", 534], ["OFF", 616], ["GY", 669]]],
  [205, [["SCHEDULE CUT OFF(AUGUST 16-30 2026)", 500]]],
  [189, [["16", 252], ["17", 318], ["18", 385], ["19", 451], ["20", 520], ["21", 587], ["22", 654], ["23", 721]]],
  [174, [["SUN", 201], ["MON", 266], ["TUE", 333], ["WED", 400], ["THU", 466], ["FRI", 534], ["SAT", 601], ["SUN", 669]]],
  [140, [["DARREN GUZMAN", 52], ["1--10", 220], ["1--10", 286], ["1--10", 353], ["1--10", 419], ["1--10", 487], ["1--10", 554], ["1--10", 622], ["1--10", 689]]],
  [112, [["REBECCA LACHICA", 52], ["6-3", 224], ["6-3", 290], ["6-3", 357], ["6-3", 424], ["9--6", 489], ["9--6", 557], ["GY", 627], ["GY", 694]]],
  [84, [["MONEBERT ALBURO", 52], ["1--10", 220], ["1--10", 286], ["1--10", 353], ["1--10", 419], ["1--10", 487], ["1--10", 554], ["1--10", 622], ["1--10", 689]]],
]);

const P2 = page([
  [520, [["CELESTINO MOLINA", 52], ["6-3 BF", 218], ["OFF", 280], ["OFF", 347], ["OFF", 414], ["6-3", 491], ["6-3", 559], ["6-3", 626], ["6-3", 693]]],
  [492, [["CHALYN AUMAN", 52], ["GY", 225], ["GY", 291], ["GY", 358], ["GY", 425], ["GY", 492], ["GY", 560], ["OFF", 616], ["OFF", 683]]],
  [462, [["MARIE MALINAO", 52], ["OFF", 214], ["OFF", 280], ["OFF", 347], ["6-3 BF", 417], ["6-3", 491], ["6-3", 559], ["6-3", 626], ["6-3 BF", 686]]],
]);

const P3 = page([
  [517, [["CHEDULE CUT OFF (SEPTEMBER 1-15 2026)", -175]]],
  [501, [["9", 111], ["10", 173], ["11", 241], ["12", 308], ["13", 375], ["14", 444], ["15", 507], ["REMARKS", 643]]],
  [487, [["SUN", 52], ["MON", 120], ["TUE", 187], ["WED", 255], ["THU", 322], ["FRI", 389], ["SAT", 458]]],
  [458, [["1--10", 52], ["1--10", 120], ["1--10", 187], ["1--10", 255], ["1--10", 322], ["1--10", 389], ["1--10", 458]]],
  [430, [["1--10", 52], ["1--10", 120], ["9--6", 187], ["6--3", 255], ["6--3", 322], ["6--3", 389], ["6--3", 458]]],
  [404, [["OFF", 67], ["OFF", 134], ["6--3", 187], ["6--3", 255], ["6--3", 322], ["6--3", 389], ["6--3", 458]]],
  [372, [["6--3", 52], ["6--3", 120], ["1--10", 187], ["1--10", 255], ["1--10", 322], ["1--10", 389], ["1--10", 458]]],
  [346, [["OFF", 54], ["OFF", 134], ["OFF", 202], ["9--6", 255], ["9--6", 322], ["9--6", 389], ["GY", 458]]],
  [317, [["GY", 52], ["GY", 120], ["GY", 187], ["GY", 255], ["GY", 322], ["GY", 389], ["OFF", 471]]],
  [205, [["CHEDULE CUT OFF(AUGUST 16-30 2026)", -175], ["REMARKS", 648]]],
  [189, [["24", 106], ["25", 173], ["26", 241], ["27", 308], ["28", 375], ["29", 444], ["30", 507], ["31", 570]]],
  [174, [["MON", 52], ["TUE", 120], ["WED", 187], ["THU", 255], ["FRI", 322], ["SAT", 389], ["SUN", 458], ["MON", 521]]],
  [140, [["1--10", 73], ["1--10", 140], ["1--10", 208], ["1--10", 275], ["1--10", 342], ["1--10", 410], ["1--10", 476], ["1--10", 539]]],
  [115, [["GY", 78], ["GY", 146], ["GY", 213], ["GY", 281], ["GY", 348], ["OFF", 405], ["OFF", 471], ["OFF", 534]]],
  [87, [["6-3", 77], ["6-3", 145], ["OFF", 202], ["OFF", 270], ["OFF", 337], ["9--6", 413], ["6-3", 481], ["6-3", 544]]],
]);

const P4 = page([
  [517, [["6-3", 77], ["6-3", 145], ["6-3", 212], ["9--6", 278], ["9--6", 345], ["GY", 416], ["GY", 482], ["GY", 545]]],
  [492, [["OFF", 67], ["9--6", 143], ["6-3 BF", 205], ["6-3", 280], ["6-3", 347], ["6-3", 415], ["6-3 BF", 474], ["6-3", 544]]],
  [459, [["1--10", 73], ["1--10", 140], ["1--10", 208], ["1--10", 275], ["1--10", 342], ["1--10", 410], ["1--10", 476], ["1--10", 539]]],
]);

describe("pdfItemsToStaffDateGrid — the real frendz.pdf", () => {
  const grid = pdfItemsToStaffDateGrid([P1, P2, P3, P4]);

  const cell = (name: string, iso: string): string => {
    const i = grid.staff.indexOf(name);
    const j = grid.headerDates.indexOf(iso);
    return i >= 0 && j >= 0 ? grid.rows[i]!.cells[j]! : "<<missing>>";
  };

  it("recovers all 6 staff in order", () => {
    expect(grid.staff).toEqual([
      "DARREN GUZMAN", "REBECCA LACHICA", "MONEBERT ALBURO", "CELESTINO MOLINA", "CHALYN AUMAN", "MARIE MALINAO",
    ]);
  });

  it("recovers all 31 dates (Aug 16-31 + Sep 1-15), sorted", () => {
    expect(grid.headerDates.length).toBe(31);
    expect(grid.headerDates[0]).toBe("2026-08-16");
    expect(grid.headerDates.at(-1)).toBe("2026-09-15");
    expect(grid.headerDates).toContain("2026-08-31");
    expect(grid.headerDates).toContain("2026-09-01");
  });

  it("places first-column-set cells (with names) correctly", () => {
    expect(cell("DARREN GUZMAN", "2026-09-01")).toBe("1--10");
    expect(cell("DARREN GUZMAN", "2026-09-03")).toBe("OFF");
    expect(cell("REBECCA LACHICA", "2026-09-01")).toBe("6--3");
    expect(cell("MONEBERT ALBURO", "2026-09-08")).toBe("OFF"); // GY x7 then OFF on the 8th
    expect(cell("MARIE MALINAO", "2026-09-08")).toBe("GY");
  });

  it("places nameless CONTINUATION cells (Sep 9-15) by roster order", () => {
    expect(cell("DARREN GUZMAN", "2026-09-15")).toBe("1--10");
    expect(cell("REBECCA LACHICA", "2026-09-11")).toBe("9--6");
    expect(cell("MONEBERT ALBURO", "2026-09-09")).toBe("OFF");
    expect(cell("CHALYN AUMAN", "2026-09-15")).toBe("GY");
    expect(cell("MARIE MALINAO", "2026-09-15")).toBe("OFF");
  });

  it("places the AUG block incl. its vertical OVERFLOW rows (pages 2 & 4)", () => {
    expect(cell("DARREN GUZMAN", "2026-08-16")).toBe("1--10");
    expect(cell("REBECCA LACHICA", "2026-08-22")).toBe("GY");
    expect(cell("CELESTINO MOLINA", "2026-08-16")).toBe("6-3 BF"); // page-2 overflow
    expect(cell("MARIE MALINAO", "2026-08-23")).toBe("6-3 BF"); // page-2 overflow
    expect(cell("CELESTINO MOLINA", "2026-08-24")).toBe("6-3"); // page-4 overflow
    expect(cell("MARIE MALINAO", "2026-08-31")).toBe("1--10"); // page-4 overflow, last date
  });

  it("parses the real file with NO integrity warnings (a clean, confident read)", () => {
    expect(grid.warnings).toEqual([]);
  });

  it("warns when two codes land in one column (a misread-column signal, not a silent overwrite)", () => {
    // A minimal 2-column block where a staff row has an extra item crammed into column 0.
    const collide = pdfItemsToStaffDateGrid([page([
      [517, [["SCHEDULE CUT OFF (JANUARY 1-2 2026)", 400]]],
      [501, [["1", 100], ["2", 200]]],
      [487, [["THU", 100], ["FRI", 200]]],
      [461, [["AL", 20], ["X", 100], ["Y", 105], ["Z", 200]]], // X and Y both nearest column 0
    ])]);
    expect(collide.warnings.some((w) => /two codes land in one column/.test(w))).toBe(true);
  });

  it("returns an empty grid (no throw) when no schedule header is present", () => {
    const empty = pdfItemsToStaffDateGrid([page([[100, [["just a note", 50], ["nothing", 200]]]])]);
    expect(empty.staff).toEqual([]);
    expect(empty.headerDates).toEqual([]);
  });

  it("docxCellsToCsv serializes a Word table (blank rows dropped, commas quoted)", () => {
    const cells = [
      ["NAME", "AUG 16", "AUG 17"],
      ["ALICE", "6-3", "OFF"],
      [], // blank row → dropped
      ["BO, JR", "GY", "6-3"], // name with a comma → quoted
    ];
    expect(docxCellsToCsv(cells)).toBe('NAME,AUG 16,AUG 17\nALICE,6-3,OFF\n"BO, JR",GY,6-3');
  });

  it("converges on the CSV import pipeline: gridToCsv -> parseCsvToGrid -> parseScheduleGrid", () => {
    // The PDF becomes a CSV internally, so the existing importer (code-confirm + preview + commit) runs
    // unchanged. With the frendz codes mapped, the grid yields the right shift entries and NO unknown codes.
    const csv = gridToCsv(grid);
    const back = parseCsvToGrid(csv);
    const codeMap: ShiftCodeMap = {
      "1-10": { start: "13:00", end: "22:00" },
      "6-3": { start: "06:00", end: "15:00" },
      "9-6": { start: "09:00", end: "18:00" },
      GY: { start: "22:00", end: "07:00" },
      "6-3 BF": { start: "06:00", end: "15:00" },
      OFF: "off",
    };
    const parsed = parseScheduleGrid({ headerDates: grid.headerDates, rows: back.rows, codeMap });
    expect(parsed.staff).toEqual(grid.staff);
    expect(parsed.unknownCodes).toEqual([]); // every frendz code mapped

    const entry = (name: string, iso: string) => parsed.entries.find((e) => e.employeeName === name && e.date === iso);
    expect(entry("DARREN GUZMAN", "2026-09-01")).toMatchObject({ kind: "shift", times: { start: "13:00", end: "22:00" } });
    expect(entry("DARREN GUZMAN", "2026-09-03")).toMatchObject({ kind: "off" });
    expect(entry("CELESTINO MOLINA", "2026-08-16")).toMatchObject({ kind: "shift", times: { start: "06:00", end: "15:00" } }); // "6-3 BF"
    expect(entry("REBECCA LACHICA", "2026-08-22")).toMatchObject({ kind: "shift", times: { start: "22:00", end: "07:00" } }); // GY overnight

    // The FINAL deliverable: planImport turns those entries into the exact roster + shifts + assignments a
    // commit would write. On an empty schedule, all 6 staff are new; OFF produces no shift; shifts dedup by
    // (date,start,end) so a whole GY column is one shift with many assignments.
    const plan = planImport({ staff: parsed.staff, entries: parsed.entries }, []);
    expect(plan.newStaff.sort()).toEqual([...grid.staff].sort());
    const gy0822 = plan.shifts.find((s) => s.date === "2026-08-22" && s.start === "22:00" && s.end === "07:00");
    expect(gy0822).toBeTruthy(); // the overnight GY shift exists
    expect(plan.assignments.some((a) => a.shiftKey === gy0822!.key && a.staffName === "REBECCA LACHICA")).toBe(true);
    // No shift is created for an OFF day (DARREN is OFF on 2026-09-03).
    const darrenSep3 = plan.assignments.filter((a) => a.staffName === "DARREN GUZMAN" && a.shiftKey.startsWith("2026-09-03"));
    expect(darrenSep3).toEqual([]);
  });
});
