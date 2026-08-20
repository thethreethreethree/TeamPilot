import { describe, it, expect } from "vitest";
import { to24h, normalizeCodeMap, inferNumericShift, autoTimeRangeCodeMap } from "../importTime";
import { parseScheduleGrid } from "../gridParser";

describe("inferNumericShift (hours-only shift codes → times, the founder's HK/HUB codes)", () => {
  it("reads a start hour 6–11 as AM and 1–5 as PM, end as the plausible-length reading", () => {
    expect(inferNumericShift("7-4")).toEqual({ start: "07:00", end: "16:00" }); // 7am–4pm
    expect(inferNumericShift("6-3")).toEqual({ start: "06:00", end: "15:00" }); // 6am–3pm
    expect(inferNumericShift("2-11")).toEqual({ start: "14:00", end: "23:00" }); // 2pm–11pm
    expect(inferNumericShift("10-7")).toEqual({ start: "10:00", end: "19:00" }); // 10am–7pm
    expect(inferNumericShift("1-10")).toEqual({ start: "13:00", end: "22:00" }); // 1pm–10pm
    expect(inferNumericShift("9-6")).toEqual({ start: "09:00", end: "18:00" }); // 9am–6pm
  });
  it("tolerates a short duty suffix ('6-3 BF' = the 6-3 shift)", () => {
    expect(inferNumericShift("6-3 BF")).toEqual({ start: "06:00", end: "15:00" });
  });
  it("returns null for org-specific codes it must NOT guess (GY, G-Y, SKY-BAR, OFF)", () => {
    for (const c of ["GY", "G-Y", "SKY-BAR", "OFF", "13:00", ""]) expect(inferNumericShift(c)).toBeNull();
  });
});

describe("autoTimeRangeCodeMap folds in the numeric inference", () => {
  it("pre-fills numeric codes deterministically, leaves org codes for the human", () => {
    const m = autoTimeRangeCodeMap(["7-4", "6-3", "OFF", "GY", "06:00-15:00"]);
    expect(m["7-4"]).toEqual({ start: "07:00", end: "16:00" });
    expect(m["6-3"]).toEqual({ start: "06:00", end: "15:00" });
    expect(m["OFF"]).toBe("off");
    expect(m["06:00-15:00"]).toEqual({ start: "06:00", end: "15:00" }); // explicit range still works
    expect(m["GY"]).toBeUndefined(); // org code → stays unmapped for the manager
  });
});

/**
 * The fix for 4 failed imports: shift-code times came in as "1", "1:00pm", "13" etc., but preview/commit need
 * strict HH:mm. These lock the normalization so no time format can silently break the import again (A30).
 */
describe("to24h", () => {
  it("passes through valid 24h", () => {
    expect(to24h("13:00")).toBe("13:00");
    expect(to24h("06:30")).toBe("06:30");
    expect(to24h("00:00")).toBe("00:00");
  });
  it("converts 12-hour with am/pm", () => {
    expect(to24h("1:00pm")).toBe("13:00");
    expect(to24h("1:00 PM")).toBe("13:00");
    expect(to24h("9:00am")).toBe("09:00");
    expect(to24h("12:00am")).toBe("00:00"); // midnight
    expect(to24h("12:00pm")).toBe("12:00"); // noon
    expect(to24h("1pm")).toBe("13:00");
    expect(to24h("9 am")).toBe("09:00");
  });
  it("reads a bare hour literally, zero-padded", () => {
    expect(to24h("1")).toBe("01:00");
    expect(to24h("13")).toBe("13:00");
    expect(to24h("9")).toBe("09:00");
    expect(to24h("10")).toBe("10:00");
  });
  it("returns '' for the unparseable (so it fails visibly, not silently)", () => {
    expect(to24h("")).toBe("");
    expect(to24h("morning")).toBe("");
    expect(to24h("25")).toBe("");
    expect(to24h("13:99")).toBe("");
    expect(to24h("6-3")).toBe(""); // a shift code, not a time
  });
});

describe("normalizeCodeMap", () => {
  it("coerces every time to HH:mm, keeps off, drops unparseable codes", () => {
    expect(normalizeCodeMap({
      "1-10": { start: "1:00pm", end: "10:00pm" },
      "6-3": { start: "6", end: "3pm" },
      OFF: "off",
      BAD: { start: "morning", end: "17:00" }, // unparseable start → dropped
    })).toEqual({
      "1-10": { start: "13:00", end: "22:00" },
      "6-3": { start: "06:00", end: "15:00" },
      OFF: "off",
    });
  });

  it("integrates: a 12-hour LLM codeMap -> normalize -> parseScheduleGrid yields correct shifts (the fix)", () => {
    // This is exactly the chain that was failing: the LLM proposes "1:00pm" etc.; normalize makes it HH:mm so
    // parseScheduleGrid (and downstream preview/commit) accept it and produce real shift entries.
    const llmMap = { "1-10": { start: "1:00pm", end: "10:00pm" }, GY: { start: "9:00pm", end: "6:00am" }, OFF: "off" as const };
    const parsed = parseScheduleGrid({
      headerDates: ["2026-08-16", "2026-08-17"],
      rows: [{ name: "ALICE", cells: ["1-10", "OFF"] }, { name: "BOB", cells: ["GY", "1-10"] }],
      codeMap: normalizeCodeMap(llmMap),
    });
    expect(parsed.unknownCodes).toEqual([]);
    const e = (n: string, d: string) => parsed.entries.find((x) => x.employeeName === n && x.date === d);
    expect(e("ALICE", "2026-08-16")).toMatchObject({ kind: "shift", times: { start: "13:00", end: "22:00" } });
    expect(e("ALICE", "2026-08-17")).toMatchObject({ kind: "off" });
    expect(e("BOB", "2026-08-16")).toMatchObject({ kind: "shift", times: { start: "21:00", end: "06:00" } }); // GY overnight
  });
});
